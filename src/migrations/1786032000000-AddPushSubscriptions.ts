import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushSubscriptions1786032000000 implements MigrationInterface {
  name = 'AddPushSubscriptions1786032000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "user_agent" text,
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_push_subscriptions_endpoint" UNIQUE ("endpoint"),
        CONSTRAINT "FK_push_subscriptions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_push_subscriptions_user" ON "push_subscriptions" ("user_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_push_subscriptions_user"`);
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}
