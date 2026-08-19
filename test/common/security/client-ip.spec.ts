import { trustedClientIp } from 'src/common/security';

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
