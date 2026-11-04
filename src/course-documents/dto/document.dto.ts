import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CourseDocumentKind } from '../document.enums';

export class CreateCourseDocumentDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;
  @IsEnum(CourseDocumentKind) kind: CourseDocumentKind;
}

export class ReviewDocumentVersionDto {
  @Equals(true) confirmed: boolean;
  @Matches(/^[a-f0-9]{64}$/) contentHash: string;
}

export class DocumentListDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
