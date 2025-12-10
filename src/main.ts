// NestJS
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
// Swagger
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// App
import { AppModule } from './app.module';
import helmet from 'helmet';
import { envs } from './config';

async function bootstrap() {
  const logger = new Logger('AuraGrade API');
  const app = await NestFactory.create(AppModule);
  app.use(
    helmet({
      contentSecurityPolicy: false, // Permite Apollo Sandbox en /graphql
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  app.enableCors({
    origin: process.env.HOST_CLIENT,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
    allowedHeaders: 'Content-Type, Authorization, X-Requested-With',
  });

  const config = new DocumentBuilder()
    .setTitle('AuraGrade RESTFul API')
    .setDescription('AuraGrade endpoints')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('API', app, document);

  await app.listen(`${envs.port}`);
  logger.log(`App runnig on port ${envs.port}`);
}
bootstrap();
