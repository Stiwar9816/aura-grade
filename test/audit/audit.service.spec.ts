import { AuditService } from 'src/audit/audit.service';
import { UserRoles } from 'src/auth/enums';
import { User } from 'src/user/entities/user.entity';

describe('AuditService', () => {
  const query = {
    where: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    andWhere: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const service = new AuditService(repository as any);
  const administrator = {
    id: '19f6d6c2-6d3f-4afe-9801-bf6e23a47047',
    role: UserRoles.Administrador,
    institutionId: '45fb19bd-6b89-4e4e-a22a-a81d81db45cc',
    isPlatformAdmin: false,
  } as User;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['where', 'orderBy', 'skip', 'take', 'andWhere'] as const) {
      query[method].mockReturnValue(query);
    }
    repository.createQueryBuilder.mockReturnValue(query);
  });

  it('scopes audit history to the administrator institution and paginates it', async () => {
    query.getManyAndCount.mockResolvedValue([[{ id: 'audit-1' }], 26]);

    const result = await service.findForAdministrator(administrator, {
      page: 2,
      limit: 25,
      search: 'docente',
    });

    expect(query.where).toHaveBeenCalledWith('audit.institution_id = :institutionId', {
      institutionId: administrator.institutionId,
    });
    expect(query.skip).toHaveBeenCalledWith(25);
    expect(query.take).toHaveBeenCalledWith(25);
    expect(query.andWhere).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ total: 26, page: 2, limit: 25, totalPages: 2 })
    );
  });

  it('allows platform administrators to inspect events across institutions', async () => {
    query.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findForAdministrator({ ...administrator, isPlatformAdmin: true } as User, {
      page: 1,
      limit: 25,
    });

    expect(query.where).not.toHaveBeenCalled();
  });
});
