import { IsString, Matches } from 'class-validator';
import { IsStrongPassword } from '../security';
export class ResetPasswordDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token: string;

  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
