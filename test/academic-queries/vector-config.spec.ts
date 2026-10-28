const { vectorSslOptions } = require('../../scripts/vector-config.cjs');

describe('vector preflight TLS matches application defaults', () => {
  it('requires TLS in production when SSL mode is omitted', () => {
    expect(vectorSslOptions({ STATE: 'prod' })).toEqual({ rejectUnauthorized: false });
  });
  it('allows local development without TLS by default', () => {
    expect(vectorSslOptions({ STATE: 'dev' })).toBe(false);
  });
  it('honors explicit require and disable modes', () => {
    expect(vectorSslOptions({ STATE: 'dev', DB_SSL_MODE: 'require' })).toEqual({
      rejectUnauthorized: false,
    });
    expect(vectorSslOptions({ STATE: 'prod', DB_SSL_MODE: 'disable' })).toBe(false);
  });
});
