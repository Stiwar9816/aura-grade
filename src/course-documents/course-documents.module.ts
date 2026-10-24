import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicAccessModule } from '../academic-access/academic-access.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CourseDocument } from './entities/course-document.entity';
import { CourseDocumentVersion } from './entities/course-document-version.entity';
import { CourseDocumentsService } from './course-documents.service';
import { CourseDocumentsController } from './course-documents.controller';
import { DocumentExtractionService } from './document-extraction.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseDocument, CourseDocumentVersion]),
    AcademicAccessModule,
    CloudinaryModule,
  ],
  controllers: [CourseDocumentsController],
  providers: [CourseDocumentsService, DocumentExtractionService],
  exports: [CourseDocumentsService],
})
export class CourseDocumentsModule {}
