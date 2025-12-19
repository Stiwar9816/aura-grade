import { join } from 'path';
// NestJS
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// GraphQL
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriverConfig, ApolloDriver } from '@nestjs/apollo';
// Rate Limiting
import { ThrottlerModule } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
// Redis Caching
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
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
// Config
import { envs } from './config';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    // Redis Caching
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: envs.redis_host,
            port: envs.redis_port,
          },
          ttl: 60 * 60, // 1 hour by default
        }),
      }),
    }),
    // Configuración de credenciales de la DB
    TypeOrmModule.forRoot({
      type: 'postgres',
      ssl:
        envs.state === 'prod'
          ? {
              rejectUnauthorized: false,
              sslmode: 'require',
            }
          : (false as any),
      host: envs.db_host,
      port: +envs.db_port,
      database: envs.db_name,
      username: envs.db_username,
      password: envs.db_password,
      autoLoadEntities: true,
      synchronize: true,
    }),
    // GraphQL
    // TODO: Configuración básica
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
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
    SeedModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppModule {}
