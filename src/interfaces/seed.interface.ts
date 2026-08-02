import { UserRoles, DocumentType } from 'src/auth/enums';
import { InstitutionApprovalStatus } from 'src/institution';

export interface SeedInstitution {
  key: string;
  name: string;
  isActive: boolean;
}

export interface CriterionLevel {
  score: number;
  description: string;
}

export interface SeedCriterion {
  title: string;
  maxPoints: number;
  levels: CriterionLevel[];
}

export interface SeedRubric {
  title: string;
  description: string;
  maxTotalScore: number;
  criteria: SeedCriterion[];
  ownerEmail: string;
}

export interface SeedUser {
  name: string;
  last_name: string;
  email: string;
  password: string;
  role: UserRoles;
  document_type: DocumentType;
  document_num: number;
  phone: number;
  institutionKey: string;
  approvalStatus?: InstitutionApprovalStatus;
}

export interface SeedCourse {
  course_name: string;
  code_course: string;
  teacherEmail: string;
  studentEmails: string[];
}

export interface SeedAssignment {
  title: string;
  description: string;
  dueInDays: number;
  teacherEmail: string;
  courseCode: string;
  rubricTitle: string;
}

export interface SeedData {
  institutions: SeedInstitution[];
  rubrics: SeedRubric[];
  users: SeedUser[];
  courses: SeedCourse[];
  assignments: SeedAssignment[];
}
