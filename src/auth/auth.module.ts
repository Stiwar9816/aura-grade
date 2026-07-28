// NestJS
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
// Controllers
import { AuthController } from './auth.controller';
// Passport
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt-strategy';
import { JwtAuthGuard } from './guards';
// Services
import { AuthService } from './auth.service';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Entities
import { User } from '../user/entities/user.entity';
// Modules
import { MailModule } from 'src/mail/mail.module';
import { SessionService } from './session';
import { AuthAttemptService } from './security';
import { InstitutionModule } from 'src/institution';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, SessionService, AuthAttemptService],
  exports: [
    TypeOrmModule,
    JwtStrategy,
    JwtAuthGuard,
    PassportModule,
    JwtModule,
    AuthService,
    SessionService,
    AuthAttemptService,
  ],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get('JWT_SECRET'),
          signOptions: {
            expiresIn: '1h',
          },
        };
      },
    }),
    MailModule,
    InstitutionModule,
  ],
})
export class AuthModule {}
