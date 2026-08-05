import { RubricService } from 'src/rubric/rubric.service';
import { UserRoles } from 'src/auth/enums';
import type { User } from 'src/user/entities/user.entity';

describe('RubricService', () => {
  const rubricRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    preload: jest.fn(),
    remove: jest.fn(),
  };
  const service = new RubricService(rubricRepository as never);

  const teacher = {
    id: 'teacher-id',
    role: UserRoles.Docente,
    institutionId: 'institution-id',
    isPlatformAdmin: false,
  } as User;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes teacher rubric listing to the authenticated owner', async () => {
    rubricRepository.find.mockResolvedValue([]);

    await service.findAll(teacher);

    expect(rubricRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user: { id: teacher.id } } })
    );
  });

  it('scopes administrator rubric listing to the institution', async () => {
    rubricRepository.find.mockResolvedValue([]);
    const administrator = {
      id: 'admin-id',
      role: UserRoles.Administrador,
      institutionId: 'institution-id',
      isPlatformAdmin: false,
    } as User;

    await service.findAll(administrator);

    expect(rubricRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user: { institutionId: administrator.institutionId } },
      })
    );
  });

  it('creates the rubric under the authenticated teacher identity', async () => {
    const input = {
      title: 'Rúbrica',
      description: 'Descripción',
      maxTotalScore: 10,
    };
    rubricRepository.create.mockImplementation((value) => value);
    rubricRepository.save.mockResolvedValue({ id: 'rubric-id', user: teacher });
    rubricRepository.findOne.mockResolvedValue({ id: 'rubric-id', user: teacher });

    await service.create(input, teacher);

    expect(rubricRepository.create).toHaveBeenCalledWith({ ...input, user: teacher });
  });

  it('rejects reading a rubric owned by another teacher', async () => {
    rubricRepository.findOne.mockResolvedValue({
      id: 'rubric-id',
      user: { id: 'other-teacher-id', institutionId: 'institution-id' },
    });

    await expect(service.findOne('rubric-id', teacher)).rejects.toThrow(
      'No puedes acceder a esta rúbrica.'
    );
  });

  it('prevents an administrator from creating rubrics', async () => {
    const administrator = {
      id: 'admin-id',
      role: UserRoles.Administrador,
      institutionId: 'institution-id',
    } as User;

    await expect(
      service.create(
        { title: 'Rúbrica', description: 'Descripción', maxTotalScore: 10 },
        administrator
      )
    ).rejects.toThrow('Solo un docente puede administrar rúbricas.');
  });
});
