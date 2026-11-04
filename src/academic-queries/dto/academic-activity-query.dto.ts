import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';
import { DocumentListDto } from '../../course-documents/dto/document.dto';

export class AcademicActivityQueryDto extends DocumentListDto {
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  upcoming = false;
}
