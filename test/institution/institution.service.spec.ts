import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InstitutionService } from 'src/institution';
import { UserRoles } from 'src/auth/enums';
import { InstitutionApprovalStatus } from 'src/institution/enums/institution-approval-status.enum';
import { User } from 'src/user/entities/user.entity';

describe('InstitutionService', () => {
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    preload: jest.fn(),
  };
  const service = new InstitutionService(repository as any);
  const administrator = {
    id: '3a2574e9-9668-4dd1-aa0d-e128651ac7b3',
    name: 'Aura',
    last_name: 'Admin',
    email: 'admin@aura.edu.co',
    role: UserRoles.Administrador,
    institutionId: 'ac33a3f5-1e3b-4d53-a8b7-2f0b2e9ef2a9',
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    isPlatformAdmin: true,
  } as User;

  beforeEach(() => jest.clearAllMocks());

  it('creates an institution with normalized text fields', async () => {
    repository.create.mockImplementation((value) => value);
    repository.save.mockImplementation(async (value) => ({ id: 'new-id', ...value }));

    const result = await service.create(
      {
        name: '  Universidad Ágora  ',
        taxId: ' ab 900765432-1 ',
        contactEmail: ' CONTACTO@AGORA.EDU.CO ',
      },
      administrator
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Universidad Ágora',
        taxId: 'AB900765432-1',
        contactEmail: 'contacto@agora.edu.co',
      })
    );
    expect(result.name).toBe('Universidad Ágora');
  });

  it('translates unique constraint errors into a conflict', async () => {
    repository.create.mockImplementation((value) => value);
    repository.save.mockRejectedValue({ code: '23505' });

    await expect(
      service.create({ name: 'Universidad Aura', taxId: '900123456-7' }, administrator)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents an administrator from deactivating their current institution', async () => {
    await expect(
      service.update(administrator.institutionId, { isActive: false }, administrator)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.preload).not.toHaveBeenCalled();
  });

  it('rejects institution management by an institutional administrator', async () => {
    await expect(
      service.create({ name: 'Institución no autorizada', taxId: '900111222-3' }, {
        ...administrator,
        isPlatformAdmin: false,
      } as User)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
