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

  it('rejects destructive seeding outside development before opening a transaction', async () => {
    const dataSource = {
      transaction: jest.fn(),
    };
    const configService = {
      get: jest.fn().mockReturnValue('prod'),
    } as unknown as ConfigService;
    const service = new SeedService(dataSource as never, configService);

    await expect(service.executeSeed()).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
