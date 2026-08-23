// Decorators/GraphQl
import { Field, Float, Int, InputType } from '@nestjs/graphql';
// Validators
import {
  Equals,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
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

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int, { description: 'Max points' })
  @IsInt({ message: 'El máximo de puntos debe ser un número entero.' })
  @Equals(5, { message: 'Cada criterio se califica en la escala de 0.0 a 5.0.' })
  maxPoints: number = 5;

  @Field(() => Float, { description: 'Percentage contribution to the final grade' })
  @IsNumber({ maxDecimalPlaces: 2 })
  weight: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

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
