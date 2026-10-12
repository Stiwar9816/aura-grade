import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOnboardingDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  stepId?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsBoolean()
  dismissed?: boolean;
}
