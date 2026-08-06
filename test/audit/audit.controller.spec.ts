import { BadRequestException } from '@nestjs/common';
import { AuditController } from 'src/audit/audit.controller';
import { AuditOutcome } from 'src/audit/enums';

describe('AuditController', () => {
  const auditService = { findForAdministrator: jest.fn() };
  const controller = new AuditController(auditService as any);
  const administrator = { id: 'admin-1', institutionId: 'institution-1' } as any;

  beforeEach(() => jest.clearAllMocks());

  it('passes a valid outcome filter to the service', async () => {
    auditService.findForAdministrator.mockResolvedValue({ items: [] });

    await controller.findAll(administrator, 1, 10, undefined, undefined, 'DENIED');

    expect(auditService.findForAdministrator).toHaveBeenCalledWith(
      administrator,
      expect.objectContaining({ outcome: AuditOutcome.DENIED })
    );
  });

  it('rejects an unknown outcome filter', () => {
    expect(() => controller.findAll(administrator, 1, 10, undefined, undefined, 'UNKNOWN')).toThrow(
      BadRequestException
    );
  });
});
