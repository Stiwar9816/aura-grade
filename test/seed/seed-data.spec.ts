import { UserRoles } from 'src/auth/enums';
import { InstitutionApprovalStatus } from 'src/institution';
import { SEED_DATA } from 'src/seed/data/seed-data';

const hasDuplicates = <T>(values: T[]) => new Set(values).size !== values.length;

describe('SEED_DATA', () => {
  it('has unique institution and user identifiers', () => {
    expect(hasDuplicates(SEED_DATA.institutions.map((institution) => institution.key))).toBe(false);
    expect(hasDuplicates(SEED_DATA.institutions.map((institution) => institution.taxId))).toBe(
      false
    );
    expect(hasDuplicates(SEED_DATA.users.map((user) => user.email))).toBe(false);
    expect(hasDuplicates(SEED_DATA.users.map((user) => user.document_num))).toBe(false);
    expect(hasDuplicates(SEED_DATA.users.map((user) => user.phone))).toBe(false);
  });

  it('defines exactly one platform administrator for development', () => {
    const platformAdministrators = SEED_DATA.users.filter((user) => user.isPlatformAdmin);
    expect(platformAdministrators).toHaveLength(1);
    expect(platformAdministrators[0].role).toBe(UserRoles.Administrador);
  });

  it('has an administrator, teacher and approved student in every institution', () => {
    for (const institution of SEED_DATA.institutions) {
      const users = SEED_DATA.users.filter((user) => user.institutionKey === institution.key);
      expect(users.some((user) => user.role === UserRoles.Administrador)).toBe(true);
      expect(users.some((user) => user.role === UserRoles.Docente)).toBe(true);
      expect(
        users.some(
          (user) =>
            user.role === UserRoles.Estudiante &&
            (user.approvalStatus ?? InstitutionApprovalStatus.APPROVED) ===
              InstitutionApprovalStatus.APPROVED
        )
      ).toBe(true);
    }
  });

  it('only references users, courses and rubrics declared by the seed', () => {
    const institutionKeys = new Set(SEED_DATA.institutions.map((institution) => institution.key));
    const usersByEmail = new Map(SEED_DATA.users.map((user) => [user.email, user]));
    const courseCodes = new Set(SEED_DATA.courses.map((course) => course.code_course));
    const rubricTitles = new Set(SEED_DATA.rubrics.map((rubric) => rubric.title));

    for (const user of SEED_DATA.users) expect(institutionKeys).toContain(user.institutionKey);
    for (const rubric of SEED_DATA.rubrics) {
      expect(usersByEmail.get(rubric.ownerEmail)?.role).toBe(UserRoles.Docente);
    }
    for (const course of SEED_DATA.courses) {
      const teacher = usersByEmail.get(course.teacherEmail);
      expect(teacher?.role).toBe(UserRoles.Docente);
      for (const email of course.studentEmails) {
        const student = usersByEmail.get(email);
        expect(student?.role).toBe(UserRoles.Estudiante);
        expect(student?.institutionKey).toBe(teacher?.institutionKey);
      }
    }
    for (const assignment of SEED_DATA.assignments) {
      expect(usersByEmail.get(assignment.teacherEmail)?.role).toBe(UserRoles.Docente);
      expect(courseCodes).toContain(assignment.courseCode);
      expect(rubricTitles).toContain(assignment.rubricTitle);
    }
  });
});
