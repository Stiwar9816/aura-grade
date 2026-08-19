import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdministratorTwoFactor1787414400000 implements MigrationInterface {
  name = 'AddAdministratorTwoFactor1787414400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "two_factor_secret_encrypted" text`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "two_factor_enabled_at" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "two_factor_last_counter" bigint`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "two_factor_last_counter"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "two_factor_enabled_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "two_factor_secret_encrypted"`);
  }
}
