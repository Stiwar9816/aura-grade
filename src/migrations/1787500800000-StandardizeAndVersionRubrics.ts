import { MigrationInterface, QueryRunner } from 'typeorm';

export class StandardizeAndVersionRubrics1787500800000 implements MigrationInterface {
  name = 'StandardizeAndVersionRubrics1787500800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."rubrics_academic_level_enum" AS ENUM('UNIVERSITARIO', 'POSGRADO')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rubrics_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED')`
    );
    await queryRunner.query(`CREATE TYPE "public"."rubrics_source_enum" AS ENUM('MANUAL', 'AI')`);
    await queryRunner.query(
      `ALTER TABLE "rubrics" ADD "academic_level" "public"."rubrics_academic_level_enum" NOT NULL DEFAULT 'UNIVERSITARIO'`
    );
    await queryRunner.query(
      `ALTER TABLE "rubrics" ADD "status" "public"."rubrics_status_enum" NOT NULL DEFAULT 'DRAFT'`
    );
    await queryRunner.query(
      `ALTER TABLE "rubrics" ADD "source" "public"."rubrics_source_enum" NOT NULL DEFAULT 'MANUAL'`
    );
    await queryRunner.query(`ALTER TABLE "rubrics" ADD "version" integer NOT NULL DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE "rubrics" ADD "root_rubric_id" uuid`);
    await queryRunner.query(`ALTER TABLE "rubrics" ADD "previous_version_id" uuid`);
    await queryRunner.query(`ALTER TABLE "rubrics" ADD "published_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "rubrics" ADD "ai_model" text`);
    await queryRunner.query(`ALTER TABLE "rubrics" ADD "prompt_version" text`);
    await queryRunner.query(`ALTER TABLE "rubrics" ADD "legacy_max_total_score" numeric(5,2)`);
    await queryRunner.query(`ALTER TABLE "rubrics" ADD "standardization_metadata" jsonb`);

    await queryRunner.query(`ALTER TABLE "criteria" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "criteria" ADD "weight" numeric(5,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "criteria" ADD "sort_order" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "criteria" ADD "legacy_max_points" integer`);
    await queryRunner.query(`ALTER TABLE "criteria" ADD "legacy_levels" jsonb`);

    await queryRunner.query(`ALTER TABLE "evaluations" ADD "legacy_total_score" numeric(5,2)`);
    await queryRunner.query(`ALTER TABLE "evaluations" ADD "legacy_max_score" numeric(5,2)`);
    await queryRunner.query(`ALTER TABLE "evaluations" ADD "legacy_detailed_feedback" jsonb`);
    await queryRunner.query(`ALTER TABLE "evaluations" ADD "standardization_metadata" jsonb`);

    await queryRunner.query(`
      UPDATE "rubrics"
      SET "legacy_max_total_score" = "maxTotalScore",
          "standardization_metadata" = jsonb_build_object(
            'standardizedAt', CURRENT_TIMESTAMP,
            'previousMaxTotalScore', "maxTotalScore",
            'targetMaxTotalScore', 5.0
          )
    `);
    await queryRunner.query(`
      UPDATE "criteria"
      SET "legacy_max_points" = "maxPoints",
          "legacy_levels" = "levels",
          "description" = COALESCE(NULLIF(BTRIM("title"), ''), 'Criterio académico')
    `);
    await queryRunner.query(`
      UPDATE "evaluations" e
      SET "legacy_total_score" = e."totalScore",
          "legacy_max_score" = r."maxTotalScore",
          "legacy_detailed_feedback" = e."detailedFeedback"
      FROM "submissions" s
      JOIN "assignments" a ON a.id = s.assignment_id
      JOIN "rubrics" r ON r.id = a.rubric_id
      WHERE e.submission_id = s.id
    `);

    await queryRunner.query(`
      UPDATE "evaluations" e
      SET "totalScore" = ROUND(
        LEAST(5.0, GREATEST(0.0, e."totalScore" / NULLIF(r."maxTotalScore", 0) * 5.0)),
        2
      )
      FROM "submissions" s
      JOIN "assignments" a ON a.id = s.assignment_id
      JOIN "rubrics" r ON r.id = a.rubric_id
      WHERE e.submission_id = s.id
        AND r."maxTotalScore" > 0
    `);

    await queryRunner.query(`
      WITH evaluation_context AS (
        SELECT e.id AS evaluation_id,
               e."detailedFeedback" AS feedback,
               r.id AS rubric_id,
               r."maxTotalScore" AS rubric_max_score
        FROM "evaluations" e
        JOIN "submissions" s ON s.id = e.submission_id
        JOIN "assignments" a ON a.id = s.assignment_id
        JOIN "rubrics" r ON r.id = a.rubric_id
        WHERE jsonb_typeof(e."detailedFeedback") = 'array'
      ),
      converted AS (
        SELECT context.evaluation_id,
               jsonb_agg(
                 item.value || jsonb_build_object(
                   'legacyScore', item.value->'score',
                   'score', ROUND(
                     LEAST(5.0, GREATEST(0.0,
                       COALESCE(NULLIF(item.value->>'score', '')::numeric, 0)
                       / NULLIF(
                         COALESCE(
                           c."maxPoints"::numeric,
                           context.rubric_max_score / NULLIF(totals.criterion_count, 0)
                         ), 0
                       ) * 5.0
                     )), 2
                   ),
                   'weight', ROUND(
                     CASE
                       WHEN totals.total_points > 0
                         THEN COALESCE(
                           c."maxPoints"::numeric,
                           totals.total_points / NULLIF(totals.criterion_count, 0)
                         ) / totals.total_points * 100
                       ELSE 100.0 / NULLIF(totals.criterion_count, 0)
                     END, 2
                   ),
                   'weightedContribution', ROUND(
                     LEAST(5.0, GREATEST(0.0,
                       COALESCE(NULLIF(item.value->>'score', '')::numeric, 0)
                       / NULLIF(
                         COALESCE(
                           c."maxPoints"::numeric,
                           context.rubric_max_score / NULLIF(totals.criterion_count, 0)
                         ), 0
                       ) * 5.0
                     )) *
                     CASE
                       WHEN totals.total_points > 0
                         THEN COALESCE(
                           c."maxPoints"::numeric,
                           totals.total_points / NULLIF(totals.criterion_count, 0)
                         ) / totals.total_points
                       ELSE 1.0 / NULLIF(totals.criterion_count, 0)
                     END, 2
                   )
                 ) ORDER BY item.ordinality
               ) AS feedback
        FROM evaluation_context context
        CROSS JOIN LATERAL jsonb_array_elements(context.feedback)
          WITH ORDINALITY AS item(value, ordinality)
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(all_c."maxPoints"), 0)::numeric AS total_points,
                 COUNT(all_c.id)::numeric AS criterion_count
          FROM "criteria" all_c
          WHERE all_c.rubric_id = context.rubric_id
        ) totals
        LEFT JOIN "criteria" c
          ON c.rubric_id = context.rubric_id
         AND (
           c.id::text = item.value->>'criteriaId'
           OR LOWER(c.title) = LOWER(
             COALESCE(item.value->>'criterion', item.value->>'name', '')
           )
         )
        GROUP BY context.evaluation_id
      )
      UPDATE "evaluations" e
      SET "detailedFeedback" = converted.feedback
      FROM converted
      WHERE e.id = converted.evaluation_id
        AND converted.feedback IS NOT NULL
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT c.id,
               ROW_NUMBER() OVER (PARTITION BY c.rubric_id ORDER BY c."createdAt", c.id) - 1 AS position,
               COUNT(*) OVER (PARTITION BY c.rubric_id) AS criterion_count,
               SUM(c."maxPoints") OVER (PARTITION BY c.rubric_id) AS total_points
        FROM "criteria" c
      )
      UPDATE "criteria" c
      SET "sort_order" = ranked.position,
          "weight" = ROUND(
            CASE
              WHEN ranked.total_points > 0 THEN c."maxPoints"::numeric / ranked.total_points * 100
              ELSE 100.0 / ranked.criterion_count
            END,
            2
          )
      FROM ranked
      WHERE ranked.id = c.id
    `);
    await queryRunner.query(`
      WITH totals AS (
        SELECT rubric_id, SUM(weight) AS weight_sum, MAX(sort_order) AS last_position
        FROM "criteria"
        GROUP BY rubric_id
      )
      UPDATE "criteria" c
      SET "weight" = c."weight" + (100.0 - totals.weight_sum)
      FROM totals
      WHERE c.rubric_id = totals.rubric_id
        AND c."sort_order" = totals.last_position
    `);
    await queryRunner.query(`
      UPDATE "criteria"
      SET "maxPoints" = 5,
          "levels" = jsonb_build_array(
            jsonb_build_object(
              'label', 'Excelente', 'minScore', 4.5, 'maxScore', 5.0, 'score', 5.0,
              'description', 'Demuestra un dominio excelente, completo y preciso de ' || "title" || '.'
            ),
            jsonb_build_object(
              'label', 'Bueno', 'minScore', 4.0, 'maxScore', 4.49, 'score', 4.49,
              'description', 'Demuestra un buen dominio de ' || "title" || ', con oportunidades menores de mejora.'
            ),
            jsonb_build_object(
              'label', 'Aceptable', 'minScore', 3.0, 'maxScore', 3.99, 'score', 3.99,
              'description', 'Cumple de forma aceptable los aspectos esenciales de ' || "title" || ', aunque requiere mejoras.'
            ),
            jsonb_build_object(
              'label', 'Insuficiente', 'minScore', 0.0, 'maxScore', 2.99, 'score', 2.99,
              'description', 'No demuestra todavía el dominio mínimo esperado de ' || "title" || '.'
            )
          )
    `);
    await queryRunner.query(`
      WITH evaluation_context AS (
        SELECT e.id AS evaluation_id,
               e."detailedFeedback" AS feedback,
               r.id AS rubric_id
        FROM "evaluations" e
        JOIN "submissions" s ON s.id = e.submission_id
        JOIN "assignments" a ON a.id = s.assignment_id
        JOIN "rubrics" r ON r.id = a.rubric_id
        WHERE jsonb_typeof(e."detailedFeedback") = 'array'
      ),
      converted AS (
        SELECT context.evaluation_id,
               jsonb_agg(
                 item.value || jsonb_build_object(
                   'score', ROUND(
                     LEAST(5.0, GREATEST(0.0,
                       COALESCE(
                         NULLIF(item.value->>'legacyScore', '')::numeric,
                         NULLIF(item.value->>'score', '')::numeric,
                         0
                       ) / NULLIF(COALESCE(c."legacy_max_points", 5), 0) * 5.0
                     )), 2
                   ),
                   'weight', c."weight",
                   'weightedContribution', ROUND(
                     LEAST(5.0, GREATEST(0.0,
                       COALESCE(
                         NULLIF(item.value->>'legacyScore', '')::numeric,
                         NULLIF(item.value->>'score', '')::numeric,
                         0
                       ) / NULLIF(COALESCE(c."legacy_max_points", 5), 0) * 5.0
                     )) * c."weight" / 100.0, 2
                   )
                 ) ORDER BY item.ordinality
               ) AS feedback
        FROM evaluation_context context
        CROSS JOIN LATERAL jsonb_array_elements(context.feedback)
          WITH ORDINALITY AS item(value, ordinality)
        LEFT JOIN LATERAL (
          SELECT candidate.*
          FROM "criteria" candidate
          WHERE candidate.rubric_id = context.rubric_id
            AND (
              LOWER(candidate.title) = LOWER(
                COALESCE(item.value->>'criterion', item.value->>'name', '')
              )
              OR candidate."sort_order" = item.ordinality - 1
            )
          ORDER BY
            CASE WHEN LOWER(candidate.title) = LOWER(
              COALESCE(item.value->>'criterion', item.value->>'name', '')
            ) THEN 0 ELSE 1 END,
            candidate."sort_order"
          LIMIT 1
        ) c ON TRUE
        GROUP BY context.evaluation_id
      )
      UPDATE "evaluations" e
      SET "detailedFeedback" = converted.feedback
      FROM converted
      WHERE e.id = converted.evaluation_id
        AND converted.feedback IS NOT NULL
    `);
    await queryRunner.query(`
      WITH totals AS (
        SELECT e.id AS evaluation_id,
               ROUND(
                 COALESCE(SUM(NULLIF(item.value->>'weightedContribution', '')::numeric), 0),
                 2
               ) AS weighted_total
        FROM "evaluations" e
        CROSS JOIN LATERAL jsonb_array_elements(e."detailedFeedback") item(value)
        WHERE jsonb_typeof(e."detailedFeedback") = 'array'
        GROUP BY e.id
      )
      UPDATE "evaluations" e
      SET "standardization_metadata" = jsonb_build_object(
        'standardizedAt', CURRENT_TIMESTAMP,
        'convertedTotalScore', e."totalScore",
        'weightedDetailTotal', totals.weighted_total,
        'historicalDifference', ROUND(e."totalScore" - totals.weighted_total, 2),
        'preservedHistoricalGrade', TRUE
      )
      FROM totals
      WHERE e.id = totals.evaluation_id
    `);
    await queryRunner.query(`
      UPDATE "rubrics" r
      SET "maxTotalScore" = 5.0,
          "root_rubric_id" = r.id,
          "status" = CASE
            WHEN EXISTS (SELECT 1 FROM "assignments" a WHERE a.rubric_id = r.id)
              THEN 'PUBLISHED'::"public"."rubrics_status_enum"
            ELSE 'DRAFT'::"public"."rubrics_status_enum"
          END,
          "published_at" = CASE
            WHEN EXISTS (SELECT 1 FROM "assignments" a WHERE a.rubric_id = r.id)
              THEN COALESCE(r."updatedAt", CURRENT_TIMESTAMP)
            ELSE NULL
          END
    `);

    await queryRunner.query(
      `ALTER TABLE "rubrics" ADD CONSTRAINT "CHK_rubrics_standard_max_score" CHECK ("maxTotalScore" = 5.0)`
    );
    await queryRunner.query(
      `ALTER TABLE "criteria" ADD CONSTRAINT "CHK_criteria_standard_max_points" CHECK ("maxPoints" = 5)`
    );
    await queryRunner.query(
      `ALTER TABLE "criteria" ADD CONSTRAINT "CHK_criteria_weight_range" CHECK ("weight" > 0 AND "weight" <= 100)`
    );
    await queryRunner.query(
      `ALTER TABLE "rubrics" ADD CONSTRAINT "FK_rubrics_previous_version" FOREIGN KEY ("previous_version_id") REFERENCES "rubrics"("id") ON DELETE SET NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_rubrics_root_version" ON "rubrics" ("root_rubric_id", "version")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_rubrics_root_version"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP CONSTRAINT "FK_rubrics_previous_version"`);
    await queryRunner.query(`ALTER TABLE "criteria" DROP CONSTRAINT "CHK_criteria_weight_range"`);
    await queryRunner.query(
      `ALTER TABLE "criteria" DROP CONSTRAINT "CHK_criteria_standard_max_points"`
    );
    await queryRunner.query(
      `ALTER TABLE "rubrics" DROP CONSTRAINT "CHK_rubrics_standard_max_score"`
    );

    await queryRunner.query(`
      UPDATE "evaluations"
      SET "totalScore" = COALESCE("legacy_total_score", "totalScore"),
          "detailedFeedback" = COALESCE("legacy_detailed_feedback", "detailedFeedback")
    `);
    await queryRunner.query(`
      UPDATE "criteria"
      SET "maxPoints" = COALESCE("legacy_max_points", "maxPoints"),
          "levels" = COALESCE("legacy_levels", "levels")
    `);
    await queryRunner.query(`
      UPDATE "rubrics"
      SET "maxTotalScore" = COALESCE("legacy_max_total_score", "maxTotalScore")
    `);

    await queryRunner.query(`ALTER TABLE "evaluations" DROP COLUMN "standardization_metadata"`);
    await queryRunner.query(`ALTER TABLE "evaluations" DROP COLUMN "legacy_detailed_feedback"`);
    await queryRunner.query(`ALTER TABLE "evaluations" DROP COLUMN "legacy_max_score"`);
    await queryRunner.query(`ALTER TABLE "evaluations" DROP COLUMN "legacy_total_score"`);
    await queryRunner.query(`ALTER TABLE "criteria" DROP COLUMN "legacy_levels"`);
    await queryRunner.query(`ALTER TABLE "criteria" DROP COLUMN "legacy_max_points"`);
    await queryRunner.query(`ALTER TABLE "criteria" DROP COLUMN "sort_order"`);
    await queryRunner.query(`ALTER TABLE "criteria" DROP COLUMN "weight"`);
    await queryRunner.query(`ALTER TABLE "criteria" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "standardization_metadata"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "legacy_max_total_score"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "prompt_version"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "ai_model"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "published_at"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "previous_version_id"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "root_rubric_id"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "version"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "source"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "rubrics" DROP COLUMN "academic_level"`);
    await queryRunner.query(`DROP TYPE "public"."rubrics_source_enum"`);
    await queryRunner.query(`DROP TYPE "public"."rubrics_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."rubrics_academic_level_enum"`);
  }
}
