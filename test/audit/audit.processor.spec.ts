import { AuditProcessor } from 'src/audit/audit.processor';

describe('AuditProcessor', () => {
  it('persists the queued event', async () => {
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const processor = new AuditProcessor(auditService as any);
    const data = { eventKey: 'event-1' };

    await expect(processor.process({ data } as any)).resolves.toEqual({ persisted: true });
    expect(auditService.record).toHaveBeenCalledWith(data);
  });
});
