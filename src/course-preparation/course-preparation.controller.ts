import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards';
import { UserRoles } from '../auth/enums';
import { User } from '../user/entities/user.entity';
import { DocumentListDto } from '../course-documents/dto/document.dto';
import { ConfirmActivityDto } from './dto/confirm-activity.dto';
import { CoursePreparationService } from './course-preparation.service';
@Controller('courses/:courseId/documents/preparation')
@UseGuards(JwtAuthGuard)
export class CoursePreparationController {
  constructor(private readonly preparation: CoursePreparationService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() actor: User,
    @Query() query: DocumentListDto
  ) {
    return this.preparation.list(courseId, actor, query.page, query.limit);
  }
  @Post(':assignmentId/confirm')
  @Header('Cache-Control', 'no-store')
  confirm(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @CurrentUser([UserRoles.Docente]) actor: User,
    @Body() input: ConfirmActivityDto
  ) {
    return this.preparation.confirm(courseId, assignmentId, actor, input);
  }
}
