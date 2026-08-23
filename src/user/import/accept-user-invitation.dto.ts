import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { IsStrongPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../auth/security';

export class AcceptUserInvitationDto {
  @ApiProperty({ description: 'Token de invitación recibido por correo.' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'El enlace de invitación no es válido.' })
  token: string;

  @ApiProperty({
    description: 'Contraseña elegida por el usuario.',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @IsStrongPassword()
  password: string;
}
