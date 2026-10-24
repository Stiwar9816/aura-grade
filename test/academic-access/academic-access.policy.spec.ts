import { hasAcademicAccess } from 'src/academic-access/academic-access.policy';
import { InstitutionApprovalStatus } from 'src/institution';

describe('academic access policy', () => {
  it.each([
    [undefined, false],
    [null, false],
    [{}, false],
    [{ isActive: true, approvalStatus: InstitutionApprovalStatus.APPROVED }, false],
    [
      { isActive: true, approvalStatus: InstitutionApprovalStatus.APPROVED, institution: {} },
      false,
    ],
    [
      {
        isActive: true,
        approvalStatus: InstitutionApprovalStatus.PENDING,
        institution: { isActive: true },
      },
      false,
    ],
    [
      {
        isActive: false,
        approvalStatus: InstitutionApprovalStatus.APPROVED,
        institution: { isActive: true },
      },
      false,
    ],
    [
      {
        isActive: true,
        approvalStatus: InstitutionApprovalStatus.APPROVED,
        institution: { isActive: true },
      },
      true,
    ],
  ])('evaluates current account %p as %p', (account, expected) => {
    expect(hasAcademicAccess(account)).toBe(expected);
  });
});
