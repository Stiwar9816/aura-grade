import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginUserDto {
  @ApiProperty({
    description: 'User email',
    uniqueItems: true,
    nullable: false,
  })
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    nullable: false,
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;

  @ApiProperty({
    description: 'Keep the session active between browser restarts',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean = false;
}
