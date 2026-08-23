import { Readable } from 'stream';
import { createRequire } from 'module';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { UserImportService } from 'src/user/import/user-import.service';

const localRequire = createRequire(__filename);
const JSZip = localRequire(
  localRequire.resolve('jszip', { paths: [localRequire.resolve('mammoth')] })
);

const workbookXml = (sheetName: string) => `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const relationshipsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

const cell = (reference: string, value: string) =>
  `<c r="${reference}" t="inlineStr"><is><t>${value}</t></is></c>`;

const userHeaders = [
  'nombre',
  'apellidos',
  'tipo_documento',
  'numero_documento',
  'telefono',
  'correo',
  'rol',
];

const makeWorkbook = async (
  dataRows: string[][],
  sheetName = 'Usuarios',
  headers = userHeaders
): Promise<Buffer> => {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const rows = [headers, ...dataRows]
    .map(
      (values, index) =>
        `<row r="${index + 1}">${values
          .map((value, column) => cell(`${letters[column]}${index + 1}`, value))
          .join('')}</row>`
    )
    .join('');
  const zip = new JSZip();
  zip.file('xl/workbook.xml', workbookXml(sheetName));
  zip.file('xl/_rels/workbook.xml.rels', relationshipsXml);
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
};

const fileUpload = (content: Buffer) => ({
  filename: 'usuarios.xlsx',
  mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  encoding: '7bit',
  createReadStream: () => Readable.from(content),
});

describe('UserImportService', () => {
  const repository = {
    create: jest.fn((value) => value),
    delete: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const institutionRepository = { find: jest.fn() };
  const passwordService = { hash: jest.fn() };
  const mailService = { sendUserInvitation: jest.fn() };
  const redis = { client: { del: jest.fn(), getDel: jest.fn(), set: jest.fn() } };
  const service = new UserImportService(
    repository as never,
    institutionRepository as never,
    passwordService as never,
    mailService as never,
    redis as never
  );
  const administrator = {
    id: 'admin-id',
    role: UserRoles.Administrador,
    institutionId: 'institution-id',
    isPlatformAdmin: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.find.mockResolvedValue([]);
    institutionRepository.find.mockResolvedValue([]);
    repository.save.mockImplementation(async (user) => ({ ...user, id: 'new-user-id' }));
    repository.delete.mockResolvedValue({ affected: 1 });
    passwordService.hash.mockResolvedValue('hashed-password');
    mailService.sendUserInvitation.mockResolvedValue(undefined);
    redis.client.set.mockResolvedValue('OK');
    redis.client.del.mockResolvedValue(1);
  });

  it('imports a valid institutional user and sends a password invitation', async () => {
    const workbook = await makeWorkbook([
      [
        'Valentina',
        'Gómez Ruiz',
        'Cedula de ciudadania',
        '1023456789',
        '3001234567',
        'VALENTINA@INSTITUCION.EDU.CO',
        'Estudiante',
      ],
    ]);

    const result = await service.import(fileUpload(workbook) as never, administrator as never);

    expect(result).toMatchObject({ total: 1, imported: 1, rejected: 0 });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'valentina@institucion.edu.co',
        institutionId: 'institution-id',
        role: UserRoles.Estudiante,
      })
    );
    expect(mailService.sendUserInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-user-id' }),
      expect.any(String),
      'user-import:new-user-id'
    );
  });

  it('handles a Promise<FileUpload> (GraphQL upload scalar runtime behavior)', async () => {
    const workbook = await makeWorkbook([
      [
        'Carlos',
        'Mendoza',
        'CC',
        '1098765432',
        '3019876543',
        'carlos.mendoza@institucion.edu.co',
        'profesor',
      ],
    ]);
    const filePromise = Promise.resolve(fileUpload(workbook));

    const result = await service.import(filePromise as never, administrator as never);

    expect(result).toMatchObject({ total: 1, imported: 1, rejected: 0 });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'carlos.mendoza@institucion.edu.co',
        document_type: DocumentType.CITIZENSHIP_CARD,
        role: UserRoles.Docente,
      })
    );
  });

  it('parses sheets with different names or fallback sheets correctly', async () => {
    const workbook = await makeWorkbook(
      [
        [
          'Ana',
          'Rojas',
          'TI',
          '1012345678',
          '3123456789',
          'ana.rojas@institucion.edu.co',
          'Estudiante',
        ],
      ],
      'Hoja 1'
    );

    const result = await service.import(fileUpload(workbook) as never, administrator as never);

    expect(result).toMatchObject({ total: 1, imported: 1, rejected: 0 });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        document_type: DocumentType.IDENTITY_CARD,
      })
    );
  });

  it('accepts reordered headers and maps every value to its canonical field', async () => {
    const workbook = await makeWorkbook(
      [
        [
          'reordenado@institucion.edu.co',
          'Docente',
          'Renata',
          '3151234567',
          '1012345678',
          'Vargas',
          'CC',
        ],
      ],
      'Usuarios',
      ['correo', 'rol', 'nombre', 'telefono', 'numero_documento', 'apellidos', 'tipo_documento']
    );

    const result = await service.import(fileUpload(workbook) as never, administrator as never);

    expect(result).toMatchObject({ total: 1, imported: 1, rejected: 0 });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Renata',
        last_name: 'Vargas',
        email: 'reordenado@institucion.edu.co',
        role: UserRoles.Docente,
      })
    );
  });

  it('rejects only the repeated row and keeps the first row importable', async () => {
    const repeated = [
      'Valentina',
      'Gómez Ruiz',
      'Cedula de ciudadania',
      '1023456789',
      '3001234567',
      'valentina@institucion.edu.co',
      'Estudiante',
    ];
    const workbook = await makeWorkbook([
      repeated,
      ['Otro', 'Usuario', 'Pasaporte', '9988776655', '3109876543', repeated[5], 'Docente'],
    ]);

    const result = await service.import(fileUpload(workbook) as never, administrator as never);

    expect(result.imported).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.rows[1].message).toContain('correo está repetido');
  });

  it('does not leave a user created when sending the invitation fails', async () => {
    mailService.sendUserInvitation.mockRejectedValueOnce(new Error('mail unavailable'));
    const workbook = await makeWorkbook([
      [
        'Laura',
        'Pérez',
        'Pasaporte',
        '9988776655',
        '3109876543',
        'laura@institucion.edu.co',
        'Docente',
      ],
    ]);

    const result = await service.import(fileUpload(workbook) as never, administrator as never);

    expect(result).toMatchObject({ imported: 0, rejected: 1 });
    expect(result.rows[0].message).toBe(
      'No se creó la cuenta porque no fue posible enviar el correo de invitación.'
    );
    expect(repository.delete).toHaveBeenCalledWith('new-user-id');
    expect(redis.client.del).toHaveBeenCalled();
  });

  it('reports when the invitation store is unavailable and rolls back the user', async () => {
    redis.client.set.mockRejectedValueOnce(new Error('redis unavailable'));
    const workbook = await makeWorkbook([
      [
        'Mateo',
        'Sánchez',
        'CC',
        '1012345678',
        '3112345678',
        'mateo@institucion.edu.co',
        'Estudiante',
      ],
    ]);

    const result = await service.import(fileUpload(workbook) as never, administrator as never);

    expect(result).toMatchObject({ imported: 0, rejected: 1 });
    expect(result.rows[0].message).toBe(
      'No se creó la cuenta porque el servicio de invitaciones no está disponible.'
    );
    expect(repository.delete).toHaveBeenCalledWith('new-user-id');
    expect(mailService.sendUserInvitation).not.toHaveBeenCalled();
  });

  it('accepts an invitation once and stores the selected password', async () => {
    redis.client.getDel.mockResolvedValueOnce('new-user-id');
    repository.findOneBy.mockResolvedValueOnce({ id: 'new-user-id', authVersion: 1 });

    await service.acceptInvitation({
      token: 'a'.repeat(43),
      password: 'UnaClaveMuySegura2026!',
    });

    expect(passwordService.hash).toHaveBeenCalledWith('UnaClaveMuySegura2026!');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'hashed-password', authVersion: 2 })
    );
  });

  it('allows the platform administrator to create an initial institutional administrator', async () => {
    institutionRepository.find.mockResolvedValueOnce([
      { id: 'institution-id', taxId: '900123456-7', isActive: true },
    ]);
    repository.find.mockResolvedValueOnce([]);
    const workbook = await makeWorkbook(
      [
        [
          '900123456-7',
          'Mariana',
          'Torres Silva',
          'Cedula de ciudadania',
          '1023456789',
          '3001234567',
          'mariana@institucion.edu.co',
        ],
      ],
      'Administradores',
      [
        'nit_institucion',
        'nombre',
        'apellidos',
        'tipo_documento',
        'numero_documento',
        'telefono',
        'correo',
      ]
    );

    const result = await service.importPlatformAdministrators(
      fileUpload(workbook) as never,
      {
        ...administrator,
        isPlatformAdmin: true,
      } as never
    );

    expect(result).toMatchObject({ total: 1, imported: 1, rejected: 0 });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        institutionId: 'institution-id',
        role: UserRoles.Administrador,
        isPlatformAdmin: false,
      })
    );
  });

  it('rejects a global row when the institution already has an administrator', async () => {
    institutionRepository.find.mockResolvedValueOnce([
      { id: 'institution-id', taxId: '900123456-7', isActive: true },
    ]);
    repository.find.mockResolvedValueOnce([
      {
        email: 'existing@institution.edu.co',
        document_num: 555555555,
        phone: 3005555555,
        role: UserRoles.Administrador,
        institutionId: 'institution-id',
        isPlatformAdmin: false,
      },
    ]);
    const workbook = await makeWorkbook(
      [
        [
          '900123456-7',
          'Mariana',
          'Torres Silva',
          'Pasaporte',
          '1023456789',
          '3001234567',
          'mariana@institucion.edu.co',
        ],
      ],
      'Administradores',
      [
        'nit_institucion',
        'nombre',
        'apellidos',
        'tipo_documento',
        'numero_documento',
        'telefono',
        'correo',
      ]
    );

    const result = await service.importPlatformAdministrators(
      fileUpload(workbook) as never,
      {
        ...administrator,
        isPlatformAdmin: true,
      } as never
    );

    expect(result).toMatchObject({ imported: 0, rejected: 1 });
    expect(result.rows[0].message).toContain('ya tiene un administrador');
  });
});
