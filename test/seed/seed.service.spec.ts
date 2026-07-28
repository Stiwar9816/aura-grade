import { ForbiddenException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SeedModule } from 'src/seed/seed.module';
import { SeedService } from 'src/seed/seed.service';

describe('SeedService production safety', () => {
  it('does not expose a GraphQL resolver or mutation', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, SeedModule);
    const schema = readFileSync(join(process.cwd(), 'src/schema.gql'), 'utf8');

    expect(providers).toEqual([SeedService]);
    expect(schema).not.toContain('executeSeed');
  });

  it('rejects destructive seeding outside development before accessing repositories', async () => {
    const repository = {
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
    };
    const configService = {
      get: jest.fn().mockReturnValue('prod'),
    } as unknown as ConfigService;
    const service = new SeedService(
      repository as never,
      repository as never,
      repository as never,
      repository as never,
      repository as never,
      repository as never,
      repository as never,
      configService
    );

    await expect(service.executeSeed()).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
