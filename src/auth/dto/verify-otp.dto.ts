import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ description: 'Opaque, short-lived two-factor challenge token' })
  @IsString()
  @Length(32, 128)
  challengeToken: string;

  @ApiProperty({ description: 'Six-digit code from the authenticator application' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código debe tener exactamente 6 dígitos.' })
  otp: string;
}
