import { ForbiddenException, HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcademicQueriesService } from '../academic-queries/academic-queries.service';
import { CourseAssistantService } from '../course-assistant/course-assistant.service';
import { TelegramJobData } from './telegram.constants';
import { TelegramClient } from './telegram-client';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramLinkEntity } from './entities/telegram-link.entity';
import { parseCommand } from './telegram-update';
import {
  DENIED,
  GENERIC_ERROR,
  HELP,
  NOT_LINKED,
  formatActivities,
  formatAnswer,
  formatCourses,
  formatResult,
  truncate,
} from './telegram-messages';

const LIST_LIMIT = 20;
const index = (arg: string, size: number): number | null => {
  if (!/^\d{1,3}$/.test(arg)) return null;
  const n = Number(arg);
  return n >= 1 && n <= size ? n - 1 : null;
};

/**
 * Runs inside the queue worker. Identity is the validated link, never the message text, and
 * every data operation goes through services that re-check account, institution and enrollment.
 */
@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private readonly links: TelegramLinkService,
    private readonly queries: AcademicQueriesService,
    private readonly assistant: CourseAssistantService,
    private readonly client: TelegramClient,
    private readonly config: ConfigService
  ) {}

  async handle(job: TelegramJobData): Promise<void> {
    const reply = await this.reply(job);
    await this.client.sendMessage(job.chatId, truncate(reply));
  }

  private async reply(job: TelegramJobData): Promise<string> {
    const command = parseCommand(job.text);
    try {
      if (command?.name === 'start')
        return command.args ? await this.link(job, command.args) : `${NOT_LINKED}\n\n${HELP}`;
      if (command?.name === 'ayuda' || command?.name === 'help') return HELP;
      const link = await this.links.resolve(job.telegramUserId, job.chatId);
      if (!link) return NOT_LINKED;
      if (!command) return await this.ask(link, job.text);
      switch (command.name) {
        case 'desvincular':
          await this.links.revokeByTelegram(job.telegramUserId);
          return 'Telegram desvinculado. Puedes volver a vincularlo desde la web.';
        case 'cursos':
          return await this.listCourses(link);
        case 'curso':
          return await this.chooseCourse(link, command.args);
        case 'entregas':
          return await this.activities(link, true);
        case 'actividades':
          return await this.activities(link, false);
        case 'resultado':
          return await this.result(link, command.args);
        default:
          return `Comando no reconocido.\n\n${HELP}`;
      }
    } catch (error) {
      return this.explain(error);
    }
  }

  private async link(job: TelegramJobData, token: string): Promise<string> {
    const outcome = await this.links.consume(token, job.telegramUserId, job.chatId);
    switch (outcome) {
      case 'LINKED':
        return `Cuenta vinculada. Usa /cursos para ver tus cursos.\n\n${HELP}`;
      case 'ACCESS_DENIED':
        return DENIED;
      case 'TELEGRAM_IN_USE':
        return 'Este Telegram ya está vinculado a otra cuenta. Escribe /desvincular y genera un código nuevo.';
      default:
        return 'El código no es válido, ya se usó o venció. Genera uno nuevo en la web.';
    }
  }

  private async resolveCourse(link: TelegramLinkEntity) {
    const courses = await this.queries.courses(link.userId);
    if (!courses.length) return { message: 'No tienes cursos activos.' } as const;
    const chosen =
      courses.find((c) => c.id === link.selectedCourseId) ??
      (courses.length === 1 ? courses[0] : null);
    if (!chosen)
      return {
        message: `Tienes varios cursos y ninguno activo.\n${formatCourses(courses)}`,
      } as const;
    return { course: chosen } as const;
  }

  private async listCourses(link: TelegramLinkEntity) {
    const courses = await this.queries.courses(link.userId);
    return courses.length
      ? formatCourses(courses, link.selectedCourseId)
      : 'No tienes cursos activos.';
  }

  private async chooseCourse(link: TelegramLinkEntity, arg: string) {
    const courses = await this.queries.courses(link.userId);
    const i = index(arg, courses.length);
    if (i === null)
      return courses.length
        ? formatCourses(courses, link.selectedCourseId)
        : 'No tienes cursos activos.';
    await this.links.selectCourse(link.id, courses[i].id);
    return `Curso activo: ${courses[i].name}.`;
  }

  private async activities(link: TelegramLinkEntity, upcoming: boolean) {
    const target = await this.resolveCourse(link);
    if ('message' in target) return target.message;
    const page = await this.queries.activities(link.userId, target.course.id, {
      upcoming,
      limit: LIST_LIMIT,
    });
    return formatActivities(
      `${upcoming ? 'Próximas entregas' : 'Actividades'} — ${target.course.name}`,
      page.items
    );
  }

  private async result(link: TelegramLinkEntity, arg: string) {
    const target = await this.resolveCourse(link);
    if ('message' in target) return target.message;
    // Same ordering as /actividades, so the number the student saw selects the same activity.
    const page = await this.queries.activities(link.userId, target.course.id, {
      limit: LIST_LIMIT,
    });
    const i = index(arg, page.items.length);
    if (i === null) return 'Indica el número de la actividad de /actividades. Ej.: /resultado 2';
    return formatResult(
      (await this.queries.result(link.userId, target.course.id, page.items[i].id)) as any
    );
  }

  private async ask(link: TelegramLinkEntity, text: string) {
    if (text.length > 1000) return 'Tu pregunta supera 1000 caracteres. Hazla más corta.';
    const target = await this.resolveCourse(link);
    if ('message' in target) return target.message;
    const answer = await this.assistant.ask(target.course.id, link.userId, text);
    return formatAnswer(answer, String(this.config.get('FRONTEND_URL', '')));
  }

  private explain(error: unknown): string {
    if (error instanceof ForbiddenException) return DENIED;
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const message = typeof response === 'string' ? response : (response as any)?.message;
      if (typeof message === 'string') return message;
    }
    this.logger.error(
      `Fallo procesando un mensaje de Telegram: ${error instanceof Error ? error.message : 'desconocido'}`
    );
    return GENERIC_ERROR;
  }
}
