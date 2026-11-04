import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TELEGRAM_QUEUE, TelegramJobData } from './telegram.constants';
import { TelegramBotService } from './telegram-bot.service';

@Processor(TELEGRAM_QUEUE, { concurrency: 4 })
export class TelegramProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramProcessor.name);

  constructor(private readonly bot: TelegramBotService) {
    super();
  }

  async process(job: Job<TelegramJobData>): Promise<void> {
    try {
      await this.bot.handle(job.data);
    } catch (error) {
      // Message bodies may hold link codes or questions: log only the failure reason.
      this.logger.error(
        `No se pudo responder la actualización ${job.data.updateId}: ${error instanceof Error ? error.message : 'desconocido'}`
      );
    }
  }
}
