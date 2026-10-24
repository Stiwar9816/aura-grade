import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';
import { UserRoles } from '../auth/enums';
import { JwtAuthGuard } from '../auth/guards';
import type { User } from '../user/entities/user.entity';
import { CourseDocumentsService } from './course-documents.service';
import {
  CreateCourseDocumentDto,
  DocumentListDto,
  ReviewDocumentVersionDto,
} from './dto/document.dto';
import { DocumentUpload, MAX_DOCUMENT_BYTES } from './document-extraction.service';

@ApiTags('Biblioteca oficial')
@Controller('courses/:courseId/documents')
@UseGuards(JwtAuthGuard)
export class CourseDocumentsController {
  constructor(private readonly documents: CourseDocumentsService) {}

  @Post()
  create(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser([UserRoles.Docente]) actor: User,
    @Body() input: CreateCourseDocumentDto
  ) {
    return this.documents.create(courseId, actor, input);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() actor: User,
    @Query() query: DocumentListDto
  ) {
    return this.documents.list(courseId, actor, query.page, query.limit);
  }

  @Get(':documentId/versions')
  @Header('Cache-Control', 'no-store')
  versions(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() actor: User,
    @Query() query: DocumentListDto
  ) {
    return this.documents.listVersions(courseId, documentId, actor, query.page, query.limit);
  }

  @Post(':documentId/versions')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 0, parts: 1 },
    })
  )
  upload(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser([UserRoles.Docente]) actor: User,
    @UploadedFile() file: DocumentUpload,
    @Headers('idempotency-key') key: string
  ) {
    return this.documents.upload(courseId, documentId, actor, file, key);
  }

  @Get(':documentId/versions/:versionId')
  @Header('Cache-Control', 'no-store')
  detail(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() actor: User
  ) {
    return this.documents.detail(courseId, documentId, versionId, actor);
  }

  @Get(':documentId/versions/:versionId/download')
  @Header('Cache-Control', 'no-store')
  async download(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() actor: User
  ) {
    return { url: await this.documents.download(courseId, documentId, versionId, actor) };
  }

  @Post(':documentId/versions/:versionId/review')
  review(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser([UserRoles.Docente]) actor: User,
    @Body() input: ReviewDocumentVersionDto
  ) {
    return this.documents.review(courseId, documentId, versionId, actor, input);
  }

  @Post(':documentId/versions/:versionId/publish')
  publish(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser([UserRoles.Docente]) actor: User
  ) {
    return this.documents.publish(courseId, documentId, versionId, actor);
  }

  @Post(':documentId/archive')
  archive(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser([UserRoles.Docente]) actor: User
  ) {
    return this.documents.archive(courseId, documentId, actor);
  }
}
