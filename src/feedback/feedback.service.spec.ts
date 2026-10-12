import { ForbiddenException } from '@nestjs/common';
import { UserRoles } from '../auth/enums';
import { User } from '../user/entities/user.entity';
import { FeedbackEntry } from './entities/feedback-entry.entity';
import { FeedbackCategory, FeedbackStatus } from './feedback.enums';
import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  const repository = {
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve(value)),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const service = new FeedbackService(repository as never);
  const administrator = {
    id: 'b8d551db-8aad-4f99-88b9-9be2a6ebdf3e',
    role: UserRoles.Administrador,
    institutionId: 'a74b6220-404d-49d2-95fc-0f768b3f5709',
    isPlatformAdmin: false,
  } as User;

  beforeEach(() => jest.clearAllMocks());

  it('stores feedback with server-owned user and institution scope', async () => {
    const user = { ...administrator, role: UserRoles.Docente } as User;
    await service.create(user, {
      category: FeedbackCategory.SUGGESTION,
      message: '  Sería útil filtrar las tareas.  ',
      page: ' /teacher ',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        institutionId: user.institutionId,
        message: 'Sería útil filtrar las tareas.',
        page: '/teacher',
        status: FeedbackStatus.OPEN,
      })
    );
  });

  it('blocks administrators from updating feedback from another institution', async () => {
    repository.findOne.mockResolvedValue({
      id: '8aae260b-1489-413c-9510-572c05e0ed2a',
      institutionId: 'e92f7150-dfcf-485a-9637-eac5ec4dd6a0',
      status: FeedbackStatus.OPEN,
    } as FeedbackEntry);

    await expect(
      service.updateForAdministrator(administrator, '8aae260b-1489-413c-9510-572c05e0ed2a', {
        status: FeedbackStatus.RESOLVED,
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('paginates the administrator inbox using entity property names', async () => {
    const query = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    repository.createQueryBuilder.mockReturnValue(query);

    await service.findForAdministrator(administrator, { page: 1, limit: 25 });

    expect(query.orderBy).toHaveBeenCalledWith('feedback.createdAt', 'DESC');
    expect(query.where).toHaveBeenCalledWith('feedback.institution_id = :institutionId', {
      institutionId: administrator.institutionId,
    });
  });
});
