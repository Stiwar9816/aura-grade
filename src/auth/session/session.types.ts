export interface StoredSession {
  authenticationLevel: 'mfa' | 'password';
  userId: string;
  createdAt: number;
  lastActivityAt: number;
  absoluteExpiresAt: number;
  rememberMe: boolean;
  authVersion: number;
}

export interface CreatedSession {
  sessionToken: string;
  expiresAt: string;
}
