import { hashSync } from 'bcryptjs';
import { MigrationInterface, QueryRunner } from 'typeorm';

const requiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} es obligatorio para inicializar la configuración institucional.`);
  }
  return value;
};

const bootstrapPassword = (): string => {
  const password = requiredEnvironment('BOOTSTRAP_ADMIN_PASSWORD');
  if (
    password.length < 12 ||
    password.length > 30 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD debe tener entre 12 y 30 caracteres e incluir mayúsculas, minúsculas y un número.'
    );
  }
  return password;
};

export class AddInstitutionTenancyAndApproval1785258000000 implements MigrationInterface {
  name = 'AddInstitutionTenancyAndApproval1785258000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "institutions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "email_domain" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_institutions_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_institutions" PRIMARY KEY ("id")
      )`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_approval_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "approvalStatus" "public"."users_approval_status_enum" NOT NULL DEFAULT 'PENDING'`
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "institution_id" uuid`);

    const institutionName = requiredEnvironment('BOOTSTRAP_INSTITUTION_NAME');
    const institutionSlug = requiredEnvironment('BOOTSTRAP_INSTITUTION_SLUG').toLowerCase();
    const institutionDomain = requiredEnvironment(
      'BOOTSTRAP_INSTITUTION_EMAIL_DOMAIN'
    ).toLowerCase();
    const institutionRows = (await queryRunner.query(
      `INSERT INTO "institutions" ("name", "slug", "email_domain")
       VALUES ($1, $2, $3)
       ON CONFLICT ("slug") DO UPDATE SET
         "name" = EXCLUDED."name",
         "email_domain" = EXCLUDED."email_domain",
         "updatedAt" = now()
       RETURNING "id"`,
      [institutionName, institutionSlug, institutionDomain]
    )) as Array<{ id: string }>;
    const institutionId = institutionRows[0]?.id;

    if (!institutionId) {
      throw new Error('No se pudo crear la institución inicial.');
    }

    await queryRunner.query(
      `UPDATE "users"
       SET "institution_id" = $1, "approvalStatus" = 'APPROVED'
       WHERE "institution_id" IS NULL`,
      [institutionId]
    );

    const existingAdministrators = (await queryRunner.query(
      `SELECT "id" FROM "users" WHERE "role" = 'Administrador' LIMIT 1`
    )) as Array<{ id: string }>;

    if (existingAdministrators.length === 0) {
      const email = requiredEnvironment('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
      const password = bootstrapPassword();
      const name = requiredEnvironment('BOOTSTRAP_ADMIN_NAME');
      const lastName = requiredEnvironment('BOOTSTRAP_ADMIN_LAST_NAME');
      const documentNumber = requiredEnvironment('BOOTSTRAP_ADMIN_DOCUMENT_NUM');
      const phone = requiredEnvironment('BOOTSTRAP_ADMIN_PHONE');
      const passwordHash = hashSync(password, 12);

      await queryRunner.query(
        `INSERT INTO "users" (
          "name", "last_name", "document_type", "document_num", "phone",
          "email", "password", "isActive", "role", "authVersion",
          "approvalStatus", "institution_id"
        ) VALUES ($1, $2, 'Cedula de ciudadania', $3, $4, $5, $6, true,
          'Administrador', 1, 'APPROVED', $7)`,
        [name, lastName, documentNumber, phone, email, passwordHash, institutionId]
      );
    }

    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "institution_id" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "users"
       ADD CONSTRAINT "FK_users_institution"
       FOREIGN KEY ("institution_id") REFERENCES "institutions"("id")
       ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_institution_approval"
       ON "users" ("institution_id", "approvalStatus")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_institution_approval"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_institution"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "institution_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "approvalStatus"`);
    await queryRunner.query(`DROP TYPE "public"."users_approval_status_enum"`);
    await queryRunner.query(`DROP TABLE "institutions"`);
  }
}
