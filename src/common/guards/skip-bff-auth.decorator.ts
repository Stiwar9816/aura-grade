import { SetMetadata } from '@nestjs/common';

export const SKIP_BFF_AUTH = 'skipBffAuth';

/** Only for third-party callbacks that authenticate themselves (e.g. Telegram's secret header). */
export const SkipBffAuth = () => SetMetadata(SKIP_BFF_AUTH, true);
