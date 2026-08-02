import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveInstitutionCountryAndDescription1785686700000 implements MigrationInterface {
  name = 'RemoveInstitutionCountryAndDescription1785686700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "country"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "institutions" ADD "country" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "description" text`);
  }
}
