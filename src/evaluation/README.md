# Historial de calificación para entrenamiento

Cada evaluación conserva hasta tres registros inmutables en `evaluations`:

| Columna | Cuándo se escribe | Contenido |
| --- | --- | --- |
| `original_draft_snapshot` | Al crear el borrador (IA o manual) | Nota, comentarios, criterios, modelo, `promptVersion`, rúbrica completa, texto y hash de la entrega |
| `teacher_review_snapshot` | Al publicar | Lo mismo con la versión final, `reviewerId` y `adjustment { reason, note }` |
| `reevaluation_revision_snapshot` | Una sola vez, al corregir tras una reevaluación | Versión corregida, `previousTotalScore`, `reevaluationRequestId`, `adjustment` |

Ninguno se sobrescribe. Las evaluaciones publicadas antes de `PreserveEvaluationReviewSnapshots` no tienen borrador original y quedan fuera de la exportación; las creadas antes de `AddEvaluationTrainingMetadata` tienen `promptVersion` nulo.

- **Versión del prompt:** `GRADING_PROMPT_VERSION` en `src/ai/ai.service.ts`. Subirla junto con cualquier cambio del prompt de calificación; también forma parte de la llave de caché.
- **Motivo del ajuste:** `adjustmentReason` (`EvaluationAdjustmentReason`) y `adjustmentNote` (≤500) en `UpdateEvaluationInput`. Opcionales; no afectan la nota ni se muestran al estudiante.
- **Corrección por reevaluación:** `reviseEvaluation(id, input, teacherResponse)`. Solo el docente propietario, solo sobre una evaluación publicada con solicitud pendiente o aprobada, una única vez. Si la solicitud está pendiente, la aprueba en la misma transacción y exige `teacherResponse` (10–2000). Antes, aprobar una reevaluación no cambiaba la nota: `publishEvaluation` no modifica una evaluación ya publicada.

## Exportación CSV

`POST /api/evaluations/training-export` con `{ "dataset": "evaluations" | "criteria", "includeSubmissionText"?: boolean }`.

- Solo rol Administrador. El administrador de institución recibe únicamente su institución (tomada de la sesión, nunca del cuerpo); el administrador de plataforma, todas.
- Es POST a propósito: las peticiones que modifican se auditan, así que cada descarga queda en `audit_logs` (recurso `TrainingExport`) con las opciones usadas.
- `evaluations`: una fila por evaluación con borrador, versión final, diferencia, motivo, reevaluación y corrección. `criteria`: una fila por criterio de la rúbrica vigente al calificar.
- Personas seudonimizadas con HMAC-SHA256 (`stu_…`, `tch_…`), estables entre archivos. Clave: `TRAINING_EXPORT_PSEUDONYM_SECRET`, o `JWT_SECRET` si falta; cambiarla cambia todos los seudónimos. Sin nombre, correo ni documento.
- El texto de la entrega solo se incluye con `includeSubmissionText: true` y solo en `evaluations`. Los comentarios y el motivo de reevaluación son texto libre y pueden contener datos personales escritos por sus autores.
- UTF-8 con BOM, CRLF, comillas RFC 4180 y neutralización de fórmulas (`=`, `+`, `-`, `@`) en celdas de texto.
- Se genera en memoria: adecuado para el volumen de un piloto; con decenas de miles de evaluaciones habría que paginar o transmitir.

El uso de estos datos para entrenar un modelo es una finalidad distinta a calificar. No se implementó un registro de autorización: obtenerla y decidir qué se exporta es responsabilidad de la institución.

## Pruebas

`jest test/evaluation`: registros y etiquetas, corrección por reevaluación, codificación CSV, alcance por institución, seudónimos, ausencia de datos personales y frontera HTTP. La consulta y la migración no se han ejecutado contra PostgreSQL real.
