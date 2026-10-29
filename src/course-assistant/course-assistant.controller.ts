import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { CurrentUser } from '../auth/decorators';
import { UserRoles } from '../auth/enums';
import { JwtAuthGuard } from '../auth/guards';
import { User } from '../user/entities/user.entity';
import { CourseAssistantService } from './course-assistant.service';
export class AskCourseDto {
  @IsString() @Length(3, 1000) question: string;
}
@Controller('courses/:courseId/assistant')
@UseGuards(JwtAuthGuard)
export class CourseAssistantController {
  constructor(private readonly assistant: CourseAssistantService) {}
  @Get('sources')
  @Header('Cache-Control', 'no-store')
  status(
    @CurrentUser([UserRoles.Docente]) actor: User,
    @Param('courseId', ParseUUIDPipe) courseId: string
  ) {
    return this.assistant.status(courseId, actor.id);
  }
  @Post('sources/:versionId/prepare')
  @Header('Cache-Control', 'no-store')
  prepare(
    @CurrentUser([UserRoles.Docente]) actor: User,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string
  ) {
    return this.assistant.prepare(courseId, actor.id, versionId);
  }
  @Post('questions')
  @Header('Cache-Control', 'no-store')
  ask(
    @CurrentUser([UserRoles.Estudiante]) actor: User,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() body: AskCourseDto
  ) {
    return this.assistant.ask(courseId, actor.id, body.question);
  }
}
