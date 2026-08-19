import { trustedClientIp, trustedClientUserAgent } from 'src/common/security';

describe('trustedClientIp', () => {
  it('uses the forwarded client address only for an authenticated BFF request', () => {
    expect(
      trustedClientIp({
        headers: { 'x-client-ip': '203.0.113.8' },
        ip: '127.0.0.1',
        isTrustedBff: true,
      })
    ).toBe('203.0.113.8');
  });

  it('ignores spoofed or invalid forwarded addresses', () => {
    expect(
      trustedClientIp({
        headers: { 'x-client-ip': '203.0.113.8' },
        ip: '127.0.0.1',
        isTrustedBff: false,
      })
    ).toBe('127.0.0.1');
    expect(
      trustedClientIp({
        headers: { 'x-client-ip': 'not-an-ip' },
        ip: '127.0.0.1',
        isTrustedBff: true,
      })
    ).toBe('127.0.0.1');
  });
});

describe('trustedClientUserAgent', () => {
  it('uses the forwarded browser only for an authenticated BFF request', () => {
    expect(
      trustedClientUserAgent({
        headers: {
          'user-agent': 'Servidor BFF',
          'x-client-user-agent': 'Mozilla/5.0 Chrome/140.0',
        },
        isTrustedBff: true,
      })
    ).toBe('Mozilla/5.0 Chrome/140.0');
  });

  it('ignores a spoofed forwarded browser from a direct request', () => {
    expect(
      trustedClientUserAgent({
        headers: {
          'user-agent': 'Navegador directo',
          'x-client-user-agent': 'Navegador falsificado',
        },
        isTrustedBff: false,
      })
    ).toBe('Navegador directo');
  });
});
