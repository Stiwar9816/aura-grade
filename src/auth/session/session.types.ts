export interface SessionDevice {
  browser: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  ipAddress?: string;
  name: string;
  operatingSystem: string;
}

export interface StoredSession {
  authenticationLevel: 'mfa' | 'password';
  device?: SessionDevice;
  userId: string;
  createdAt: number;
  lastActivityAt: number;
  mfaExpiresAt: number;
  mfaVerifiedAt: number;
  absoluteExpiresAt: number;
  rememberMe: boolean;
  authVersion: number;
}

export interface CreatedSession {
  sessionToken: string;
  expiresAt: string;
}

export interface ActiveSession {
  absoluteExpiresAt: string;
  browser: string;
  createdAt: string;
  current: boolean;
  deviceType: SessionDevice['deviceType'];
  id: string;
  ipAddress?: string;
  lastActivityAt: string;
  mfaExpiresAt: string;
  name: string;
  operatingSystem: string;
  rememberMe: boolean;
}
