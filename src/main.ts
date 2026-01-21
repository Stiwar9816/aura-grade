// NestJS
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
// Swagger
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// App
import { AppModule } from './app.module';
// Helmet
import helmet from 'helmet';
// Envs
import { envs } from './config';
// GraphQL
import { graphqlUploadExpress } from 'graphql-upload-ts';
// Filters
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
// Basic Auth
import basicAuth from 'express-basic-auth';

async function bootstrap() {
  const logger = new Logger('AuraGrade API');
  const app = await NestFactory.create(AppModule);
  // Helmet: Security headers
  const isDev = envs.state === 'dev';
  app.use(
    helmet({
      contentSecurityPolicy: isDev ? false : undefined, // Allow Playground in dev
      crossOriginEmbedderPolicy: isDev ? false : true,
      crossOriginOpenerPolicy: isDev ? false : true,
      crossOriginResourcePolicy: isDev ? false : true,
    })
  );
  app.use(graphqlUploadExpress({ maxFileSize: 20971520, maxFiles: 1 }));
  app.setGlobalPrefix('api', {
    exclude: ['queues', 'queues/*path'],
  });
  app.use(
    ['/queues', '/queues/*path'],
    basicAuth({
      users: { admin: envs.basic_auth_password },
      challenge: true,
    })
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL,
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
