import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppDataSource } from '../config/datasource.config';
import { SeedService } from './seed.service';

const logger = new Logger('DevelopmentSeed');

async function runSeed() {
  await AppDataSource.initialize();

  try {
    const result = await new SeedService(AppDataSource, new ConfigService()).executeSeed();
    logger.log(result);
  } finally {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }
}

void runSeed().catch((error: unknown) => {
  logger.error(
    error instanceof Error ? error.message : 'Error desconocido al cargar los datos iniciales.'
  );
  process.exitCode = 1;
});
