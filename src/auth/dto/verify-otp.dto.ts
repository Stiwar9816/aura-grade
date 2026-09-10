import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ description: 'Opaque, short-lived two-factor challenge token' })
  @IsString()
  @Length(32, 128)
  challengeToken: string;

  @ApiProperty({ description: 'Six-digit code from the authenticator application' })
  @IsString()
  @Matches(/^(?:\d{6}|[a-fA-F0-9]{24})$/, {
    message:
      'Introduce los 6 dígitos del autenticador o un código de recuperación de 24 caracteres.',
  })
  otp: string;
}

export class RecoveryCodesDto {
  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;
}
