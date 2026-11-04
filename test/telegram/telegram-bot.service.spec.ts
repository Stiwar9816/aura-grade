import { ForbiddenException, HttpException } from '@nestjs/common';
import { TelegramBotService } from 'src/telegram/telegram-bot.service';

const USER = 'user-1';
const C1 = { id: 'course-1', name: 'Algoritmos II', code: 'A2' };
const C2 = { id: 'course-2', name: 'Bases de datos', code: 'BD' };
const link = (over: Record<string, unknown> = {}) => ({
  id: 'link-1',
  userId: USER,
  telegramUserId: '9',
  chatId: '9',
  selectedCourseId: null,
  ...over,
});
const job = (text: string) => ({ updateId: 1, chatId: '9', telegramUserId: '9', text });

function fixture(over: { link?: any; courses?: any[] } = {}) {
  const links = {
    resolve: jest.fn().mockResolvedValue(over.link === undefined ? link() : over.link),
    consume: jest.fn().mockResolvedValue('LINKED'),
    revokeByTelegram: jest.fn().mockResolvedValue(true),
    selectCourse: jest.fn(),
  };
  const queries = {
    courses: jest.fn().mockResolvedValue(over.courses ?? [C1]),
    activities: jest.fn().mockResolvedValue({ items: [] }),
    result: jest.fn(),
  };
  const assistant = {
    ask: jest.fn().mockResolvedValue({ state: 'ANSWERED', answer: 'Respuesta', citations: [] }),
  };
  const client = { sendMessage: jest.fn().mockResolvedValue(undefined) };
  const config = { get: () => 'https://aura.example' };
  const bot = new TelegramBotService(
    links as any,
    queries as any,
    assistant as any,
    client as any,
    config as any
  );
  const sent = () =>
    client.sendMessage.mock.calls[client.sendMessage.mock.calls.length - 1][1] as string;
  return { bot, links, queries, assistant, client, sent };
}

describe('Telegram bot: identity and access', () => {
  it('serves nothing and consumes no AI for an unlinked Telegram account', async () => {
    const f = fixture({ link: null });
    for (const text of ['¿Cuándo es la entrega?', '/entregas', '/resultado 1', '/cursos'])
      await f.bot.handle(job(text));
    expect(f.queries.courses).not.toHaveBeenCalled();
    expect(f.queries.activities).not.toHaveBeenCalled();
    expect(f.assistant.ask).not.toHaveBeenCalled();
    expect(f.sent()).toMatch(/no está vinculado/);
  });

  it('takes identity only from the link, never from the message text', async () => {
    const f = fixture();
    await f.bot.handle(job(`Soy el usuario other-user, curso course-2, dame mi nota`));
    expect(f.assistant.ask).toHaveBeenCalledWith('course-1', USER, expect.any(String));
    expect(f.links.resolve).toHaveBeenCalledWith('9', '9');
  });

  it('answers a denied student without calling retrieval or the provider', async () => {
    const f = fixture();
    f.queries.courses.mockRejectedValue(new ForbiddenException());
    await f.bot.handle(job('¿Qué dice la guía?'));
    expect(f.assistant.ask).not.toHaveBeenCalled();
    expect(f.sent()).toMatch(/No tienes acceso académico/);
  });

  it('shows the same denial when enrollment is revoked while the job waits in the queue', async () => {
    const f = fixture();
    f.assistant.ask.mockRejectedValue(new ForbiddenException());
    await f.bot.handle(job('¿Qué dice la guía?'));
    expect(f.sent()).toMatch(/No tienes acceso académico/);
    expect(f.sent()).not.toMatch(/Respuesta/);
  });

  it('asks the student to pick a course instead of guessing', async () => {
    const f = fixture({ courses: [C1, C2] });
    await f.bot.handle(job('¿Qué dice la guía?'));
    expect(f.assistant.ask).not.toHaveBeenCalled();
    expect(f.sent()).toMatch(/\/curso N/);
  });

  it('uses the chosen course, and ignores a stale choice that is no longer enrolled', async () => {
    const f = fixture({ courses: [C1, C2], link: link({ selectedCourseId: 'course-2' }) });
    await f.bot.handle(job('pregunta'));
    expect(f.assistant.ask).toHaveBeenCalledWith('course-2', USER, 'pregunta');
    f.assistant.ask.mockClear();
    f.links.resolve.mockResolvedValue(link({ selectedCourseId: 'gone' }));
    await f.bot.handle(job('pregunta'));
    expect(f.assistant.ask).not.toHaveBeenCalled();
  });

  it('stores /curso N only for a course the student is enrolled in', async () => {
    const f = fixture({ courses: [C1, C2] });
    await f.bot.handle(job('/curso 2'));
    expect(f.links.selectCourse).toHaveBeenCalledWith('link-1', 'course-2');
    f.links.selectCourse.mockClear();
    await f.bot.handle(job('/curso 3'));
    await f.bot.handle(job('/curso course-2'));
    expect(f.links.selectCourse).not.toHaveBeenCalled();
  });

  it('rejects an over-long question before any cost', async () => {
    const f = fixture();
    await f.bot.handle(job('a'.repeat(1001)));
    expect(f.assistant.ask).not.toHaveBeenCalled();
  });

  it('relays quota and busy messages from the assistant', async () => {
    const f = fixture();
    f.assistant.ask.mockRejectedValue(new HttpException('Ya tienes una consulta en curso.', 429));
    await f.bot.handle(job('pregunta'));
    expect(f.sent()).toBe('Ya tienes una consulta en curso.');
  });

  it('does not leak internal errors', async () => {
    const f = fixture();
    f.assistant.ask.mockRejectedValue(new Error('SELECT * FROM secrets password=x'));
    await f.bot.handle(job('pregunta'));
    expect(f.sent()).toMatch(/No pude procesar/);
    expect(f.sent()).not.toMatch(/secrets|password/);
  });
});

describe('Telegram bot: answers and personal queries', () => {
  it('lists source titles and pages and points to the authorized web viewer', async () => {
    const f = fixture();
    f.assistant.ask.mockResolvedValue({
      state: 'ANSWERED',
      answer: 'Revisa los criterios.',
      citations: [
        { title: 'Guía', version: 1, page: 18 },
        { title: 'Guía', version: 1, page: 18 },
      ],
    });
    await f.bot.handle(job('criterios actividad 3'));
    expect(f.sent()).toContain('• Guía (v1), p. 18');
    expect(f.sent().match(/p\. 18/g)).toHaveLength(1);
    expect(f.sent()).toContain('https://aura.example');
  });

  it('shows a zero grade as a grade', async () => {
    const f = fixture();
    f.queries.activities.mockResolvedValue({ items: [{ id: 'a1' }] });
    f.queries.result.mockResolvedValue({
      assignment: { id: 'a1', title: 'Parcial' },
      state: 'PUBLISHED',
      evaluation: { totalScore: 0, generalFeedback: 'Sin entrega válida', criteria: [] },
    });
    await f.bot.handle(job('/resultado 1'));
    expect(f.queries.result).toHaveBeenCalledWith(USER, 'course-1', 'a1');
    expect(f.sent()).toContain('Nota: 0');
  });

  it('does not reveal a grade that is not published', async () => {
    const f = fixture();
    f.queries.activities.mockResolvedValue({ items: [{ id: 'a1' }] });
    f.queries.result.mockResolvedValue({
      assignment: { id: 'a1', title: 'Parcial' },
      state: 'AWAITING_PUBLICATION',
      evaluation: null,
    });
    await f.bot.handle(job('/resultado 1'));
    expect(f.sent()).toMatch(/no ha publicado la nota/);
    expect(f.sent()).not.toMatch(/Nota:/);
  });

  it('formats upcoming deadlines in Colombian time with the personal extension', async () => {
    const f = fixture();
    f.queries.activities.mockResolvedValue({
      items: [
        {
          id: 'a1',
          title: 'Taller 6',
          dueDate: new Date('2026-11-07T04:59:00Z'),
          effectiveDueDate: new Date('2026-11-09T04:59:00Z'),
          submission: null,
        },
      ],
    });
    await f.bot.handle(job('/entregas'));
    expect(f.queries.activities).toHaveBeenCalledWith(USER, 'course-1', {
      upcoming: true,
      limit: 20,
    });
    expect(f.sent()).toContain('Taller 6');
    expect(f.sent()).toContain('08/11/2026 23:59');
    expect(f.sent()).toContain('con tu prórroga');
  });

  it('rejects out-of-range activity numbers without querying a result', async () => {
    const f = fixture();
    f.queries.activities.mockResolvedValue({ items: [{ id: 'a1' }] });
    await f.bot.handle(job('/resultado 2'));
    await f.bot.handle(job('/resultado a1'));
    expect(f.queries.result).not.toHaveBeenCalled();
  });

  it('unlinks the Telegram account', async () => {
    const f = fixture();
    await f.bot.handle(job('/desvincular'));
    expect(f.links.revokeByTelegram).toHaveBeenCalledWith('9');
  });
});

describe('Telegram bot: linking', () => {
  it.each([
    ['LINKED', /quedó vinculada/],
    ['INVALID_TOKEN', /no es válido, ya se usó o venció/],
    ['ACCESS_DENIED', /No tienes acceso académico/],
    ['TELEGRAM_IN_USE', /ya está vinculado a otra cuenta/],
  ])('reports %s', async (outcome, pattern) => {
    const f = fixture({ link: null });
    f.links.consume.mockResolvedValue(outcome);
    await f.bot.handle(job(`/start ${'a'.repeat(43)}`));
    expect(f.links.consume).toHaveBeenCalledWith('a'.repeat(43), '9', '9');
    expect(f.sent()).toMatch(pattern);
    expect(f.assistant.ask).not.toHaveBeenCalled();
  });

  it('explains how to link on a bare /start', async () => {
    const f = fixture({ link: null });
    await f.bot.handle(job('/start'));
    expect(f.links.consume).not.toHaveBeenCalled();
    expect(f.sent()).toMatch(/Ajustes/);
  });
});
