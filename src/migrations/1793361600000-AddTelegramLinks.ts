import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTelegramLinks1793361600000 implements MigrationInterface {
  name = 'AddTelegramLinks1793361600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "telegram_link_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" char(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_telegram_link_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_telegram_link_tokens_hash" UNIQUE ("token_hash"),
        CONSTRAINT "FK_telegram_link_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_link_tokens_user" ON "telegram_link_tokens" ("user_id", "created_at")`
    );
    await queryRunner.query(`
      CREATE TABLE "telegram_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "telegram_user_id" bigint NOT NULL,
        "chat_id" bigint NOT NULL,
        "selected_course_id" uuid,
        "linked_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_telegram_links" PRIMARY KEY ("id"),
        CONSTRAINT "FK_telegram_links_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_telegram_links_course" FOREIGN KEY ("selected_course_id")
          REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_telegram_links_active_user" ON "telegram_links" ("user_id") WHERE "revoked_at" IS NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_telegram_links_active_telegram_user" ON "telegram_links" ("telegram_user_id") WHERE "revoked_at" IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_telegram_links_active_telegram_user"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_telegram_links_active_user"`);
    await queryRunner.query(`DROP TABLE "telegram_links"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_telegram_link_tokens_user"`);
    await queryRunner.query(`DROP TABLE "telegram_link_tokens"`);
  }
}
