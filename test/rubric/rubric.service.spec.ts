import { RubricService } from 'src/rubric/rubric.service';
import { UserRoles } from 'src/auth/enums';
import type { User } from 'src/user/entities/user.entity';
import {
  RubricAcademicLevel,
  RubricPerformanceLevel,
  RubricSource,
  RubricStatus,
} from 'src/rubric/enums';

describe('RubricService', () => {
  const rubricRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    preload: jest.fn(),
    remove: jest.fn(),
  };
  const dataSource = { transaction: jest.fn() };
  const aiService = {
    generateRubricDraft: jest.fn(),
    verifyRubricGeneration: jest.fn(),
    consumeRubricGeneration: jest.fn(),
  };
  const service = new RubricService(
    rubricRepository as never,
    dataSource as never,
    aiService as never
  );

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
      maxTotalScore: 5,
      academicLevel: RubricAcademicLevel.UNIVERSITARIO,
    };
    rubricRepository.create.mockImplementation((value) => value);
    rubricRepository.save.mockResolvedValue({ id: 'rubric-id', user: teacher });
    rubricRepository.findOne.mockResolvedValue({ id: 'rubric-id', user: teacher });

    await service.create(input, teacher);

    expect(rubricRepository.create).toHaveBeenCalledWith({
      ...input,
      maxTotalScore: 5,
      status: RubricStatus.DRAFT,
      source: RubricSource.MANUAL,
      user: teacher,
    });
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
        {
          title: 'Rúbrica',
          description: 'Descripción',
          maxTotalScore: 5,
          academicLevel: RubricAcademicLevel.UNIVERSITARIO,
        },
        administrator
      )
    ).rejects.toThrow('Solo un docente puede administrar rúbricas.');
  });

  it('delegates AI draft generation with the authenticated teacher identity', async () => {
    aiService.generateRubricDraft.mockResolvedValue({ title: 'Rúbrica IA' });
    const input = {
      title: 'Ensayo',
      taskDescription: 'Analiza críticamente un caso.',
      academicLevel: RubricAcademicLevel.POSGRADO,
      criterionCount: 4,
    };

    await service.generateDraft(input, teacher);

    expect(aiService.generateRubricDraft).toHaveBeenCalledWith(input, teacher.id);
  });

  it('rejects drafts whose criterion percentages do not add up to 100', async () => {
    await expect(
      service.saveDraft(
        {
          title: 'Rúbrica',
          description: 'Descripción',
          academicLevel: RubricAcademicLevel.UNIVERSITARIO,
          criteria: [
            {
              title: 'Argumentación',
              description: 'Evalúa la calidad de los argumentos.',
              weight: 90,
              levels: [
                { label: 'Excelente' as never, description: 'Dominio completo.' },
                { label: 'Bueno' as never, description: 'Buen dominio.' },
                { label: 'Aceptable' as never, description: 'Dominio básico.' },
                { label: 'Insuficiente' as never, description: 'No alcanza lo esperado.' },
              ],
            },
          ],
        },
        teacher
      )
    ).rejects.toThrow('Los porcentajes deben sumar 100%');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects creating another version when the lineage already has a draft', async () => {
    const current = {
      id: 'published-id',
      rootRubricId: 'published-id',
      version: 1,
      status: RubricStatus.PUBLISHED,
      user: teacher,
    };
    const queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(current),
    };
    const transactionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      find: jest.fn().mockResolvedValue([
        current,
        {
          id: 'draft-id',
          rootRubricId: 'published-id',
          version: 2,
          status: RubricStatus.DRAFT,
        },
      ]),
    };
    dataSource.transaction.mockImplementation((callback) =>
      callback({ getRepository: () => transactionRepository })
    );

    const levels = [
      { label: RubricPerformanceLevel.EXCELENTE, description: 'Dominio completo.' },
      { label: RubricPerformanceLevel.BUENO, description: 'Buen dominio.' },
      { label: RubricPerformanceLevel.ACEPTABLE, description: 'Dominio básico.' },
      { label: RubricPerformanceLevel.INSUFICIENTE, description: 'No alcanza lo esperado.' },
    ];

    await expect(
      service.saveDraft(
        {
          id: current.id,
          title: 'Nueva versión',
          description: 'Descripción',
          academicLevel: RubricAcademicLevel.UNIVERSITARIO,
          criteria: [
            {
              title: 'Argumentación',
              description: 'Evalúa los argumentos.',
              weight: 100,
              levels,
            },
          ],
        },
        teacher
      )
    ).rejects.toThrow('ya tiene un borrador en la versión 2');
  });
});
