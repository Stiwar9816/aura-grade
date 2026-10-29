import { Module } from '@nestjs/common';
import { AcademicAccessModule } from '../academic-access/academic-access.module';
import { CourseDocumentsModule } from '../course-documents/course-documents.module';
import { CourseAssistantController } from './course-assistant.controller';
import { CourseAssistantService } from './course-assistant.service';
import { RagStore } from './rag-store';
import { RagBudget } from './rag-budget';
import { RagProvider } from './rag-provider';
@Module({
  imports: [AcademicAccessModule, CourseDocumentsModule],
  controllers: [CourseAssistantController],
  providers: [CourseAssistantService, RagStore, RagBudget, RagProvider],
  exports: [CourseAssistantService],
})
export class CourseAssistantModule {}
