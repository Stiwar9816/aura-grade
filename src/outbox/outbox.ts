import { EntityManager } from 'typeorm';
import { OutboxEvent, OutboxKind } from './entities/outbox-event.entity';

export async function recordOutboxEvent(
  manager: EntityManager,
  kind: OutboxKind,
  aggregateId: string,
  id = `${kind}-${aggregateId}`
): Promise<void> {
  await manager
    .getRepository(OutboxEvent)
    .createQueryBuilder()
    .insert()
    .values({ id, kind, aggregateId, dispatchedAt: null })
    .orIgnore()
    .execute();
}
