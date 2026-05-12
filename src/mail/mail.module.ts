import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { envs } from 'src/config';
import { Resend } from 'resend';
import { RESEND_CLIENT } from './resend.constants';

@Global()
@Module({
  providers: [
    {
      provide: RESEND_CLIENT,
      useFactory: () => new Resend(envs.resend_api_key),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
