import type { Assignment } from './entities/assignment.entity';

export const getEffectiveAssignmentDueDate = (
  assignment: Pick<Assignment, 'dueDate' | 'extensions'>,
  studentId: string
): Date => {
  const baseDueDate = new Date(assignment.dueDate);
  const extension = (assignment.extensions ?? []).find(
    (candidate) => candidate.student?.id === studentId
  );
  if (!extension) return baseDueDate;

  const extendedDueDate = new Date(extension.extendedDueDate);
  return extendedDueDate.getTime() > baseDueDate.getTime() ? extendedDueDate : baseDueDate;
};
