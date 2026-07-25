import { AuthMetricsService } from 'src/observability';

describe('AuthMetricsService', () => {
  it('renders counters and validation latency in Prometheus format', () => {
    const metrics = new AuthMetricsService();
    metrics.increment('auth_login_success_total');
    metrics.increment('auth_session_revoked_total', 2);
    metrics.observeValidation(7);

    const output = metrics.renderPrometheus();
    expect(output).toContain('auth_login_success_total 1');
    expect(output).toContain('auth_session_revoked_total 2');
    expect(output).toContain('auth_session_validation_duration_ms_count 1');
  });
});
