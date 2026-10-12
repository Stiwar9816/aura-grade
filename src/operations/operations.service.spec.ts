import { ForbiddenException } from '@nestjs/common';
import { UserRoles } from '../auth/enums';
import { SubmissionStatus } from '../enums';
import { Submission } from '../submission/entities/submission.entity';
import { User } from '../user/entities/user.entity';
import { OperationsService } from './operations.service';

describe('OperationsService', () => {
  const transaction = jest.fn();
  const dataSource = { transaction };
  const submissions = { findOne: jest.fn() };
  const service = new OperationsService(
    dataSource as never,
    submissions as never,
    {} as never,
    {} as never,
    {} as never
  );
  const administrator = {
    id: '06df5702-1e32-49d9-a414-4f516d67342b',
    role: UserRoles.Administrador,
    institutionId: '430b84f1-5aba-492d-bd31-4e4d88fbf227',
    isPlatformAdmin: false,
  } as User;

  beforeEach(() => jest.clearAllMocks());

  it('blocks retries outside the administrator institution', async () => {
    submissions.findOne.mockResolvedValue({
      id: 'c0a8c7af-4ef1-4209-b0f1-83dc4fbca8a5',
      status: SubmissionStatus.FAILED,
      fileUrl: 'https://private.example/submission.docx',
      assignment: { user: { institutionId: '72f9eea3-b302-4797-98a2-f36173ce9754' } },
    } as Submission);

    await expect(
      service.retrySubmission(administrator, 'c0a8c7af-4ef1-4209-b0f1-83dc4fbca8a5')
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('atomically resets a failed submission and records an outbox event', async () => {
    submissions.findOne.mockResolvedValue({
      id: 'c0a8c7af-4ef1-4209-b0f1-83dc4fbca8a5',
      status: SubmissionStatus.FAILED,
      fileUrl: 'https://private.example/submission.docx',
      evaluation: null,
      assignment: { user: { institutionId: administrator.institutionId } },
    } as Submission);
    const execute = jest.fn().mockResolvedValue({});
    const manager = {
      getRepository: jest.fn().mockReturnValue({
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          orIgnore: jest.fn().mockReturnThis(),
          execute,
        }),
      }),
    };
    transaction.mockImplementation((work) => work(manager));

    await expect(
      service.retrySubmission(administrator, 'c0a8c7af-4ef1-4209-b0f1-83dc4fbca8a5')
    ).resolves.toEqual({
      id: 'c0a8c7af-4ef1-4209-b0f1-83dc4fbca8a5',
      status: SubmissionStatus.PENDING,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
