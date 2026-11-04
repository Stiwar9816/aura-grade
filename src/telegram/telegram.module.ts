import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicAccessModule } from '../academic-access/academic-access.module';
import { AcademicQueriesModule } from '../academic-queries/academic-queries.module';
import { CourseAssistantModule } from '../course-assistant/course-assistant.module';
import { TelegramLinkEntity } from './entities/telegram-link.entity';
import { TelegramLinkTokenEntity } from './entities/telegram-link-token.entity';
import { TELEGRAM_QUEUE } from './telegram.constants';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramClient } from './telegram-client';
import { TelegramLinkController, TelegramWebhookController } from './telegram.controller';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramProcessor } from './telegram.processor';
import { TelegramUpdatesService } from './telegram-updates.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramLinkEntity, TelegramLinkTokenEntity]),
    AcademicAccessModule,
    AcademicQueriesModule,
    CourseAssistantModule,
    BullModule.registerQueue({ name: TELEGRAM_QUEUE }),
    BullBoardModule.forFeature({ name: TELEGRAM_QUEUE, adapter: BullMQAdapter }),
  ],
  controllers: [TelegramWebhookController, TelegramLinkController],
  providers: [
    TelegramClient,
    TelegramLinkService,
    TelegramUpdatesService,
    TelegramBotService,
    TelegramProcessor,
  ],
})
export class TelegramModule {}
