import { Module, forwardRef } from '@nestjs/common';
import { RubricService } from './rubric.service';
import { RubricResolver } from './rubric.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rubric } from './entities/rubric.entity';
import { UserModule } from 'src/user/user.module';

@Module({
  providers: [RubricResolver, RubricService],
  imports: [TypeOrmModule.forFeature([Rubric]), forwardRef(() => UserModule)],
  exports: [RubricService],
})
export class RubricModule {}
