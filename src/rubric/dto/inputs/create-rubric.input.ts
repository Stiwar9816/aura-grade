import { InputType, Field, Float, ID } from '@nestjs/graphql';
// Validators
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
// Dto
import { CreateCriterionInput } from 'src/criterion/dto';

@InputType()
export class CreateRubricInput {
  @IsString()
  @Field(() => String, { description: 'Title of the rubric' })
  title: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Field(() => Float, { description: 'Max total score of the rubric' })
  maxTotalScore: number;

  // 1. Añadir el campo de criterios para que el servicio lo reconozca
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateCriterionInput)
  @Field(() => [CreateCriterionInput], { nullable: true, description: 'List of criteria' })
  criteria?: CreateCriterionInput[];

  // 2. Añadir el ID del usuario (profesor) que crea la rúbrica
  @IsUUID()
  @Field(() => ID, { description: 'Owner User ID' })
  userId: string;
}
