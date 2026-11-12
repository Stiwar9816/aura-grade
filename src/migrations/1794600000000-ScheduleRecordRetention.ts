import { MigrationInterface, QueryRunner } from 'typeorm';

export const RETENTION_JOB_NAME = 'aura-grade-purge-expired-records';
// 08:30 GMT = 03:30 America/Bogota, outside academic hours.
const RETENTION_SCHEDULE = '30 8 * * *';

/**
 * Daily retention with pg_cron (Supabase and the local image both preload it).
 * Windows keep every row the application can still rely on for idempotency:
 * - outbox events outlive BullMQ job retention (7 days completed / 30 failed); grading events of
 *   submissions still waiting are kept because the reconciler re-dispatches from them;
 * - notification deliveries go only once their outbox event is gone, otherwise the reconciler
 *   would see channels as unsent and notify again.
 */
const PURGE_FUNCTION = `
CREATE OR REPLACE FUNCTION public.purge_expired_records() RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  affected bigint;
BEGIN
  DELETE FROM audit_logs WHERE occurred_at < now() - interval '30 days';
  GET DIAGNOSTICS affected = ROW_COUNT;
  result := result || jsonb_build_object('audit_logs', affected);

  DELETE FROM outbox_events event
  WHERE event.dispatched_at < now() - interval '30 days'
    AND NOT (
      event.kind = 'grading' AND EXISTS (
        SELECT 1 FROM submissions submission
        WHERE submission.id = event.aggregate_id
          AND submission.status IN ('PENDING', 'IN_PROGRESS')
      )
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  result := result || jsonb_build_object('outbox_events', affected);

  DELETE FROM notification_deliveries delivery
  WHERE delivery.created_at < now() - interval '90 days'
    AND delivery.status <> 'PROCESSING'
    AND NOT EXISTS (SELECT 1 FROM outbox_events event WHERE event.id = delivery.event_key);
  GET DIAGNOSTICS affected = ROW_COUNT;
  result := result || jsonb_build_object('notification_deliveries', affected);

  DELETE FROM in_app_notifications
  WHERE read_at < now() - interval '90 days' OR created_at < now() - interval '180 days';
  GET DIAGNOSTICS affected = ROW_COUNT;
  result := result || jsonb_build_object('in_app_notifications', affected);

  DELETE FROM telegram_link_tokens
  WHERE coalesce(used_at, expires_at) < now() - interval '1 day';
  GET DIAGNOSTICS affected = ROW_COUNT;
  result := result || jsonb_build_object('telegram_link_tokens', affected);

  RETURN result;
END;
$$`;

export class ScheduleRecordRetention1794600000000 implements MigrationInterface {
  name = 'ScheduleRecordRetention1794600000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(PURGE_FUNCTION);
    await runner.query('REVOKE ALL ON FUNCTION public.purge_expired_records() FROM PUBLIC');

    const [cron] = await runner.query(
      `SELECT 1 FROM pg_available_extensions
       WHERE name = 'pg_cron'
         AND string_to_array(replace(current_setting('shared_preload_libraries'), ' ', ''), ',')
           @> ARRAY['pg_cron']`
    );
    if (!cron) {
      // Only disposable CI databases may run without the scheduler; every real one has it.
      if (process.env.ALLOW_MISSING_PG_CRON === 'true') return;
      throw new Error(
        'pg_cron no está precargado. Usa la imagen local (docker compose) o Supabase antes de migrar.'
      );
    }
    await runner.query('CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog');
    await runner.query('SELECT cron.schedule($1, $2, $3)', [
      RETENTION_JOB_NAME,
      RETENTION_SCHEDULE,
      'SELECT public.purge_expired_records()',
    ]);
  }

  async down(runner: QueryRunner): Promise<void> {
    const [cron] = await runner.query("SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'");
    if (cron)
      await runner.query('SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = $1', [
        RETENTION_JOB_NAME,
      ]);
    await runner.query('DROP FUNCTION IF EXISTS public.purge_expired_records()');
  }
}
