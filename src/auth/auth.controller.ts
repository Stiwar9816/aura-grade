// NestJS
import { Body, Controller, Post } from '@nestjs/common';
// Services
import { AuthService } from './auth.service';
// Dto
import { CreateUserDto, LoginUserDto } from './dto';
// Entities
import { User } from 'src/user/entities/user.entity';
// Swagger
import {
  ApiTags,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

//Doc API - ApiTags
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //EndPoint Register users
  @Post('register')
  // Doc API - ApiResponse
  @ApiCreatedResponse({ description: 'User was created successfully', type: User })
  @ApiBadRequestResponse({ description: 'Bad request' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  // End - Doc API
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }
  //EndPoint Login users
  @Post('login')
  // Doc API - ApiResponse
  @ApiCreatedResponse({ description: 'User successfully logged in' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiBadRequestResponse({ description: 'Bad request' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  // End - Doc API
  login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
  }
}
