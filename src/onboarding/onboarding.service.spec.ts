import { BadRequestException } from '@nestjs/common';
import { UserRoles } from '../auth/enums';
import { User } from '../user/entities/user.entity';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  const repository = { update: jest.fn() };
  const service = new OnboardingService(repository as never);
  const student = {
    id: 'af88918b-dfd8-4dc2-852c-9d9644874509',
    role: UserRoles.Estudiante,
    onboardingCompletedSteps: [],
    onboardingDismissedAt: null,
  } as User;

  beforeEach(() => jest.clearAllMocks());

  it('persists only steps allowed for the current role', async () => {
    repository.update.mockResolvedValue({ affected: 1 });

    const result = await service.update(student, { stepId: 'submission', completed: true });

    expect(result.completedSteps).toEqual(['submission']);
    expect(repository.update).toHaveBeenCalledWith(student.id, {
      onboardingCompletedSteps: ['submission'],
      onboardingDismissedAt: null,
    });
  });

  it('rejects a step from another role', async () => {
    await expect(
      service.update(student, { stepId: 'operations', completed: true })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
