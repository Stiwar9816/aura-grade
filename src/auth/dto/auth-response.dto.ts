import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/user/entities/user.entity';

export class AuthResponse {
  @ApiProperty({ type: User })
  user: User;

  @ApiProperty({
    description: 'Temporary alias for sessionToken',
    example: 'a-random-opaque-session-token',
    required: false,
  })
  token?: string;

  @ApiProperty({
    description: 'Opaque session token',
    example: 'a-random-opaque-session-token',
    required: false,
  })
  sessionToken?: string;

  @ApiProperty({ description: 'Fecha absoluta de expiración de la sesión', required: false })
  expiresAt?: string;

  @ApiProperty({ description: 'El registro requiere aprobación institucional', required: false })
  pendingApproval?: boolean;

  @ApiProperty({ required: false })
  message?: string;
}
