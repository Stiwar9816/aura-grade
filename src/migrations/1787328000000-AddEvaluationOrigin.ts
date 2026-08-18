import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEvaluationOrigin1787328000000 implements MigrationInterface {
  name = 'AddEvaluationOrigin1787328000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."evaluations_origin_enum" AS ENUM('AI', 'MANUAL')`
    );
    await queryRunner.query(
      `ALTER TABLE "evaluations" ADD "origin" "public"."evaluations_origin_enum" NOT NULL DEFAULT 'AI'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "evaluations" DROP COLUMN "origin"`);
    await queryRunner.query(`DROP TYPE "public"."evaluations_origin_enum"`);
  }
}
