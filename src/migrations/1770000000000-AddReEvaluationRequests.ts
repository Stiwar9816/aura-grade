import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReEvaluationRequests1770000000000 implements MigrationInterface {
  name = 'AddReEvaluationRequests1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."reevaluation_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`
    );
    await queryRunner.query(
      `CREATE TABLE "reevaluation_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reason" text NOT NULL, "status" "public"."reevaluation_requests_status_enum" NOT NULL DEFAULT 'PENDING', "teacherResponse" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reviewedAt" TIMESTAMP WITH TIME ZONE, "evaluation_id" uuid NOT NULL, "student_id" uuid NOT NULL, "teacher_id" uuid NOT NULL, CONSTRAINT "UQ_reevaluation_requests_evaluation" UNIQUE ("evaluation_id"), CONSTRAINT "PK_reevaluation_requests" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "reevaluation_requests" ADD CONSTRAINT "FK_reevaluation_requests_evaluation" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "reevaluation_requests" ADD CONSTRAINT "FK_reevaluation_requests_student" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "reevaluation_requests" ADD CONSTRAINT "FK_reevaluation_requests_teacher" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reevaluation_requests" DROP CONSTRAINT "FK_reevaluation_requests_teacher"`
    );
    await queryRunner.query(
      `ALTER TABLE "reevaluation_requests" DROP CONSTRAINT "FK_reevaluation_requests_student"`
    );
    await queryRunner.query(
      `ALTER TABLE "reevaluation_requests" DROP CONSTRAINT "FK_reevaluation_requests_evaluation"`
    );
    await queryRunner.query(`DROP TABLE "reevaluation_requests"`);
    await queryRunner.query(`DROP TYPE "public"."reevaluation_requests_status_enum"`);
  }
}
