import { validate } from 'class-validator';
import { CourseService } from 'src/course/course.service';
import {
  COURSE_CODE_PATTERN,
  SGA_GROUP_CODE_PATTERN,
  SGA_SUBJECT_CODE_PATTERN,
} from 'src/course/course-code';
import { CreateCourseInput } from 'src/course/dto/inputs/create-course.input';
import { UserRoles } from 'src/auth/enums';
import type { User } from 'src/user/entities/user.entity';

describe('CourseService', () => {
  const courseRepository = {
    create: jest.fn((value: unknown) => value),
    existsBy: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    preload: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const service = new CourseService(courseRepository as never);

  beforeEach(() => {
    jest.clearAllMocks();
    courseRepository.find.mockResolvedValue([]);
    courseRepository.existsBy.mockResolvedValue(false);
    courseRepository.save.mockImplementation(async (value: unknown) => value);
    courseRepository.preload.mockImplementation(async (value: unknown) => value);
  });

  it.each([
    {
      role: UserRoles.Docente,
      expectedWhere: { user: { id: 'teacher-id' } },
    },
    {
      role: UserRoles.Administrador,
      expectedWhere: { user: { institutionId: 'institution-id' } },
    },
    {
      role: UserRoles.Estudiante,
      expectedWhere: { users: { id: 'teacher-id' } },
    },
  ])('limits course listing for $role', async ({ role, expectedWhere }) => {
    const actor = {
      id: 'teacher-id',
      role,
      institutionId: 'institution-id',
      isPlatformAdmin: false,
    } as User;

    await service.findAll(actor);

    expect(courseRepository.find).toHaveBeenCalledWith({
      where: expectedWhere,
      relations: ['users', 'user'],
    });
  });

  it('allows a platform administrator to list all courses', async () => {
    const actor = {
      id: 'platform-admin-id',
      role: UserRoles.Administrador,
      institutionId: 'platform-institution-id',
      isPlatformAdmin: true,
    } as User;

    await service.findAll(actor);

    expect(courseRepository.find).toHaveBeenCalledWith({
      where: undefined,
      relations: ['users', 'user'],
    });
  });

  it('rejects enrollment changes through the generic course update', async () => {
    const teacher = {
      id: 'teacher-id',
      role: UserRoles.Docente,
    } as User;

    await expect(
      service.update('course-id', { id: 'course-id', studentsIds: ['student-id'] }, teacher)
    ).rejects.toThrow('assignCoursesToUser');
    expect(courseRepository.preload).not.toHaveBeenCalled();
  });

  describe('SGA group and subject codes', () => {
    const teacher = { id: 'teacher-id', role: UserRoles.Docente, institutionId: 'i' } as User;
    const input = (overrides: Record<string, string> = {}) => ({
      course_name: 'Sistemas Inteligentes',
      code_course: 'PGINS2301QDOA',
      sga_subject_code: '000067',
      userId: 'teacher-id',
      ...overrides,
    });

    it('stores the group trimmed and upper-cased together with the subject on create', async () => {
      await service.create(input({ code_course: '  pgins2301qdoa ' }), teacher);

      expect(courseRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ code_course: 'PGINS2301QDOA', sga_subject_code: '000067' })
      );
      expect(courseRepository.existsBy).toHaveBeenCalledWith({
        user: { id: 'teacher-id' },
        code_course: 'PGINS2301QDOA',
        sga_subject_code: '000067',
      });
    });

    it.each(['MATH202', 'NEST101', 'PGINS-2301-QDOA', 'PGINS2301'])(
      'rejects a new course whose group is %s',
      async (code) => {
        await expect(service.create(input({ code_course: code }), teacher)).rejects.toThrow(
          'formato del SGA'
        );
        expect(courseRepository.save).not.toHaveBeenCalled();
      }
    );

    it('rejects a second course for the same group and subject of the same teacher', async () => {
      courseRepository.existsBy.mockResolvedValue(true);

      await expect(service.create(input(), teacher)).rejects.toThrow('Ya tienes un curso');
      expect(courseRepository.save).not.toHaveBeenCalled();
    });

    describe('update', () => {
      const legacy = {
        id: 'c',
        code_course: 'NEST101',
        sga_subject_code: null,
        user: { id: 'teacher-id' },
        users: [],
      };

      it('keeps a legacy group code that is not being changed', async () => {
        courseRepository.findOne.mockResolvedValue(legacy);

        await service.update('c', { id: 'c', course_name: 'Nuevo' }, teacher);
        await service.update('c', { id: 'c', code_course: 'nest101' }, teacher);

        expect(courseRepository.existsBy).not.toHaveBeenCalled();
        expect(courseRepository.save).toHaveBeenCalledTimes(2);
      });

      it('requires the SGA format as soon as the group code changes', async () => {
        courseRepository.findOne.mockResolvedValue(legacy);

        await expect(
          service.update('c', { id: 'c', code_course: 'MATH202' }, teacher)
        ).rejects.toThrow('formato del SGA');
        await service.update(
          'c',
          { id: 'c', code_course: 'pgins2301qdob', sga_subject_code: '000068' },
          teacher
        );

        expect(courseRepository.preload).toHaveBeenLastCalledWith(
          expect.objectContaining({ code_course: 'PGINS2301QDOB', sga_subject_code: '000068' })
        );
      });

      it('checks duplicates ignoring the course being edited', async () => {
        courseRepository.findOne.mockResolvedValue(legacy);
        courseRepository.existsBy.mockResolvedValue(true);

        await expect(
          service.update(
            'c',
            { id: 'c', code_course: 'PGINS2301QDOA', sga_subject_code: '000067' },
            teacher
          )
        ).rejects.toThrow('Ya tienes un curso');
        expect(courseRepository.existsBy).toHaveBeenCalledWith(
          expect.objectContaining({ id: expect.anything(), sga_subject_code: '000067' })
        );
      });
    });

    it('validates the API input: subject has 6 digits, group keeps a loose floor', async () => {
      const check = async (overrides: Record<string, string>) => {
        const dto = Object.assign(new CreateCourseInput(), input(overrides));
        return (await validate(dto)).map((error) => error.property);
      };

      expect(await check({})).toEqual([]);
      expect(await check({ sga_subject_code: '67' })).toEqual(['sga_subject_code']);
      expect(await check({ sga_subject_code: '00006A' })).toEqual(['sga_subject_code']);
      expect(await check({ code_course: 'PGINS 2301' })).toEqual(['code_course']);
    });

    it.each([
      'PGINS2201QDOA',
      'PGINS2202QDOA',
      'PGINS2301QDOA',
      'PGINS2501QDOB',
      'PGINS2602QDOB',
      'pgins2301qdoa'.toUpperCase(),
    ])('accepts the SGA group %s', (code) => {
      expect(SGA_GROUP_CODE_PATTERN.test(code)).toBe(true);
    });

    it.each(['', 'NEST101', 'PGINS2301', 'pgins2301qdoa', 'PGINS 2301QDOA', 'PGINS23015QDOA'])(
      'rejects the SGA group "%s"',
      (code) => {
        expect(SGA_GROUP_CODE_PATTERN.test(code)).toBe(false);
      }
    );

    it('accepts 6-digit subjects only', () => {
      expect(SGA_SUBJECT_CODE_PATTERN.test('000067')).toBe(true);
      expect(['67', '0000067', '00006A', ' 000067']).not.toEqual(
        expect.arrayContaining([expect.stringMatching(SGA_SUBJECT_CODE_PATTERN)])
      );
    });

    it('keeps the legacy floor for the API input', () => {
      expect(COURSE_CODE_PATTERN.test('NEST101')).toBe(true);
      expect(COURSE_CODE_PATTERN.test('PGINS 2301')).toBe(false);
    });
  });

  it('rejects access to a course owned by another teacher', async () => {
    const teacher = {
      id: 'teacher-id',
      role: UserRoles.Docente,
      institutionId: 'institution-id',
    } as User;
    courseRepository.findOne.mockResolvedValue({
      id: 'course-id',
      user: { id: 'other-teacher-id', institutionId: 'institution-id' },
      users: [],
    });

    await expect(service.findOne('course-id', teacher)).rejects.toThrow(
      'No puedes acceder a este curso.'
    );
  });
});
