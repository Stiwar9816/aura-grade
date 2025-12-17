import { Resolver, Mutation } from '@nestjs/graphql';
import { SeedService } from './seed.service';

@Resolver()
export class SeedResolver {
  constructor(private readonly seedService: SeedService) {}

  @Mutation(() => String, { name: 'executeSeed' })
  async runSeed() {
    return this.seedService.executeSeed();
  }
}
