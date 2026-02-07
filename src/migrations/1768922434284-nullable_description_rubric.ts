import { MigrationInterface, QueryRunner } from "typeorm";

export class NullableDescriptionRubric1768922434284 implements MigrationInterface {
    name = 'NullableDescriptionRubric1768922434284'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rubrics" ADD "description" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "description"`);
    }

}
