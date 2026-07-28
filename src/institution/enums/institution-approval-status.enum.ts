import { registerEnumType } from '@nestjs/graphql';

export enum InstitutionApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

registerEnumType(InstitutionApprovalStatus, {
  name: 'InstitutionApprovalStatus',
  description: 'Institutional approval state for a user account',
});
