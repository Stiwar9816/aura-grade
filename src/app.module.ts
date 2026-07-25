import { join } from 'path';
// NestJS
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// GraphQL
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriverConfig, ApolloDriver } from '@nestjs/apollo';
// Rate Limiting
import { ThrottlerModule } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { RedisThrottlerStorage } from './common/throttler';
// BullMQ
import { BullModule } from '@nestjs/bullmq';
// BullBoard
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
// Modules
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MailModule } from './mail/mail.module';
import { CourseModule } from './course/course.module';
import { RubricModule } from './rubric/rubric.module';
import { CriterionModule } from './criterion/criterion.module';
import { AssignmentModule } from './assignment/assignment.module';
import { SubmissionModule } from './submission/submission.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { ExtractorModule } from './extractor/extractor.module';
import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { ReEvaluationModule } from './reevaluation/reevaluation.module';
// Config
import { envs } from './config';
import { SeedModule } from './seed/seed.module';
import { dataSourceOptions } from './config/datasource.config';
import { RedisModule, RedisService } from './redis';
import { BffAuthGuard } from './common/guards/bff-auth.guard';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { AuthMetricsService, ObservabilityModule } from './observability';

const redisQueueConnection = envs.redis_url
  ? { url: envs.redis_url }
  : {
      host: envs.redis_host,
      port: envs.redis_port,
    };

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate Limiting
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule, ObservabilityModule],
      inject: [RedisService, AuthMetricsService],
      useFactory: (redis: RedisService, metrics: AuthMetricsService) => ({
        storage: new RedisThrottlerStorage(redis, metrics),
        throttlers: [
          {
            name: 'short',
            ttl: 60000,
            limit: 100,
          },
        ],
      }),
    }),
    // BullMQ
    BullModule.forRoot({
      connection: redisQueueConnection,
    }),
    BullBoardModule.forRoot({
      adapter: ExpressAdapter,
      route: '/queues',
      boardOptions: {
        uiConfig: {
          boardTitle: 'Aura Grade - Colas',
        },
      },
    }),
    // Configuración de la DB
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      entities: [], // Usar autoLoadEntities
      migrations: [], // Evitar que el glob falle en runtime
      autoLoadEntities: true,
      synchronize: envs.state === 'dev',
    }),
    // GraphQL
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: envs.state === 'dev' ? join(process.cwd(), 'src/schema.gql') : true,
      playground: false,
      csrfPrevention: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
    }),
    AuthModule,
    UserModule,
    MailModule,
    CourseModule,
    RubricModule,
    CriterionModule,
    AssignmentModule,
    SubmissionModule,
    CloudinaryModule,
    EvaluationModule,
    ExtractorModule,
    AiModule,
    NotificationsModule,
    ReEvaluationModule,
    SeedModule,
    HealthModule,
    ObservabilityModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: BffAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    RequestContextMiddleware,
  ],
})
export class AppModule {}
