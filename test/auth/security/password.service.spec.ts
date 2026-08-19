import * as bcrypt from 'bcryptjs';
import { PasswordService } from 'src/auth/security';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes new passwords with scrypt and verifies the complete value', async () => {
    const password = 'correct horse battery staple with unicode 🔐';
    const encoded = await service.hash(password);

    expect(encoded).toMatch(/^scrypt\$/);
    await expect(service.verify(password, encoded)).resolves.toBe(true);
    await expect(service.verify(`${password}x`, encoded)).resolves.toBe(false);
  });

  it('does not truncate values beyond the historical bcrypt 72-byte boundary', async () => {
    const prefix = 'a'.repeat(80);
    const encoded = await service.hash(`${prefix}first`);

    await expect(service.verify(`${prefix}second`, encoded)).resolves.toBe(false);
  });

  it('accepts a legacy bcrypt hash and marks it for transparent migration', async () => {
    const legacy = bcrypt.hashSync('LegacyPassword123!', 10);

    await expect(service.verify('LegacyPassword123!', legacy)).resolves.toBe(true);
    expect(service.needsRehash(legacy)).toBe(true);
  });
});
