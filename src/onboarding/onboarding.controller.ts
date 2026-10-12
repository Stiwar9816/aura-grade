import { Body, Controller, Get, Header, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards';
import type { User } from '../user/entities/user.entity';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  get(@CurrentUser() user: User) {
    return this.onboardingService.get(user);
  }

  @Patch()
  update(@CurrentUser() user: User, @Body() input: UpdateOnboardingDto) {
    return this.onboardingService.update(user, input);
  }
}
