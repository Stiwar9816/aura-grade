import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { normalizePassword } from './password-policy';

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const PREFIX = 'scrypt';

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await this.derive(normalizePassword(password), salt, {
      N: COST,
      r: BLOCK_SIZE,
      p: PARALLELIZATION,
    });
    return [
      PREFIX,
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString('base64url'),
      derived.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    if (!encodedHash.startsWith(`${PREFIX}$`))
      return bcrypt.compare(normalizePassword(password), encodedHash);

    const [prefix, cost, blockSize, parallelization, saltValue, hashValue, extra] =
      encodedHash.split('$');
    if (
      prefix !== PREFIX ||
      extra !== undefined ||
      !cost ||
      !blockSize ||
      !parallelization ||
      !saltValue ||
      !hashValue
    )
      return false;

    const expected = Buffer.from(hashValue, 'base64url');
    if (expected.length !== KEY_LENGTH) return false;
    try {
      const derived = await this.derive(
        normalizePassword(password),
        Buffer.from(saltValue, 'base64url'),
        {
          N: Number(cost),
          r: Number(blockSize),
          p: Number(parallelization),
        }
      );
      return timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }

  needsRehash(encodedHash: string): boolean {
    return !encodedHash.startsWith(`${PREFIX}$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$`);
  }

  private derive(
    password: string,
    salt: Buffer,
    options: { N: number; p: number; r: number }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scryptCallback(
        password,
        salt,
        KEY_LENGTH,
        { ...options, maxmem: 64 * 1024 * 1024 },
        (error, derivedKey) => (error ? reject(error) : resolve(derivedKey))
      );
    });
  }
}
