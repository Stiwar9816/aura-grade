import { UserRoles, DocumentType } from 'src/auth/enums';

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
  maxTotalScore: number;
  criteria: SeedCriterion[];
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
}

export interface SeedData {
  rubrics: SeedRubric[];
  users: SeedUser[];
}
