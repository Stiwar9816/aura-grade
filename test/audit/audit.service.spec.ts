import { AuditService } from 'src/audit/audit.service';
import { AuditOutcome } from 'src/audit/enums';
import { UserRoles } from 'src/auth/enums';
import { User } from 'src/user/entities/user.entity';

describe('AuditService', () => {
  const query = {
    where: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    andWhere: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const queue = { add: jest.fn() };
  const metrics = { increment: jest.fn() };
  const service = new AuditService(repository as any, queue as any, metrics as any);
  const administrator = {
    id: '19f6d6c2-6d3f-4afe-9801-bf6e23a47047',
    role: UserRoles.Administrador,
    institutionId: '45fb19bd-6b89-4e4e-a22a-a81d81db45cc',
    isPlatformAdmin: false,
  } as User;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['where', 'orderBy', 'skip', 'take', 'andWhere'] as const) {
      query[method].mockReturnValue(query);
    }
    repository.createQueryBuilder.mockReturnValue(query);
    queue.add.mockResolvedValue(undefined);
    repository.create.mockImplementation((value) => value);
    repository.save.mockResolvedValue(undefined);
  });

  const auditEvent = {
    actorUserId: '1553d33b-798b-4ce5-b943-1fa8bf8ea01c',
    actorName: 'Aura Admin',
    actorEmail: 'admin@aura.edu.co',
    institutionId: '73a8fa1d-626e-4081-bad4-6e131d288bd5',
    action: 'UPDATE',
    resource: 'User',
    resourceId: 'user-1',
    requestId: 'request-1234',
    outcome: AuditOutcome.SUCCESS,
    occurredAt: new Date('2026-08-05T12:00:00.000Z'),
  };

  it('enqueues an idempotent audit job with retries', async () => {
    await service.enqueue(auditEvent);

    expect(queue.add).toHaveBeenCalledWith(
      'persist-audit',
      expect.objectContaining({
        eventKey: expect.stringMatching(/^[a-f0-9]{64}$/),
        occurredAt: '2026-08-05T12:00:00.000Z',
      }),
      expect.objectContaining({
        jobId: expect.stringMatching(/^[a-f0-9]{64}$/),
        attempts: 5,
      })
    );
    expect(metrics.increment).toHaveBeenCalledWith('audit_enqueued_total');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('persists directly when the audit queue is unavailable', async () => {
    queue.add.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(service.enqueue(auditEvent)).resolves.toBeUndefined();

    expect(metrics.increment).toHaveBeenCalledWith('audit_fallback_total');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: expect.stringMatching(/^[a-f0-9]{64}$/),
        occurredAt: auditEvent.occurredAt,
      })
    );
    expect(metrics.increment).toHaveBeenCalledWith('audit_persisted_total');
  });

  it('treats a duplicate database event as an idempotent success', async () => {
    repository.save.mockRejectedValueOnce({ code: '23505' });

    await expect(service.record({ ...auditEvent, eventKey: 'event-1' })).resolves.toBeUndefined();

    expect(metrics.increment).toHaveBeenCalledWith('audit_duplicate_total');
  });

  it('propagates non-duplicate persistence errors for BullMQ retry', async () => {
    repository.save.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.record({ ...auditEvent, eventKey: 'event-1' })).rejects.toThrow(
      'database unavailable'
    );
  });

  it('scopes audit history to the administrator institution and paginates it', async () => {
    query.getManyAndCount.mockResolvedValue([[{ id: 'audit-1' }], 26]);

    const result = await service.findForAdministrator(administrator, {
      page: 2,
      limit: 25,
      search: 'docente',
      outcome: AuditOutcome.DENIED,
    });

    expect(query.where).toHaveBeenCalledWith('audit.institution_id = :institutionId', {
      institutionId: administrator.institutionId,
    });
    expect(query.skip).toHaveBeenCalledWith(25);
    expect(query.take).toHaveBeenCalledWith(25);
    expect(query.andWhere).toHaveBeenCalled();
    expect(query.andWhere).toHaveBeenCalledWith('audit.outcome = :outcome', {
      outcome: AuditOutcome.DENIED,
    });
    expect(result).toEqual(
      expect.objectContaining({ total: 26, page: 2, limit: 25, totalPages: 2 })
    );
  });

  it('allows platform administrators to inspect events across institutions', async () => {
    query.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findForAdministrator({ ...administrator, isPlatformAdmin: true } as User, {
      page: 1,
      limit: 25,
    });

    expect(query.where).not.toHaveBeenCalled();
  });
});
