import { CriterionService } from 'src/criterion/criterion.service';
import { UserRoles } from 'src/auth/enums';
import type { User } from 'src/user/entities/user.entity';
import { RubricPerformanceLevel, RubricStatus } from 'src/rubric/enums';

const levels = [
  {
    label: RubricPerformanceLevel.EXCELENTE,
    minScore: 4.5,
    maxScore: 5,
    description: 'Excelente',
    score: 5,
  },
  {
    label: RubricPerformanceLevel.BUENO,
    minScore: 4,
    maxScore: 4.49,
    description: 'Bueno',
    score: 4.49,
  },
  {
    label: RubricPerformanceLevel.ACEPTABLE,
    minScore: 3,
    maxScore: 3.99,
    description: 'Aceptable',
    score: 3.99,
  },
  {
    label: RubricPerformanceLevel.INSUFICIENTE,
    minScore: 0,
    maxScore: 2.99,
    description: 'Insuficiente',
    score: 2.99,
  },
];

describe('CriterionService', () => {
  const criterionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    preload: jest.fn(),
    remove: jest.fn(),
  };
  const rubricRepository = { findOne: jest.fn() };
  const service = new CriterionService(criterionRepository as never, rubricRepository as never);

  const teacher = {
    id: 'teacher-id',
    role: UserRoles.Docente,
    institutionId: 'institution-id',
    isPlatformAdmin: false,
  } as User;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes teacher criterion listing through owned rubrics', async () => {
    criterionRepository.find.mockResolvedValue([]);

    await service.findAll(teacher);

    expect(criterionRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rubric: { user: { id: teacher.id } } },
      })
    );
  });

  it('scopes administrator criterion listing to the institution', async () => {
    criterionRepository.find.mockResolvedValue([]);
    const administrator = {
      id: 'admin-id',
      role: UserRoles.Administrador,
      institutionId: 'institution-id',
      isPlatformAdmin: false,
    } as User;

    await service.findAll(administrator);

    expect(criterionRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          rubric: { user: { institutionId: administrator.institutionId } },
        },
      })
    );
  });

  it('creates a criterion only in a rubric owned by the authenticated teacher', async () => {
    const rubric = { id: 'rubric-id', user: teacher, status: RubricStatus.DRAFT };
    rubricRepository.findOne.mockResolvedValue(rubric);
    criterionRepository.create.mockImplementation((value) => value);
    criterionRepository.save.mockImplementation((value) => value);

    await service.create(
      {
        title: 'Claridad',
        maxPoints: 5,
        weight: 100,
        levels,
        rubric: 'rubric-id',
      },
      teacher
    );

    expect(rubricRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rubric-id', user: { id: teacher.id } },
      })
    );
    expect(criterionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ rubric }));
  });

  it('rejects creating a criterion in another teacher rubric', async () => {
    rubricRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create(
        {
          title: 'Claridad',
          maxPoints: 5,
          weight: 100,
          levels,
          rubric: 'other-rubric-id',
        },
        teacher
      )
    ).rejects.toThrow('no pertenece al docente actual');
  });

  it('rejects reading a criterion from another teacher rubric', async () => {
    criterionRepository.findOne.mockResolvedValue({
      id: 'criterion-id',
      rubric: {
        id: 'rubric-id',
        user: { id: 'other-teacher-id', institutionId: 'institution-id' },
      },
    });

    await expect(service.findOne('criterion-id', teacher)).rejects.toThrow(
      'No puedes acceder a este criterio.'
    );
  });

  it('prevents an administrator from creating criteria', async () => {
    const administrator = {
      id: 'admin-id',
      role: UserRoles.Administrador,
      institutionId: 'institution-id',
    } as User;

    await expect(
      service.create(
        {
          title: 'Claridad',
          maxPoints: 5,
          weight: 100,
          levels,
          rubric: 'rubric-id',
        },
        administrator
      )
    ).rejects.toThrow('Solo un docente puede administrar criterios.');
  });
});
