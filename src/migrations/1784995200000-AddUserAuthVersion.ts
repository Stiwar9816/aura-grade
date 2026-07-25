import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAuthVersion1784995200000 implements MigrationInterface {
  name = 'AddUserAuthVersion1784995200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "authVersion" integer NOT NULL DEFAULT 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "authVersion"`);
  }
}
