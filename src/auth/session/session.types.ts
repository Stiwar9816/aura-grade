export interface StoredSession {
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
