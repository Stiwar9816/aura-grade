/**
 * Hosted Redis (Upstash) bills per command. With BullMQ defaults every idle worker long-polls
 * every 5s and every QueueEvents listener every 10s, which costs ~100k commands/day for this API
 * with no traffic at all. BZPOPMIN/XREAD return as soon as a job or event arrives, so longer
 * blocking timeouts only cut idle polling; they do not delay processing. Pending delayed jobs
 * (retry backoff) still wake the worker on time because BullMQ caps the block at their due time.
 */
export const IDLE_EFFICIENT_WORKER_OPTIONS = {
  drainDelay: 300,
  stalledInterval: 300_000,
} as const;

export const IDLE_EFFICIENT_QUEUE_EVENTS_OPTIONS = {
  blockingTimeout: 300_000,
} as const;
