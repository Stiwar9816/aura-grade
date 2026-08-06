import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

export class PushSubscriptionKeysDto {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  @Matches(BASE64URL_PATTERN)
  p256dh: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  @Matches(BASE64URL_PATTERN)
  auth: string;
}

export class SavePushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(4096)
  endpoint: string;

  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class RemovePushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(4096)
  endpoint: string;
}
