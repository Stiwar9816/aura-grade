import { Type } from 'class-transformer';
import { Field, Float, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RubricAcademicLevel, RubricPerformanceLevel } from '../../enums';

@InputType()
export class SaveRubricLevelInput {
  @Field(() => String)
  @IsEnum(RubricPerformanceLevel)
  label: RubricPerformanceLevel;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  description: string;
}

@InputType()
export class SaveRubricCriterionInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 })
  weight: number;

  @Field(() => [SaveRubricLevelInput])
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => SaveRubricLevelInput)
  levels: SaveRubricLevelInput[];
}

@InputType()
export class SaveRubricDraftInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @Field(() => RubricAcademicLevel)
  @IsEnum(RubricAcademicLevel)
  academicLevel: RubricAcademicLevel;

  @Field(() => [SaveRubricCriterionInput])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => SaveRubricCriterionInput)
  criteria: SaveRubricCriterionInput[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  generationToken?: string;
}
