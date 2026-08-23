import { Field, Float, ObjectType } from '@nestjs/graphql';
import { RubricAcademicLevel, RubricPerformanceLevel } from '../enums';

@ObjectType()
export class GeneratedRubricLevelType {
  @Field(() => String)
  label: RubricPerformanceLevel;

  @Field(() => Float)
  minScore: number;

  @Field(() => Float)
  maxScore: number;

  @Field(() => String)
  description: string;
}

@ObjectType()
export class GeneratedRubricCriterionType {
  @Field(() => String)
  title: string;

  @Field(() => String)
  description: string;

  @Field(() => Float)
  weight: number;

  @Field(() => [GeneratedRubricLevelType])
  levels: GeneratedRubricLevelType[];
}

@ObjectType()
export class GeneratedRubricType {
  @Field(() => String)
  title: string;

  @Field(() => String)
  description: string;

  @Field(() => RubricAcademicLevel)
  academicLevel: RubricAcademicLevel;

  @Field(() => [GeneratedRubricCriterionType])
  criteria: GeneratedRubricCriterionType[];

  @Field(() => String)
  generationToken: string;
}
