import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1766346392928 implements MigrationInterface {
    name = 'InitialMigration1766346392928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "courses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "course_name" text NOT NULL, "code_course" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rubrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" text NOT NULL, "maxTotalScore" numeric(5,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_3dfcdc7f63f3fa048ebe0293a90" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_document_type_enum" AS ENUM('Cedula de ciudadania', 'Pasaporte', 'Registro civil', 'Cedula de extranjeria', 'Libreta militar', 'Tarjeta de identidad')`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('Administrador', 'Estudiante', 'Docente')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "last_name" text NOT NULL, "document_type" "public"."users_document_type_enum" NOT NULL, "document_num" bigint NOT NULL, "phone" bigint NOT NULL, "email" text NOT NULL, "password" text NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "role" "public"."users_role_enum" NOT NULL DEFAULT 'Estudiante', CONSTRAINT "UQ_81fdf301cef64ffba09ed1c76cd" UNIQUE ("document_num"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" text NOT NULL, "description" text NOT NULL, "dueDate" TIMESTAMP WITH TIME ZONE NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "rubric_id" uuid NOT NULL, CONSTRAINT "PK_c54ca359535e0012b04dcbd80ee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'REVIEW_PENDING', 'PUBLISHED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fileUrl" text, "extractedText" text, "status" "public"."submissions_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "student_id" uuid NOT NULL, "assignment_id" uuid NOT NULL, CONSTRAINT "PK_10b3be95b8b2fb1e482e07d706b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."evaluations_status_enum" AS ENUM('DRAFT', 'PUBLISHED')`);
        await queryRunner.query(`CREATE TABLE "evaluations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "totalScore" numeric(5,2) NOT NULL, "generalFeedback" text NOT NULL, "detailedFeedback" jsonb NOT NULL, "aiModelUsed" text, "status" "public"."evaluations_status_enum" NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "submission_id" uuid, CONSTRAINT "REL_de43922d2ba87818005fb8edb2" UNIQUE ("submission_id"), CONSTRAINT "PK_f683b433eba0e6dae7e19b29e29" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "criteria" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" text NOT NULL, "maxPoints" integer NOT NULL DEFAULT '0', "levels" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "rubric_id" uuid NOT NULL, CONSTRAINT "PK_91cd5f7ff7be5ade9bca5b98cfb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "course_users" ("courseId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_ab3a325a610b47f65dbb717d500" PRIMARY KEY ("courseId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_32e114cc1e4199c7de081e092a" ON "course_users" ("courseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ec0b6388e3b40c292c8ae1d2f0" ON "course_users" ("userId") `);
        await queryRunner.query(`ALTER TABLE "rubrics" ADD CONSTRAINT "FK_871af8ca2662e7853bf456f4d90" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assignments" ADD CONSTRAINT "FK_3e96b2dc80534b727b58b87b85f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assignments" ADD CONSTRAINT "FK_914d55c4238d70b60f9f709df1a" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD CONSTRAINT "FK_435def3bbd4b4bbb9de1209cdae" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD CONSTRAINT "FK_8723840b9b0464206640c268abc" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluations" ADD CONSTRAINT "FK_de43922d2ba87818005fb8edb27" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "criteria" ADD CONSTRAINT "FK_156799c1263c0995b08d8ff21b7" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "course_users" ADD CONSTRAINT "FK_32e114cc1e4199c7de081e092a1" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "course_users" ADD CONSTRAINT "FK_ec0b6388e3b40c292c8ae1d2f07" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "course_users" DROP CONSTRAINT "FK_ec0b6388e3b40c292c8ae1d2f07"`);
        await queryRunner.query(`ALTER TABLE "course_users" DROP CONSTRAINT "FK_32e114cc1e4199c7de081e092a1"`);
        await queryRunner.query(`ALTER TABLE "criteria" DROP CONSTRAINT "FK_156799c1263c0995b08d8ff21b7"`);
        await queryRunner.query(`ALTER TABLE "evaluations" DROP CONSTRAINT "FK_de43922d2ba87818005fb8edb27"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_8723840b9b0464206640c268abc"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_435def3bbd4b4bbb9de1209cdae"`);
        await queryRunner.query(`ALTER TABLE "assignments" DROP CONSTRAINT "FK_914d55c4238d70b60f9f709df1a"`);
        await queryRunner.query(`ALTER TABLE "assignments" DROP CONSTRAINT "FK_3e96b2dc80534b727b58b87b85f"`);
        await queryRunner.query(`ALTER TABLE "rubrics" DROP CONSTRAINT "FK_871af8ca2662e7853bf456f4d90"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec0b6388e3b40c292c8ae1d2f0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32e114cc1e4199c7de081e092a"`);
        await queryRunner.query(`DROP TABLE "course_users"`);
        await queryRunner.query(`DROP TABLE "criteria"`);
        await queryRunner.query(`DROP TABLE "evaluations"`);
        await queryRunner.query(`DROP TYPE "public"."evaluations_status_enum"`);
        await queryRunner.query(`DROP TABLE "submissions"`);
        await queryRunner.query(`DROP TYPE "public"."submissions_status_enum"`);
        await queryRunner.query(`DROP TABLE "assignments"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_document_type_enum"`);
        await queryRunner.query(`DROP TABLE "rubrics"`);
        await queryRunner.query(`DROP TABLE "courses"`);
    }

}
