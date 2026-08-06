import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { AuditProcessor } from './audit.processor';
import { AuditQueueEvents } from './audit-queue.events';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    BullModule.registerQueue({
      name: 'audit',
    }),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditProcessor, AuditQueueEvents],
  exports: [AuditService],
})
export class AuditModule {}
