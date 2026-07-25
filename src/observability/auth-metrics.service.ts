import { Injectable } from '@nestjs/common';

type CounterName =
  | 'auth_login_success_total'
  | 'auth_login_failure_total'
  | 'auth_session_created_total'
  | 'auth_session_invalid_total'
  | 'auth_session_revoked_total'
  | 'auth_redis_error_total';

const VALIDATION_BUCKETS_MS = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

@Injectable()
export class AuthMetricsService {
  private readonly counters = new Map<CounterName, number>();
  private readonly validationBuckets = new Map<number, number>(
    VALIDATION_BUCKETS_MS.map((bucket) => [bucket, 0])
  );
  private validationCount = 0;
  private validationSumMs = 0;

  increment(name: CounterName, amount = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }

  observeValidation(durationMs: number): void {
    this.validationCount += 1;
    this.validationSumMs += durationMs;
    for (const bucket of VALIDATION_BUCKETS_MS) {
      if (durationMs <= bucket)
        this.validationBuckets.set(bucket, (this.validationBuckets.get(bucket) ?? 0) + 1);
    }
  }

  renderPrometheus(): string {
    const lines: string[] = [];
    for (const name of [
      'auth_login_success_total',
      'auth_login_failure_total',
      'auth_session_created_total',
      'auth_session_invalid_total',
      'auth_session_revoked_total',
      'auth_redis_error_total',
    ] as CounterName[]) {
      lines.push(`# TYPE ${name} counter`, `${name} ${this.counters.get(name) ?? 0}`);
    }
    lines.push('# TYPE auth_session_validation_duration_ms histogram');
    for (const bucket of VALIDATION_BUCKETS_MS) {
      lines.push(
        `auth_session_validation_duration_ms_bucket{le="${bucket}"} ${
          this.validationBuckets.get(bucket) ?? 0
        }`
      );
    }
    lines.push(
      `auth_session_validation_duration_ms_bucket{le="+Inf"} ${this.validationCount}`,
      `auth_session_validation_duration_ms_sum ${this.validationSumMs}`,
      `auth_session_validation_duration_ms_count ${this.validationCount}`
    );
    return `${lines.join('\n')}\n`;
  }
}
