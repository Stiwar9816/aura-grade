import { parseCommand, parseUpdate } from 'src/telegram/telegram-update';

const message = (over: Record<string, unknown> = {}, chat: Record<string, unknown> = {}) => ({
  update_id: 10,
  message: {
    text: ' hola ',
    from: { id: 77, is_bot: false },
    chat: { id: 77, type: 'private', ...chat },
    ...over,
  },
});

describe('Telegram update parsing', () => {
  it('accepts a private text message and trims it', () => {
    expect(parseUpdate(message())).toEqual({
      updateId: 10,
      chatId: '77',
      telegramUserId: '77',
      text: 'hola',
    });
  });

  it.each([
    ['group', message({}, { type: 'group', id: -5 })],
    ['supergroup', message({}, { type: 'supergroup' })],
    ['channel', message({}, { type: 'channel' })],
    ['bot sender', message({ from: { id: 77, is_bot: true } })],
    ['sender is not the chat', message({ from: { id: 78, is_bot: false } })],
    ['no text (photo)', message({ text: undefined })],
    ['blank text', message({ text: '   ' })],
    ['oversized text', message({ text: 'a'.repeat(4097) })],
    ['edited message', { update_id: 11, edited_message: message().message }],
    ['callback query', { update_id: 12, callback_query: {} }],
    ['missing update id', { message: message().message }],
    ['non-integer id', { ...message(), update_id: 1.5 }],
    ['string body', 'x'],
    ['null body', null],
  ])('ignores %s', (_name, body) => {
    expect(parseUpdate(body)).toBeNull();
  });
});

describe('Telegram command parsing', () => {
  it('parses commands, bot suffix and arguments', () => {
    expect(parseCommand('/start abc')).toEqual({ name: 'start', args: 'abc' });
    expect(parseCommand('/Curso@AuraBot 2')).toEqual({ name: 'curso', args: '2' });
    expect(parseCommand('/cursos')).toEqual({ name: 'cursos', args: '' });
  });
  it('treats free text as a question', () => {
    expect(parseCommand('¿Cuándo es la entrega?')).toBeNull();
    expect(parseCommand('hola /start')).toBeNull();
  });
});
