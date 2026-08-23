import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AcceptUserInvitationDto } from './accept-user-invitation.dto';
import { UserImportService } from './user-import.service';

@ApiTags('User invitations')
@Controller('user-invitations')
export class UserInvitationController {
  constructor(private readonly userImportService: UserImportService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOkResponse({ description: 'La contraseña fue creada correctamente.' })
  @ApiBadRequestResponse({ description: 'La invitación es inválida o expiró.' })
  async accept(@Body() input: AcceptUserInvitationDto) {
    await this.userImportService.acceptInvitation(input);
    return { success: true, message: 'Contraseña creada correctamente.' };
  }
}
