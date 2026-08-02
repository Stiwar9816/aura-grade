// NestJS
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
// Services
import { AuthService } from './auth.service';
// Dto
import { CreateUserDto, ForgotPasswordDto, LoginUserDto, AuthResponse } from './dto';
// Entities
import { User } from 'src/user/entities/user.entity';
// Swagger
import {
  ApiTags,
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards';
import { CurrentUser } from './decorators';
import { UserRoles } from './enums';

interface AuthenticatedRequest extends Request {
  user: User;
  sessionToken?: string;
}

//Doc API - ApiTags
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //EndPoint Register users
  @Post('register')
  @Throttle({ short: { limit: 5, ttl: 60 * 60 * 1000 } })
  // Doc API - ApiResponse
  @ApiCreatedResponse({ description: 'El usuario fue creado correctamente.', type: AuthResponse })
  @ApiBadRequestResponse({ description: 'Solicitud inválida.' })
  @ApiNotFoundResponse({ description: 'Recurso no encontrado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  // End - Doc API
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }
  //EndPoint Login users
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60 * 1000 } })
  // Doc API - ApiResponse
  @ApiOkResponse({ description: 'El usuario inició sesión correctamente.', type: AuthResponse })
  @ApiNotFoundResponse({ description: 'Recurso no encontrado.' })
  @ApiBadRequestResponse({ description: 'Solicitud inválida.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  // End - Doc API
  login(@Body() loginUserDto: LoginUserDto, @Req() request: Request) {
    const identity = `${request.ip}:${loginUserDto.email.toLowerCase().trim()}`;
    return this.authService.login(loginUserDto, identity);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ short: { limit: 3, ttl: 15 * 60 * 1000 } })
  @ApiAcceptedResponse({ description: 'Solicitud de recuperación de contraseña aceptada.' })
  async forgotPassword(@Body() { email }: ForgotPasswordDto) {
    await this.authService.forgotPassword(email);
    return { message: 'Revisa tu correo para continuar con el restablecimiento de contraseña.' };
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @Throttle({ short: { limit: 120, ttl: 60 * 1000 } })
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 30, ttl: 60 * 1000 } })
  logout(@Headers('authorization') authorization?: string) {
    const [scheme, token, extra] = authorization?.trim().split(/\s+/) ?? [];
    const sessionToken = scheme?.toLowerCase() === 'bearer' && token && !extra ? token : undefined;
    return this.authService.logout(sessionToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 30, ttl: 60 * 1000 } })
  @UseGuards(JwtAuthGuard)
  logoutAll(@Req() request: AuthenticatedRequest) {
    return this.authService.logoutAll(request.user);
  }

  @Post('users/:userId/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 30, ttl: 60 * 1000 } })
  @UseGuards(JwtAuthGuard)
  revokeUserSessions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser([UserRoles.Administrador]) _administrator: User
  ) {
    return this.authService.logoutAllForUser(userId);
  }
}
