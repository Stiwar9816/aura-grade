import { describeSessionDevice } from 'src/auth/session';

describe('describeSessionDevice', () => {
  it('describes a desktop Chrome session', () => {
    expect(
      describeSessionDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0 Safari/537.36',
        '203.0.113.8'
      )
    ).toEqual({
      browser: 'Chrome',
      deviceType: 'desktop',
      ipAddress: '203.0.113.8',
      name: 'Chrome en macOS',
      operatingSystem: 'macOS',
    });
  });

  it('describes a mobile Safari session', () => {
    expect(
      describeSessionDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1'
      )
    ).toEqual(
      expect.objectContaining({
        browser: 'Safari',
        deviceType: 'mobile',
        name: 'Safari en iOS',
        operatingSystem: 'iOS',
      })
    );
  });
});
