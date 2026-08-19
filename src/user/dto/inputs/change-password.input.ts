import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { IsStrongPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from 'src/auth/security';

@InputType()
export class ChangePasswordInput {
  @IsString()
  @IsStrongPassword()
  @Field(() => String, {
    description: `Nueva contraseña única sin espacios de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres`,
  })
  newPassword: string;
}
