// Decorators/GraphQl
import { Field, Int, InputType } from '@nestjs/graphql';
// Validators
import { IsNotEmpty, IsInt, IsString, Min } from 'class-validator';

@InputType()
export class CreateCriterionLevelsInput {
  @Field(() => Int, { description: 'Score assigned to this level' })
  @IsInt({ message: 'La puntuación debe ser un número entero.' })
  @Min(0, { message: 'La puntuación no puede ser negativa.' })
  score: number;

  @Field(() => String, { description: 'Description of this level' })
  @IsNotEmpty({ message: 'La descripción no puede estar vacía.' })
  @IsString({ message: 'La descripción debe ser un texto.' })
  description: string;
}
