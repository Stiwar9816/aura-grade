import { randomBytes } from 'crypto';

export const randomPassword = (): string => randomBytes(24).toString('base64url');
