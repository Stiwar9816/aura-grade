import { CoursePreparationService } from '../course-preparation/course-preparation.service';
import { CoursePreparationController } from '../course-preparation/course-preparation.controller';
import { CourseActivityConfirmation } from '../course-preparation/entities/course-activity-confirmation.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicAccessModule } from '../academic-access/academic-access.module';
import { StorageModule } from '../storage/storage.module';
import { CourseDocument } from './entities/course-document.entity';
import { CourseDocumentVersion } from './entities/course-document-version.entity';
import { CourseDocumentsService } from './course-documents.service';
import { CourseDocumentsController } from './course-documents.controller';
import { DocumentExtractionService } from './document-extraction.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseDocument, CourseDocumentVersion, CourseActivityConfirmation]),
    AcademicAccessModule,
    StorageModule,
  ],
  controllers: [CourseDocumentsController, CoursePreparationController],
  providers: [CourseDocumentsService, DocumentExtractionService, CoursePreparationService],
  exports: [CourseDocumentsService],
})
export class CourseDocumentsModule {}
