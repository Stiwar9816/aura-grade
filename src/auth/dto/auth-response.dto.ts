import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/user/entities/user.entity';

export class AuthResponse {
  @ApiProperty({ type: User })
  user: User;

  @ApiProperty({
    description: 'Temporary alias for sessionToken',
    example: 'a-random-opaque-session-token',
  })
  token: string;

  @ApiProperty({
    description: 'Opaque session token',
    example: 'a-random-opaque-session-token',
  })
  sessionToken: string;

  @ApiProperty({ description: 'Absolute session expiration date' })
  expiresAt: string;
}
