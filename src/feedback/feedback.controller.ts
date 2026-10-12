import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators';
import { UserRoles } from '../auth/enums';
import { JwtAuthGuard } from '../auth/guards';
import type { User } from '../user/entities/user.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ListFeedbackDto } from './dto/list-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Throttle({ short: { limit: 10, ttl: 60 * 60 * 1000 } })
  create(@CurrentUser() user: User, @Body() input: CreateFeedbackDto) {
    return this.feedbackService.create(user, input);
  }

  @Get('mine')
  @Header('Cache-Control', 'no-store')
  findMine(@CurrentUser() user: User) {
    return this.feedbackService.findMine(user);
  }

  @Get('admin')
  @Header('Cache-Control', 'no-store')
  findForAdministrator(
    @CurrentUser([UserRoles.Administrador]) administrator: User,
    @Query() query: ListFeedbackDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number
  ) {
    return this.feedbackService.findForAdministrator(administrator, {
      status: query.status,
      page,
      limit: Math.min(100, Math.max(1, limit)),
    });
  }

  @Patch('admin/:id')
  updateForAdministrator(
    @CurrentUser([UserRoles.Administrador]) administrator: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateFeedbackDto
  ) {
    return this.feedbackService.updateForAdministrator(administrator, id, input);
  }
}
