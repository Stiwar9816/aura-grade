import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RubricAcademicLevel } from '../../enums';

@InputType()
export class GenerateRubricInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(12000)
  taskDescription: string;

  @Field(() => RubricAcademicLevel)
  @IsEnum(RubricAcademicLevel)
  academicLevel: RubricAcademicLevel;

  @Field(() => Int, { nullable: true, defaultValue: 4 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(8)
  criterionCount?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalInstructions?: string;
}
