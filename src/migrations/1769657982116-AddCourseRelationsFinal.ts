import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCourseRelationsFinal1769657982116 implements MigrationInterface {
    name = 'AddCourseRelationsFinal1769657982116'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" ADD "user_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "assignments" ADD "course_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "courses" ADD CONSTRAINT "FK_a4396a5235f159ab156a6f8b603" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assignments" ADD CONSTRAINT "FK_33f833f305070d2d4e6305d8a0c" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assignments" DROP CONSTRAINT "FK_33f833f305070d2d4e6305d8a0c"`);
        await queryRunner.query(`ALTER TABLE "courses" DROP CONSTRAINT "FK_a4396a5235f159ab156a6f8b603"`);
        await queryRunner.query(`ALTER TABLE "assignments" DROP COLUMN "course_id"`);
        await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "user_id"`);
    }

}
