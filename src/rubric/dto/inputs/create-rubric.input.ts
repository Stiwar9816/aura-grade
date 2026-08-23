import { InputType, Field, Float } from '@nestjs/graphql';
// Validators
import { Equals, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { RubricAcademicLevel } from '../../enums';

@InputType()
export class CreateRubricInput {
  @IsString()
  @Field(() => String, { description: 'Title of the rubric' })
  title: string;

  @IsString()
  @IsOptional()
  @Field(() => String, { description: 'Description of the rubric', nullable: true })
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Equals(5, { message: 'La escala máxima de todas las rúbricas es 5.0.' })
  @Field(() => Float, { description: 'Max total score of the rubric', defaultValue: 5 })
  maxTotalScore: number = 5;

  @IsEnum(RubricAcademicLevel)
  @Field(() => RubricAcademicLevel, { defaultValue: RubricAcademicLevel.UNIVERSITARIO })
  academicLevel: RubricAcademicLevel = RubricAcademicLevel.UNIVERSITARIO;
}
