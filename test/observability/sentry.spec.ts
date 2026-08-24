const mockInit = jest.fn();
const mockCaptureException = jest.fn();
const mockScope = { setExtras: jest.fn(), setTag: jest.fn(), setUser: jest.fn() };
const mockWithScope = jest.fn((callback: (scope: typeof mockScope) => void) => callback(mockScope));
const mockConsoleLoggingIntegration = jest.fn(() => ({ name: 'ConsoleLogging' }));

jest.mock('@sentry/nestjs', () => ({
  init: mockInit,
  captureException: mockCaptureException,
  consoleLoggingIntegration: mockConsoleLoggingIntegration,
  withScope: mockWithScope,
}));

describe('Sentry integration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stays disabled in tests and removes sensitive event data', () => {
    jest.isolateModules(() => require('src/instrument'));

    const options = mockInit.mock.calls[0][0];
    expect(options.enabled).toBe(false);
    expect(mockConsoleLoggingIntegration).toHaveBeenCalledWith({
      levels: ['log', 'warn', 'error'],
    });

    const event = options.beforeSend({
      request: {
        url: 'https://api.example.com/reset?token=visible-secret',
        data: { password: 'visible-secret' },
        cookies: { session: 'visible-secret' },
        query_string: 'token=visible-secret',
        headers: {
          Authorization: 'Bearer visible-token',
          Cookie: 'session=visible-secret',
          'Content-Type': 'application/json',
        },
      },
      user: { id: 'user-id', email: 'student@example.com', ip_address: '127.0.0.1' },
      extra: {
        password: 'visible-secret',
        detail: 'Bearer visible-token',
      },
      exception: { values: [{ value: 'api_key=visible-secret' }] },
    });

    expect(event.request.data).toBeUndefined();
    expect(event.request.cookies).toBeUndefined();
    expect(event.request.query_string).toBeUndefined();
    expect(event.request.url).toBe('https://api.example.com/reset');
    expect(event.request.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(event.user).toEqual({ id: 'user-id' });
    expect(event.extra).toEqual({ password: '[Filtered]', detail: '[Filtered]' });
    expect(event.exception.values[0].value).toBe('[Filtered]');

    const log = options.beforeSendLog({
      level: 'error',
      message: 'Redis password=visible-secret',
      attributes: { apiKey: 'visible-secret' },
    });
    expect(log.message).toBe('Redis [Filtered]');
    expect(log.attributes).toEqual({ apiKey: '[Filtered]' });
  });

  it('reports exhausted jobs with operational tags and no provider failure text', () => {
    const { captureExhaustedQueueJob } = require('src/observability/sentry-reporter');

    captureExhaustedQueueJob('grading', 'job-id', 5, { failure_category: 'AI unavailable' });

    expect(mockScope.setTag).toHaveBeenCalledWith('queue', 'grading');
    expect(mockScope.setTag).toHaveBeenCalledWith('job_id', 'job-id');
    expect(mockScope.setTag).toHaveBeenCalledWith('attempts', 5);
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));
    expect(mockCaptureException.mock.calls[0][0].message).toBe(
      'El trabajo de la cola grading agotó sus reintentos.'
    );
  });

  it('adds safe request context without user email data', () => {
    const { captureOperationalException } = require('src/observability/sentry-reporter');

    captureOperationalException(
      new Error('controlled'),
      { status_code: 503 },
      { userId: 'user-id', extras: { request_id: 'request-id' } }
    );

    expect(mockScope.setUser).toHaveBeenCalledWith({ id: 'user-id' });
    expect(mockScope.setExtras).toHaveBeenCalledWith({ request_id: 'request-id' });
  });
});
