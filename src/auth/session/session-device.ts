import { SessionDevice } from './session.types';

const browserName = (userAgent: string): string => {
  if (/Edg\//u.test(userAgent)) return 'Microsoft Edge';
  if (/OPR\//u.test(userAgent)) return 'Opera';
  if (/Firefox\//u.test(userAgent)) return 'Firefox';
  if (/CriOS\//u.test(userAgent)) return 'Chrome';
  if (/Chrome\//u.test(userAgent)) return 'Chrome';
  if (/Safari\//u.test(userAgent) && /Version\//u.test(userAgent)) return 'Safari';
  return 'Navegador desconocido';
};

const operatingSystemName = (userAgent: string): string => {
  if (/Windows NT/u.test(userAgent)) return 'Windows';
  if (/Android/u.test(userAgent)) return 'Android';
  if (/(iPhone|iPad|iPod)/u.test(userAgent)) return 'iOS';
  if (/Mac OS X/u.test(userAgent)) return 'macOS';
  if (/Linux/u.test(userAgent)) return 'Linux';
  return 'Sistema desconocido';
};

const deviceType = (userAgent: string): SessionDevice['deviceType'] => {
  if (/iPad|Tablet/u.test(userAgent)) return 'tablet';
  if (/Mobile|iPhone|iPod|Android/u.test(userAgent)) return 'mobile';
  if (userAgent) return 'desktop';
  return 'unknown';
};

export const describeSessionDevice = (userAgent?: string, ipAddress?: string): SessionDevice => {
  const safeUserAgent = userAgent?.slice(0, 512) ?? '';
  const browser = browserName(safeUserAgent);
  const operatingSystem = operatingSystemName(safeUserAgent);
  return {
    browser,
    deviceType: deviceType(safeUserAgent),
    ipAddress,
    name: `${browser} en ${operatingSystem}`,
    operatingSystem,
  };
};
