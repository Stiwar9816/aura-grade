import { UserRoles } from '../auth/enums';
import { InstitutionApprovalStatus } from '../institution/enums/institution-approval-status.enum';
import type { User } from '../user/entities/user.entity';
import type { Course } from '../course/entities/course.entity';

type AcademicAccount = {
  isActive?: boolean;
  approvalStatus?: InstitutionApprovalStatus;
  institution?: { isActive?: boolean } | null;
};

/** The caller must load current account/institution state; missing state denies access. */
export function hasAcademicAccess<T extends AcademicAccount>(
  user: T | null | undefined
): user is T {
  return Boolean(
    user?.isActive === true &&
    user.approvalStatus === InstitutionApprovalStatus.APPROVED &&
    user.institution?.isActive === true
  );
}

export function canStudentAccessCourse(
  student: User | null | undefined,
  course: Pick<Course, 'user' | 'users'> | null | undefined
): boolean {
  return Boolean(
    hasAcademicAccess(student) &&
    student.role === UserRoles.Estudiante &&
    student.institutionId &&
    course?.user?.institutionId === student.institutionId &&
    course.users?.some((member) => member.id === student.id)
  );
}
