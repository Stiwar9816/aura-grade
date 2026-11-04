import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsSelect, In } from 'typeorm';
import { CourseDocumentsService } from '../course-documents/course-documents.service';
import { CourseDocumentVersion } from '../course-documents/entities/course-document-version.entity';
import { CourseDocument } from '../course-documents/entities/course-document.entity';
import { CourseDocumentKind, DocumentVersionStatus } from '../course-documents/document.enums';
import { Assignment } from '../assignment/entities/assignment.entity';
import { AssignmentExtension } from '../assignment/entities/assignment-extension.entity';
import { User } from '../user/entities/user.entity';
import { UserRoles } from '../auth/enums';
import { ConfirmActivityDto } from './dto/confirm-activity.dto';
import { CourseActivityConfirmation } from './entities/course-activity-confirmation.entity';
import { activityFingerprint } from './preparation-fingerprint';

const sourceMetadata: FindOptionsSelect<CourseDocumentVersion> = {
  id: true,
  documentId: true,
  version: true,
  status: true,
  originalName: true,
  format: true,
  document: { id: true, courseId: true, kind: true, title: true },
};
const relations = ['course', 'user', 'rubric', 'rubric.criteria'];
const published = (
  v: CourseDocumentVersion | undefined,
  courseId: string,
  kind: CourseDocumentKind
) =>
  !!v &&
  v.status === DocumentVersionStatus.PUBLISHED &&
  v.document?.courseId === courseId &&
  v.document.kind === kind;
const sourceView = (v: CourseDocumentVersion, section?: string) => ({
  versionId: v.id,
  documentId: v.documentId,
  version: v.version,
  title: v.document.title,
  kind: v.document.kind,
  name: v.originalName,
  format: v.format,
  ...(section ? { section } : {}),
});

@Injectable()
export class CoursePreparationService {
  constructor(
    private readonly db: DataSource,
    private readonly documents: CourseDocumentsService
  ) {}

  async list(courseId: string, actor: User, page = 1, limit = 20) {
    const role = await this.documents.authorize(courseId, actor.id, false);
    const student = role === UserRoles.Estudiante;
    const [assignments, total] = await this.db.getRepository(Assignment).findAndCount({
      where: {
        course: { id: courseId },
        ...(student ? { isActive: true } : { user: { id: actor.id } }),
      },
      relations,
      order: { dueDate: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const ids = assignments.map((a) => a.id);
    const confirmations = ids.length
      ? await this.db.getRepository(CourseActivityConfirmation).find({
          where: { assignmentId: In(ids) },
          select: {
            assignmentId: true,
            activityHash: true,
            confirmedAt: true,
            guideSection: true,
            scheduleSection: true,
            guideVersion: sourceMetadata,
            scheduleVersion: sourceMetadata,
          },
          relations: [
            'guideVersion',
            'guideVersion.document',
            'scheduleVersion',
            'scheduleVersion.document',
          ],
        })
      : [];
    const extensions =
      student && ids.length
        ? await this.db.getRepository(AssignmentExtension).find({
            where: { assignment: { id: In(ids) }, student: { id: actor.id } },
            relations: ['assignment'],
          })
        : [];
    const sources = student
      ? []
      : await this.db.getRepository(CourseDocumentVersion).find({
          where: {
            status: DocumentVersionStatus.PUBLISHED,
            document: {
              courseId,
              kind: In([CourseDocumentKind.GUIDE, CourseDocumentKind.SCHEDULE]),
            },
          },
          relations: ['document'],
          select: sourceMetadata,
          order: { documentId: 'ASC' },
        });
    return {
      page,
      limit,
      total,
      sources: sources.map((v) => sourceView(v)),
      items: assignments.map((a) => {
        const confirmation = confirmations.find((c) => c.assignmentId === a.id);
        const hash = activityFingerprint(a);
        const coherent =
          confirmation &&
          confirmation.activityHash === hash &&
          published(confirmation.guideVersion, courseId, CourseDocumentKind.GUIDE) &&
          published(confirmation.scheduleVersion, courseId, CourseDocumentKind.SCHEDULE);
        const extension = extensions.find((e) => e.assignment.id === a.id);
        const effectiveDueDate =
          extension && new Date(extension.extendedDueDate) > new Date(a.dueDate)
            ? extension.extendedDueDate
            : a.dueDate;
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          isActive: a.isActive,
          dueDate: a.dueDate,
          effectiveDueDate,
          rubric: {
            id: a.rubric.id,
            title: a.rubric.title,
            version: a.rubric.version,
            criteria: (a.rubric.criteria ?? []).map((c) => ({
              id: c.id,
              title: c.title,
              description: c.description,
              weight: Number(c.weight),
              levels: c.levels,
            })),
          },
          status: !confirmation ? 'UNCONFIRMED' : coherent ? 'CONFIRMED' : 'NEEDS_REVIEW',
          confirmedAt: confirmation?.confirmedAt ?? null,
          ...(!student ? { activityHash: hash } : {}),
          guide: coherent ? sourceView(confirmation.guideVersion, confirmation.guideSection) : null,
          schedule: coherent
            ? sourceView(confirmation.scheduleVersion, confirmation.scheduleSection)
            : null,
          ...(!student && confirmation
            ? {
                previousSections: {
                  guide: confirmation.guideSection,
                  schedule: confirmation.scheduleSection,
                },
              }
            : {}),
        };
      }),
    };
  }

  async confirm(courseId: string, assignmentId: string, actor: User, input: ConfirmActivityDto) {
    await this.documents.authorize(courseId, actor.id, true);
    if (input.confirmed !== true || !input.guideSection?.trim() || !input.scheduleSection?.trim())
      throw new BadRequestException(
        'Confirma la coherencia e indica la sección de cada documento.'
      );
    return this.db.transaction(async (manager) => {
      await this.documents.authorize(courseId, actor.id, true, manager);
      const assignments = manager.getRepository(Assignment);
      if (
        !(await assignments.findOne({
          where: { id: assignmentId },
          relations: [],
          lock: { mode: 'pessimistic_write' },
        }))
      )
        throw new NotFoundException('Actividad no disponible.');
      const assignment = await assignments.findOne({ where: { id: assignmentId }, relations });
      if (!assignment || assignment.course.id !== courseId)
        throw new NotFoundException('Actividad no disponible.');
      if (assignment.user.id !== actor.id)
        throw new ForbiddenException(
          'Solo el autor de la actividad puede confirmar su preparación.'
        );
      if (activityFingerprint(assignment) !== input.activityHash)
        throw new ConflictException(
          'La actividad o la rúbrica cambió. Actualiza y revisa nuevamente.'
        );
      // Match the publication/archive parent lock, in stable order for concurrent confirmations.
      const preliminary = await Promise.all(
        [input.guideVersionId, input.scheduleVersionId].map((id) =>
          manager.getRepository(CourseDocumentVersion).findOne({ where: { id } })
        )
      );
      if (preliminary.some((v) => !v))
        throw new BadRequestException('Selecciona fuentes publicadas del curso.');
      for (const id of [...new Set(preliminary.map((v) => v!.documentId))].sort()) {
        const doc = await manager
          .getRepository(CourseDocument)
          .findOne({ where: { id, courseId }, lock: { mode: 'pessimistic_write' } });
        if (!doc || doc.courseId !== courseId)
          throw new BadRequestException('Selecciona fuentes publicadas del curso.');
      }
      const guide = await this.requireSource(
        manager,
        input.guideVersionId,
        courseId,
        CourseDocumentKind.GUIDE
      );
      const schedule = await this.requireSource(
        manager,
        input.scheduleVersionId,
        courseId,
        CourseDocumentKind.SCHEDULE
      );
      const repository = manager.getRepository(CourseActivityConfirmation);
      const saved = await repository.save(
        repository.create({
          assignmentId,
          guideVersionId: guide.id,
          scheduleVersionId: schedule.id,
          guideSection: input.guideSection.trim(),
          scheduleSection: input.scheduleSection.trim(),
          activityHash: input.activityHash,
          confirmedById: actor.id,
          confirmedAt: new Date(),
        })
      );
      return { assignmentId, confirmedAt: saved.confirmedAt };
    });
  }

  private async requireSource(
    manager: EntityManager,
    id: string,
    courseId: string,
    kind: CourseDocumentKind
  ) {
    const version = await manager
      .getRepository(CourseDocumentVersion)
      .findOne({ where: { id }, relations: ['document'] });
    if (!published(version, courseId, kind))
      throw new BadRequestException(
        'La guía y el cronograma deben estar publicados en este curso. Actualiza el panel.'
      );
    return version!;
  }
}
