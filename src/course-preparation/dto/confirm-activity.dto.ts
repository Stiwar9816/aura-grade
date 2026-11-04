import { Equals, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
export class ConfirmActivityDto {
  @Equals(true) confirmed: boolean;
  @IsUUID() guideVersionId: string;
  @IsUUID() scheduleVersionId: string;
  @IsString() @Matches(/\S/) @MaxLength(300) guideSection: string;
  @IsString() @Matches(/\S/) @MaxLength(300) scheduleSection: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) activityHash: string;
}
