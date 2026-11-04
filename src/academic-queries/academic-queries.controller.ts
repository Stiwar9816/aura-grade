import { Controller, Get, Header, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import { UserRoles } from '../auth/enums';
import { JwtAuthGuard } from '../auth/guards';
import { User } from '../user/entities/user.entity';
import { AcademicQueriesService } from './academic-queries.service';
import { AcademicActivityQueryDto } from './dto/academic-activity-query.dto';

@Controller('courses/:courseId/academic-queries')
@UseGuards(JwtAuthGuard)
export class AcademicQueriesController {
  constructor(private readonly queries: AcademicQueriesService) {}

  @Get('activities')
  @Header('Cache-Control', 'no-store')
  activities(
    @CurrentUser([UserRoles.Estudiante]) actor: User,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: AcademicActivityQueryDto
  ) {
    return this.queries.activities(actor.id, courseId, query);
  }

  @Get('activities/:assignmentId/result')
  @Header('Cache-Control', 'no-store')
  result(
    @CurrentUser([UserRoles.Estudiante]) actor: User,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string
  ) {
    return this.queries.result(actor.id, courseId, assignmentId);
  }
}
