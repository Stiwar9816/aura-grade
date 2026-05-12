import { MigrationInterface, QueryRunner } from "typeorm";

export class NullableDescriptionRubric1768922434284 implements MigrationInterface {
    name = 'NullableDescriptionRubric1768922434284'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rubrics" ALTER COLUMN "description" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rubrics" ALTER COLUMN "description" SET NOT NULL`);
    }

}
