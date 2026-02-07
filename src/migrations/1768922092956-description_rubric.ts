import { MigrationInterface, QueryRunner } from "typeorm";

export class DescriptionRubric1768922092956 implements MigrationInterface {
    name = 'DescriptionRubric1768922092956'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rubrics" ADD "description" text NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "description"`);
    }

}
