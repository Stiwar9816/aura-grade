import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

const logger = new Logger('DevelopmentSeed');

async function runSeed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const result = await app.get(SeedService).executeSeed();
    logger.log(result);
  } finally {
    await app.close();
  }
}

void runSeed().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : 'Unknown seed error');
  process.exitCode = 1;
});
