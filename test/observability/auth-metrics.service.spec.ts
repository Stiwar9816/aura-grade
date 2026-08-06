import { AuthMetricsService } from 'src/observability';

describe('AuthMetricsService', () => {
  it('renders counters and validation latency in Prometheus format', () => {
    const metrics = new AuthMetricsService();
    metrics.increment('auth_login_success_total');
    metrics.increment('auth_session_revoked_total', 2);
    metrics.increment('audit_enqueued_total');
    metrics.increment('push_sent_total');
    metrics.increment('notification_queued_total');
    metrics.observeValidation(7);

    const output = metrics.renderPrometheus();
    expect(output).toContain('auth_login_success_total 1');
    expect(output).toContain('auth_session_revoked_total 2');
    expect(output).toContain('audit_enqueued_total 1');
    expect(output).toContain('push_sent_total 1');
    expect(output).toContain('notification_queued_total 1');
    expect(output).toContain('auth_session_validation_duration_ms_count 1');
  });
});
