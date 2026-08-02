import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveInstitutionSlugAndEmailDomain1785686600000 implements MigrationInterface {
  name = 'RemoveInstitutionSlugAndEmailDomain1785686600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "institutions" DROP CONSTRAINT "UQ_institutions_slug"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "slug"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "email_domain"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "institutions" ADD "email_domain" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "slug" text`);
    await queryRunner.query(
      `UPDATE "institutions"
       SET "slug" = 'institution-' || replace("id"::text, '-', '')`
    );
    await queryRunner.query(`ALTER TABLE "institutions" ALTER COLUMN "slug" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "institutions"
       ADD CONSTRAINT "UQ_institutions_slug" UNIQUE ("slug")`
    );
  }
}
