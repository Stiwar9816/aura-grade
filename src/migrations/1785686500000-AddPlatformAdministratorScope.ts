import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformAdministratorScope1785686500000 implements MigrationInterface {
  name = 'AddPlatformAdministratorScope1785686500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"
       ADD "is_platform_admin" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `UPDATE "users"
       SET "is_platform_admin" = true
       WHERE "role" = 'Administrador'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_platform_admin"`);
  }
}
