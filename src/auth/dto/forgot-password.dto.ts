import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Correo electrónico asociado a la cuenta',
    example: 'admin@aura.edu.co',
  })
  @IsString()
  @IsEmail()
  email: string;
}
