import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { FileUpload } from 'graphql-upload-ts';
import zipfile = require('mammoth/lib/zipfile');
import { In, Repository } from 'typeorm';
import { DocumentType, UserRoles } from '../../auth/enums';
import { PasswordService } from '../../auth/security';
import { InstitutionApprovalStatus } from '../../institution';
import { Institution } from '../../institution/entities/institution.entity';
import { MailService } from '../../mail/mail.service';
import { RedisService } from '../../redis';
import { User } from '../entities/user.entity';
import { AcceptUserInvitationDto } from './accept-user-invitation.dto';
import { UserImportResult, UserImportRowResult } from './user-import.types';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 500;
const INVITATION_TTL_SECONDS = 72 * 60 * 60;
const USER_HEADERS = [
  'nombre',
  'apellidos',
  'tipo_de_documento',
  'numero_de_documento',
  'telefono',
  'correo_electronico',
  'rol',
] as const;
const ADMINISTRATOR_HEADERS = [
  'nit_institucion',
  'nombre',
  'apellidos',
  'tipo_de_documento',
  'numero_de_documento',
  'telefono',
  'correo_electronico',
] as const;

const HEADER_ALIASES: Readonly<Record<string, string>> = {
  apellido: 'apellidos',
  celular: 'telefono',
  correo_electronico: 'correo',
  correo_institucional: 'correo',
  documento: 'numero_documento',
  email: 'correo',
  email_institucional: 'correo',
  nit: 'nit_institucion',
  nombres: 'nombre',
  numero_de_documento: 'numero_documento',
  numero_identificacion: 'numero_documento',
  telefono_celular: 'telefono',
  tipo_de_documento: 'tipo_documento',
  tipo_identificacion: 'tipo_documento',
  tipo_usuario: 'rol',
};

type SpreadsheetRow = { row: number; values: string[] };
type ValidUserRow = {
  row: number;
  name: string;
  lastName: string;
  documentType: DocumentType;
  documentNumber: number;
  phone: number;
  email: string;
  role: UserRoles;
};
type ValidAdministratorRow = ValidUserRow & {
  institutionId: string;
  institutionTaxId: string;
};
type AdministratorCandidate = Omit<ValidAdministratorRow, 'institutionId'>;
type UserCreationStage = 'password' | 'database' | 'invitation' | 'email';

@Injectable()
export class UserImportService {
  private readonly logger = new Logger(UserImportService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Institution)
    private readonly institutionRepository: Repository<Institution>,
    private readonly passwordService: PasswordService,
    private readonly mailService: MailService,
    private readonly redis: RedisService
  ) {}

  async import(
    file: FileUpload | Promise<FileUpload>,
    administrator: User
  ): Promise<UserImportResult> {
    if (administrator.role !== UserRoles.Administrador || administrator.isPlatformAdmin)
      throw new ForbiddenException(
        'La importación debe realizarla un administrador de la institución.'
      );
    if (!administrator.institutionId)
      throw new ForbiddenException('El administrador no tiene una institución asignada.');

    const content = await this.readXlsx(file);
    const spreadsheetRows = await this.parseSheet(content, 'Usuarios', USER_HEADERS);
    const { rejected, valid } = await this.validateRows(spreadsheetRows);
    const imported = await this.createUsers(valid, administrator.institutionId);
    const rows = [...rejected, ...imported].sort((left, right) => left.row - right.row);

    return this.result(rows);
  }

  async importPlatformAdministrators(
    file: FileUpload | Promise<FileUpload>,
    platformAdministrator: User
  ): Promise<UserImportResult> {
    if (
      platformAdministrator.role !== UserRoles.Administrador ||
      !platformAdministrator.isPlatformAdmin
    )
      throw new ForbiddenException(
        'La importación global requiere permisos de administrador de plataforma.'
      );

    const content = await this.readXlsx(file);
    const spreadsheetRows = await this.parseSheet(
      content,
      'Administradores',
      ADMINISTRATOR_HEADERS
    );
    const { rejected, valid } = await this.validateAdministratorRows(spreadsheetRows);
    const imported = await this.createPlatformAdministrators(valid);
    return this.result([...rejected, ...imported].sort((left, right) => left.row - right.row));
  }

  async acceptInvitation({ token, password }: AcceptUserInvitationDto): Promise<void> {
    const key = this.invitationKey(token);
    let userId: string | null;
    try {
      userId = await this.redis.client.getDel(key);
    } catch {
      throw new ServiceUnavailableException(
        'No fue posible validar la invitación en este momento. Inténtalo nuevamente.'
      );
    }
    if (!userId)
      throw new BadRequestException('La invitación no es válida, ya fue utilizada o expiró.');

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user)
      throw new BadRequestException('La cuenta asociada a la invitación ya no está disponible.');

    try {
      user.password = await this.passwordService.hash(password);
      user.authVersion = (user.authVersion ?? 1) + 1;
      await this.userRepository.save(user);
    } catch {
      await this.redis.client.set(key, userId, { EX: 15 * 60 }).catch(() => undefined);
      throw new InternalServerErrorException(
        'No fue posible guardar la contraseña. El enlace seguirá disponible para reintentar.'
      );
    }
  }

  private async readXlsx(file: FileUpload | Promise<FileUpload>): Promise<Buffer> {
    const { createReadStream, filename, mimetype } = await file;
    if (!filename?.toLowerCase().endsWith('.xlsx'))
      throw new BadRequestException('Solo se permite la plantilla en formato .xlsx.');
    const allowedMimeTypes = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
    ]);
    if (mimetype && !allowedMimeTypes.has(mimetype.toLowerCase()))
      throw new BadRequestException('El tipo de archivo no corresponde a un XLSX válido.');

    const stream = createReadStream();
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_FILE_SIZE) {
          stream.destroy();
          throw new BadRequestException('El archivo supera el límite de 5 MB.');
        }
        chunks.push(buffer);
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('No se pudo leer el archivo cargado.');
    }
    if (size === 0) throw new BadRequestException('El archivo está vacío.');

    const content = Buffer.concat(chunks, size);
    if (content.length < 4 || content.readUInt32LE(0) !== 0x04034b50)
      throw new BadRequestException('El contenido no corresponde a un XLSX válido.');
    return content;
  }

  private async parseSheet(
    content: Buffer,
    sheetName: string,
    expectedHeaders: readonly string[]
  ): Promise<SpreadsheetRow[]> {
    let archive: Awaited<ReturnType<typeof zipfile.openArrayBuffer>>;
    try {
      archive = await zipfile.openArrayBuffer(content);
    } catch {
      throw new BadRequestException('No se pudo abrir el archivo XLSX.');
    }

    if (!archive.exists('xl/workbook.xml') || !archive.exists('xl/_rels/workbook.xml.rels'))
      throw new BadRequestException('El archivo no contiene una estructura XLSX válida.');

    const workbookXml = await archive.read('xl/workbook.xml', 'utf-8');
    const relationshipXml = await archive.read('xl/_rels/workbook.xml.rels', 'utf-8');
    const targetSheetName = sheetName.trim().toLowerCase();
    const sheetTag =
      this.findXmlTag(
        workbookXml,
        'sheet',
        (attributes) =>
          this.decodeXml(attributes.name ?? '')
            .trim()
            .toLowerCase() === targetSheetName
      ) ?? this.findXmlTag(workbookXml, 'sheet', () => true);
    const relationshipId = sheetTag?.['r:id'];
    if (!relationshipId)
      throw new BadRequestException(`La plantilla debe contener una hoja llamada ${sheetName}.`);

    const relationship = this.findXmlTag(
      relationshipXml,
      'Relationship',
      (attributes) => attributes.Id === relationshipId
    );
    if (!relationship?.Target)
      throw new BadRequestException(`No se pudo localizar la hoja ${sheetName}.`);
    const target = relationship.Target.replace(/^\/+/, '').replace(/^\.\.\//, '');
    const sheetPath = target.startsWith('xl/') ? target : `xl/${target}`;
    if (!archive.exists(sheetPath))
      throw new BadRequestException(`No se pudo leer la hoja ${sheetName}.`);

    const sharedStrings = archive.exists('xl/sharedStrings.xml')
      ? this.parseSharedStrings(await archive.read('xl/sharedStrings.xml', 'utf-8'))
      : [];
    const sheetXml = await archive.read(sheetPath, 'utf-8');
    const rows = this.parseSheetRows(sheetXml, sharedStrings);
    const normalizedExpectedHeaders = expectedHeaders.map((header) => this.normalizeHeader(header));

    let headerIndex = -1;
    let headerColumns: number[] = [];
    let bestCandidate:
      | { row: SpreadsheetRow; normalizedValues: string[]; matched: number }
      | undefined;

    for (const [index, row] of rows.entries()) {
      const normalizedValues = row.values.map((value) => this.normalizeHeader(value ?? ''));
      const columns = normalizedExpectedHeaders.map((header) => normalizedValues.indexOf(header));
      const matched = columns.filter((column) => column >= 0).length;
      if (!bestCandidate || matched > bestCandidate.matched) {
        bestCandidate = { row, normalizedValues, matched };
      }
      if (matched === normalizedExpectedHeaders.length) {
        headerIndex = index;
        headerColumns = columns;
        break;
      }
    }

    if (headerIndex < 0) {
      const missingHeaders = normalizedExpectedHeaders.filter(
        (header) => !bestCandidate?.normalizedValues.includes(header)
      );
      const foundHeaders = bestCandidate?.row.values.filter(Boolean).join(', ') || 'sin valores';
      throw new BadRequestException(
        `No se encontraron todos los encabezados requeridos: ${expectedHeaders.join(', ')}. ` +
          `Faltan o fueron modificados: ${missingHeaders.join(', ')}. ` +
          `Mejor fila candidata: fila ${bestCandidate?.row.row ?? 'desconocida'} [${foundHeaders}].`
      );
    }

    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row) => ({
        row: row.row,
        values: headerColumns.map((column) => row.values[column] ?? ''),
      }))
      .filter((row) => row.values.some((value) => (value ?? '').trim() !== ''));
    if (dataRows.length === 0)
      throw new BadRequestException(`La hoja ${sheetName} no contiene personas para importar.`);
    if (dataRows.length > MAX_IMPORT_ROWS)
      throw new BadRequestException(`El archivo no puede superar ${MAX_IMPORT_ROWS} usuarios.`);
    return dataRows;
  }

  private async validateRows(rows: SpreadsheetRow[]): Promise<{
    rejected: UserImportRowResult[];
    valid: ValidUserRow[];
  }> {
    const rejected: UserImportRowResult[] = [];
    const candidates: ValidUserRow[] = [];
    const seenEmails = new Set<string>();
    const seenDocuments = new Set<number>();
    const seenPhones = new Set<number>();

    for (const row of rows) {
      const parsed = this.validateRow(row);
      if ('message' in parsed) {
        rejected.push(parsed);
        continue;
      }
      const duplicate = seenEmails.has(parsed.email)
        ? 'El correo está repetido dentro del archivo.'
        : seenDocuments.has(parsed.documentNumber)
          ? 'El número de documento está repetido dentro del archivo.'
          : seenPhones.has(parsed.phone)
            ? 'El teléfono está repetido dentro del archivo.'
            : null;
      if (duplicate) {
        rejected.push({
          row: parsed.row,
          email: parsed.email,
          imported: false,
          message: duplicate,
        });
        continue;
      }
      seenEmails.add(parsed.email);
      seenDocuments.add(parsed.documentNumber);
      seenPhones.add(parsed.phone);
      candidates.push(parsed);
    }

    if (candidates.length === 0) return { rejected, valid: [] };
    const existing = await this.userRepository.find({
      where: [
        { email: In(candidates.map((row) => row.email)) },
        { document_num: In(candidates.map((row) => row.documentNumber)) },
        { phone: In(candidates.map((row) => row.phone)) },
      ],
      select: ['email', 'document_num', 'phone'],
    });
    const existingEmails = new Set(existing.map((user) => user.email.toLowerCase()));
    const existingDocuments = new Set(existing.map((user) => Number(user.document_num)));
    const existingPhones = new Set(existing.map((user) => Number(user.phone)));
    const valid = candidates.filter((row) => {
      const message = existingEmails.has(row.email)
        ? 'Ya existe una cuenta con este correo.'
        : existingDocuments.has(row.documentNumber)
          ? 'Ya existe una cuenta con este número de documento.'
          : existingPhones.has(row.phone)
            ? 'Ya existe una cuenta con este teléfono.'
            : null;
      if (!message) return true;
      rejected.push({ row: row.row, email: row.email, imported: false, message });
      return false;
    });
    return { rejected, valid };
  }

  private async validateAdministratorRows(rows: SpreadsheetRow[]): Promise<{
    rejected: UserImportRowResult[];
    valid: ValidAdministratorRow[];
  }> {
    const rejected: UserImportRowResult[] = [];
    const candidates: AdministratorCandidate[] = [];
    const seenEmails = new Set<string>();
    const seenDocuments = new Set<number>();
    const seenPhones = new Set<number>();
    const seenInstitutions = new Set<string>();

    for (const row of rows) {
      const parsed = this.validateAdministratorRow(row);
      if ('message' in parsed) {
        rejected.push(parsed);
        continue;
      }
      const duplicate = seenInstitutions.has(parsed.institutionTaxId)
        ? 'La institución está repetida dentro del archivo.'
        : seenEmails.has(parsed.email)
          ? 'El correo está repetido dentro del archivo.'
          : seenDocuments.has(parsed.documentNumber)
            ? 'El número de documento está repetido dentro del archivo.'
            : seenPhones.has(parsed.phone)
              ? 'El teléfono está repetido dentro del archivo.'
              : null;
      if (duplicate) {
        rejected.push({
          row: parsed.row,
          email: parsed.email,
          imported: false,
          message: duplicate,
        });
        continue;
      }
      seenInstitutions.add(parsed.institutionTaxId);
      seenEmails.add(parsed.email);
      seenDocuments.add(parsed.documentNumber);
      seenPhones.add(parsed.phone);
      candidates.push(parsed);
    }

    if (candidates.length === 0) return { rejected, valid: [] };
    const institutions = await this.institutionRepository.find({
      where: {
        taxId: In(candidates.map((row) => row.institutionTaxId)),
        isActive: true,
      },
      select: ['id', 'taxId'],
    });
    const institutionByTaxId = new Map(
      institutions.map((institution) => [institution.taxId, institution])
    );
    const existingUsers = await this.userRepository.find({
      where: [
        { email: In(candidates.map((row) => row.email)) },
        { document_num: In(candidates.map((row) => row.documentNumber)) },
        { phone: In(candidates.map((row) => row.phone)) },
        {
          role: UserRoles.Administrador,
          institutionId: In(institutions.map((institution) => institution.id)),
        },
      ],
      select: ['email', 'document_num', 'phone', 'role', 'institutionId', 'isPlatformAdmin'],
    });
    const existingEmails = new Set(existingUsers.map((user) => user.email.toLowerCase()));
    const existingDocuments = new Set(existingUsers.map((user) => Number(user.document_num)));
    const existingPhones = new Set(existingUsers.map((user) => Number(user.phone)));
    const institutionsWithAdministrator = new Set(
      existingUsers
        .filter((user) => user.role === UserRoles.Administrador && !user.isPlatformAdmin)
        .map((user) => user.institutionId)
    );
    const valid: ValidAdministratorRow[] = [];
    for (const row of candidates) {
      const institution = institutionByTaxId.get(row.institutionTaxId);
      const message = !institution
        ? 'No existe una institución activa con este NIT.'
        : institutionsWithAdministrator.has(institution.id)
          ? 'La institución ya tiene un administrador registrado.'
          : existingEmails.has(row.email)
            ? 'Ya existe una cuenta con este correo.'
            : existingDocuments.has(row.documentNumber)
              ? 'Ya existe una cuenta con este número de documento.'
              : existingPhones.has(row.phone)
                ? 'Ya existe una cuenta con este teléfono.'
                : null;
      if (message) {
        rejected.push({ row: row.row, email: row.email, imported: false, message });
        continue;
      }
      valid.push({ ...row, institutionId: institution.id });
    }
    return { rejected, valid };
  }

  private validateRow(row: SpreadsheetRow): ValidUserRow | UserImportRowResult {
    const [name, lastName, documentTypeValue, documentValue, phoneValue, emailValue, roleValue] =
      row.values.map((value) => (value ?? '').trim());
    const email = emailValue?.toLowerCase();
    const error = (message: string): UserImportRowResult => ({
      row: row.row,
      email: email || undefined,
      imported: false,
      message,
    });
    if (!name || name.length > 120)
      return error('El nombre es obligatorio y admite máximo 120 caracteres.');
    if (!lastName || lastName.length > 120)
      return error('Los apellidos son obligatorios y admiten máximo 120 caracteres.');
    const documentType = this.documentType(documentTypeValue);
    if (!documentType)
      return error('El tipo de documento no es válido. Usa la lista de la plantilla.');
    const documentNumber = this.positiveSafeInteger(documentValue, 5, 15);
    if (!documentNumber) return error('El número de documento debe contener entre 5 y 15 dígitos.');
    const phone = this.positiveSafeInteger(phoneValue, 7, 15);
    if (!phone) return error('El teléfono debe contener entre 7 y 15 dígitos.');
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return error('El correo electrónico no es válido.');
    const role = this.role(roleValue);
    if (!role) return error('El rol debe ser Estudiante o Docente.');
    return { row: row.row, name, lastName, documentType, documentNumber, phone, email, role };
  }

  private validateAdministratorRow(
    row: SpreadsheetRow
  ): AdministratorCandidate | UserImportRowResult {
    const [taxIdValue, name, lastName, documentTypeValue, documentValue, phoneValue, emailValue] =
      row.values.map((value) => (value ?? '').trim());
    const email = emailValue?.toLowerCase();
    const error = (message: string): UserImportRowResult => ({
      row: row.row,
      email: email || undefined,
      imported: false,
      message,
    });
    const institutionTaxId = taxIdValue?.replace(/\s+/g, '');
    if (!institutionTaxId || !/^[A-Za-z0-9.-]{3,30}$/.test(institutionTaxId))
      return error('El NIT institucional no es válido.');
    if (!name || name.length > 120)
      return error('El nombre es obligatorio y admite máximo 120 caracteres.');
    if (!lastName || lastName.length > 120)
      return error('Los apellidos son obligatorios y admiten máximo 120 caracteres.');
    const documentType = this.documentType(documentTypeValue);
    if (!documentType)
      return error('El tipo de documento no es válido. Usa la lista de la plantilla.');
    const documentNumber = this.positiveSafeInteger(documentValue, 5, 15);
    if (!documentNumber) return error('El número de documento debe contener entre 5 y 15 dígitos.');
    const phone = this.positiveSafeInteger(phoneValue, 7, 15);
    if (!phone) return error('El teléfono debe contener entre 7 y 15 dígitos.');
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return error('El correo electrónico no es válido.');
    return {
      row: row.row,
      institutionTaxId,
      name,
      lastName,
      documentType,
      documentNumber,
      phone,
      email,
      role: UserRoles.Administrador,
    };
  }

  private async createUsers(
    rows: ValidUserRow[],
    institutionId: string
  ): Promise<UserImportRowResult[]> {
    const results: UserImportRowResult[] = [];
    for (let start = 0; start < rows.length; start += 10) {
      const batch = rows.slice(start, start + 10);
      const batchResults = await Promise.all(
        batch.map((row) => this.createUser(row, institutionId))
      );
      results.push(...batchResults);
    }
    return results;
  }

  private async createPlatformAdministrators(
    rows: ValidAdministratorRow[]
  ): Promise<UserImportRowResult[]> {
    const results: UserImportRowResult[] = [];
    for (let start = 0; start < rows.length; start += 10) {
      const batch = rows.slice(start, start + 10);
      const batchResults = await Promise.all(
        batch.map((row) => this.createUser(row, row.institutionId))
      );
      results.push(...batchResults);
    }
    return results;
  }

  private async createUser(row: ValidUserRow, institutionId: string): Promise<UserImportRowResult> {
    let savedUser: User | undefined;
    let invitationKey: string | undefined;
    let stage: UserCreationStage = 'password';
    try {
      const placeholder = randomBytes(48).toString('base64url');
      const user = this.userRepository.create({
        name: row.name,
        last_name: row.lastName,
        document_type: row.documentType,
        document_num: row.documentNumber,
        phone: row.phone,
        email: row.email,
        role: row.role,
        password: await this.passwordService.hash(placeholder),
        institutionId,
        approvalStatus: InstitutionApprovalStatus.APPROVED,
        isActive: true,
        isPlatformAdmin: false,
        authVersion: 1,
      });
      stage = 'database';
      savedUser = await this.userRepository.save(user);
      const token = randomBytes(32).toString('base64url');
      invitationKey = this.invitationKey(token);
      stage = 'invitation';
      await this.redis.client.set(invitationKey, savedUser.id, { EX: INVITATION_TTL_SECONDS });
      stage = 'email';
      await this.mailService.sendUserInvitation(savedUser, token, `user-import:${savedUser.id}`);
      return {
        row: row.row,
        email: row.email,
        imported: true,
        message: 'Usuario creado e invitación enviada.',
      };
    } catch (error) {
      if (invitationKey) await this.redis.client.del(invitationKey).catch(() => undefined);
      if (savedUser) await this.userRepository.delete(savedUser.id).catch(() => undefined);
      const isDuplicate = (error as { code?: string }).code === '23505';
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `Importación rechazada en la fila ${row.row} durante la etapa ${stage}: ${errorMessage}`
      );
      const message = isDuplicate
        ? 'Los datos del usuario ya existen.'
        : stage === 'email'
          ? 'No se creó la cuenta porque no fue posible enviar el correo de invitación.'
          : stage === 'invitation'
            ? 'No se creó la cuenta porque el servicio de invitaciones no está disponible.'
            : 'No fue posible crear la cuenta.';
      return {
        row: row.row,
        email: row.email,
        imported: false,
        message,
      };
    }
  }

  private parseSheetRows(xml: string, sharedStrings: string[]): SpreadsheetRow[] {
    const rows: SpreadsheetRow[] = [];
    const rowPattern = /<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g;
    for (const match of xml.matchAll(rowPattern)) {
      const rowAttributes = this.xmlAttributes(match[1]);
      const rowNumber = Number(rowAttributes.r);
      if (!Number.isInteger(rowNumber) || rowNumber < 1) continue;
      const values: string[] = [];
      const cellPattern = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
      for (const cellMatch of match[2].matchAll(cellPattern)) {
        const attributes = this.xmlAttributes(cellMatch[1]);
        const reference = attributes.r ?? '';
        const columnLetters = reference.match(/^[A-Z]+/i)?.[0];
        if (!columnLetters) continue;
        const column = this.columnIndex(columnLetters);
        if (column < 0 || column >= 15) continue;
        const body = cellMatch[2] ?? '';
        const rawValue = body.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
        const inlineValues = [...body.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)]
          .map((value) => this.decodeXml(value[1]))
          .join('');
        values[column] =
          attributes.t === 's' && rawValue !== undefined
            ? (sharedStrings[Number(rawValue)] ?? '')
            : inlineValues || this.decodeXml(rawValue ?? '');
      }
      rows.push({ row: rowNumber, values });
    }
    return rows;
  }

  private parseSharedStrings(xml: string): string[] {
    return [...xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((match) =>
      [...match[1].matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)]
        .map((value) => this.decodeXml(value[1]))
        .join('')
    );
  }

  private findXmlTag(
    xml: string,
    tagName: string,
    predicate: (attributes: Record<string, string>) => boolean
  ): Record<string, string> | undefined {
    const pattern = new RegExp(`<(?:\\w+:)?${tagName}\\b([^>]*)\\/?>`, 'g');
    for (const match of xml.matchAll(pattern)) {
      const attributes = this.xmlAttributes(match[1]);
      if (predicate(attributes)) return attributes;
    }
    return undefined;
  }

  private xmlAttributes(value: string): Record<string, string> {
    return Object.fromEntries(
      [...value.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [
        match[1],
        this.decodeXml(match[2]),
      ])
    );
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  private columnIndex(value: string): number {
    return (
      [...value.toUpperCase()].reduce(
        (total, character) => total * 26 + character.charCodeAt(0) - 64,
        0
      ) - 1
    );
  }

  private normalizeHeader(value: string): string {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .trim()
      .toLowerCase();
    return HEADER_ALIASES[normalized] ?? normalized;
  }

  private normalizeCatalogValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private documentType(value: string): DocumentType | undefined {
    const normalized = this.normalizeCatalogValue(value);
    if (['cc', 'c.c.', 'c.c', 'cedula de ciudadania', 'cedula'].includes(normalized))
      return DocumentType.CITIZENSHIP_CARD;
    if (['ti', 't.i.', 't.i', 'tarjeta de identidad'].includes(normalized))
      return DocumentType.IDENTITY_CARD;
    if (['ce', 'c.e.', 'c.e', 'cedula de extranjeria'].includes(normalized))
      return DocumentType.FOREIGNER_CARD;
    if (['pasaporte', 'pass'].includes(normalized)) return DocumentType.PASSPORT;
    if (['rc', 'r.c.', 'r.c', 'registro civil'].includes(normalized))
      return DocumentType.CIVIL_REGISRTRY;
    if (['lm', 'l.m.', 'l.m', 'libreta militar'].includes(normalized))
      return DocumentType.MILITARY_ID;
    return Object.values(DocumentType).find(
      (documentType) => this.normalizeCatalogValue(documentType) === normalized
    );
  }

  private role(value: string): UserRoles | undefined {
    const normalized = this.normalizeCatalogValue(value);
    if (['estudiante', 'student'].includes(normalized)) return UserRoles.Estudiante;
    if (['docente', 'profesor', 'profesora', 'teacher'].includes(normalized))
      return UserRoles.Docente;
    return undefined;
  }

  private positiveSafeInteger(
    value: string | undefined | null,
    minimumLength: number,
    maximumLength: number
  ): number | null {
    if (!value) return null;
    let cleaned = value.trim();
    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(cleaned)) {
      const num = Number(cleaned);
      if (!Number.isSafeInteger(num) || num <= 0) return null;
      cleaned = String(num);
    } else {
      cleaned = cleaned.replace(/\.0+$/, '').replace(/\D/g, '');
    }
    if (!new RegExp(`^\\d{${minimumLength},${maximumLength}}$`).test(cleaned)) return null;
    const parsed = Number(cleaned);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private invitationKey(token: string): string {
    return `user-invitation:${createHash('sha256').update(token).digest('hex')}`;
  }

  private result(rows: UserImportRowResult[]): UserImportResult {
    return {
      total: rows.length,
      imported: rows.filter((row) => row.imported).length,
      rejected: rows.filter((row) => !row.imported).length,
      rows,
    };
  }
}
