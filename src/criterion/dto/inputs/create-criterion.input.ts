// Decorators/GraphQl
import { Field, Int, InputType } from '@nestjs/graphql';
// Validators
import { IsNotEmpty, IsInt, IsString, Min, ValidateNested, IsArray, IsUUID } from 'class-validator';
// Transform
import { Type } from 'class-transformer';
// Dto
import { CreateCriterionLevelsInput } from './create-criterion-levels.input';

@InputType()
export class CreateCriterionInput {
  @Field(() => String, { description: 'Criterion title' })
  @IsNotEmpty({ message: 'El título del criterio es obligatorio.' })
  @IsString({ message: 'El título del criterio debe ser un texto.' })
  title: string;

  @Field(() => Int, { description: 'Max points' })
  @IsInt({ message: 'El máximo de puntos debe ser un número entero.' })
  @Min(1, { message: 'El máximo de puntos debe ser como mínimo 1.' })
  maxPoints: number;

  @Field(() => [CreateCriterionLevelsInput], { description: 'Criterion levels' })
  @IsArray({ message: 'Los niveles deben enviarse como una lista.' })
  @ValidateNested({ each: true })
  @Type(() => CreateCriterionLevelsInput)
  levels: CreateCriterionLevelsInput[];

  @Field(() => String, { description: 'Rubric ID' })
  @IsNotEmpty({ message: 'El identificador de la rúbrica es obligatorio.' })
  @IsUUID('4', { message: 'El identificador de la rúbrica debe ser un UUID válido.' })
  rubric: string;
}
