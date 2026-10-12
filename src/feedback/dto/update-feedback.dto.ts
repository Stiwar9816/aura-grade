import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FeedbackStatus } from '../feedback.enums';

export class UpdateFeedbackDto {
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
