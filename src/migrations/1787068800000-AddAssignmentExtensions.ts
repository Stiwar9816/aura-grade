import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentExtensions1787068800000 implements MigrationInterface {
  name = 'AddAssignmentExtensions1787068800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assignment_extensions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assignment_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "granted_by_id" uuid NOT NULL,
        "extended_due_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assignment_extensions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_assignment_extensions_assignment_student"
          UNIQUE ("assignment_id", "student_id"),
        CONSTRAINT "FK_assignment_extensions_assignment"
          FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_assignment_extensions_student"
          FOREIGN KEY ("student_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_assignment_extensions_granted_by"
          FOREIGN KEY ("granted_by_id") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_assignment_extensions_student_due_date"
      ON "assignment_extensions" ("student_id", "extended_due_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_assignment_extensions_student_due_date"`);
    await queryRunner.query(`DROP TABLE "assignment_extensions"`);
  }
}
