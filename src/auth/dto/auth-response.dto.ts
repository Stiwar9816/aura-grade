import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/user/entities/user.entity';

export class AuthResponse {
  @ApiProperty({ type: User, required: false })
  user?: User;

  @ApiProperty({
    description: 'Opaque session token',
    example: 'a-random-opaque-session-token',
    required: false,
  })
  sessionToken?: string;

  @ApiProperty({ description: 'Indica que falta validar el segundo factor', required: false })
  requiresTwoFactor?: boolean;

  @ApiProperty({ description: 'Indica que el administrador debe enrolar TOTP', required: false })
  requiresTwoFactorSetup?: boolean;

  @ApiProperty({ description: 'Desafío opaco y temporal para validar TOTP', required: false })
  challengeToken?: string;

  @ApiProperty({
    description: 'Clave TOTP mostrada únicamente durante el enrolamiento',
    required: false,
  })
  setupKey?: string;

  @ApiProperty({ description: 'URI para configurar una aplicación autenticadora', required: false })
  otpAuthUri?: string;

  @ApiProperty({
    description: 'La sesión debe persistir entre reinicios del navegador',
    required: false,
  })
  rememberMe?: boolean;

  @ApiProperty({ description: 'Fecha absoluta de expiración de la sesión', required: false })
  expiresAt?: string;

  @ApiProperty({ description: 'El registro requiere aprobación institucional', required: false })
  pendingApproval?: boolean;

  @ApiProperty({ required: false })
  message?: string;
}
