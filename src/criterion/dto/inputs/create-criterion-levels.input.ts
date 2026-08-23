// Decorators/GraphQl
import { Field, Float, InputType } from '@nestjs/graphql';
// Validators
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { RubricPerformanceLevel } from 'src/rubric/enums';

@InputType()
export class CreateCriterionLevelsInput {
  @Field(() => Float, { description: 'Compatibility score', nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'La puntuación no puede ser negativa.' })
  @Max(5, { message: 'La puntuación no puede ser mayor que 5.0.' })
  score?: number;

  @Field(() => String)
  @IsEnum(RubricPerformanceLevel)
  label: RubricPerformanceLevel;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 })
  minScore: number;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 })
  maxScore: number;

  @Field(() => String, { description: 'Description of this level' })
  @IsNotEmpty({ message: 'La descripción no puede estar vacía.' })
  @IsString({ message: 'La descripción debe ser un texto.' })
  description: string;
}
