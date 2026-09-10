import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards';
import { CurrentUser } from 'src/auth/decorators';
import { User } from 'src/user/entities/user.entity';
import { SubmissionService } from './submission.service';

@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionController {
  constructor(private readonly submissions: SubmissionService) {}

  @Get(':id/download')
  async download(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return { url: await this.submissions.download(id, user) };
  }
}
