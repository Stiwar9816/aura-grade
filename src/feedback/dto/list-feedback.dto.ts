import { IsEnum, IsOptional, Matches } from 'class-validator';
import { FeedbackStatus } from '../feedback.enums';

export class ListFeedbackDto {
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @IsOptional()
  @Matches(/^\d+$/)
  page?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  limit?: string;
}
