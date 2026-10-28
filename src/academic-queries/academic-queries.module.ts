import { Module } from '@nestjs/common';
import { AcademicAccessModule } from '../academic-access/academic-access.module';
import { AcademicQueriesController } from './academic-queries.controller';
import { AcademicQueriesService } from './academic-queries.service';

@Module({
  imports: [AcademicAccessModule],
  controllers: [AcademicQueriesController],
  providers: [AcademicQueriesService],
  exports: [AcademicQueriesService],
})
export class AcademicQueriesModule {}
