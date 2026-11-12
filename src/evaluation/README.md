# Historial de calificación para entrenamiento

Cada evaluación conserva hasta tres registros inmutables en `evaluations`:

| Columna                          | Cuándo se escribe                               | Contenido                                                                                           |
| -------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `original_draft_snapshot`        | Al crear el borrador (IA o manual)              | Nota, comentarios, criterios, modelo, `promptVersion`, rúbrica completa, texto y hash de la entrega |
| `teacher_review_snapshot`        | Al publicar                                     | Lo mismo con la versión final, `reviewerId` y `adjustment { reason, note }`                         |
| `reevaluation_revision_snapshot` | Una sola vez, al corregir tras una reevaluación | Versión corregida, `previousTotalScore`, `reevaluationRequestId`, `adjustment`                      |

Ninguno se sobrescribe. Las evaluaciones publicadas antes de `PreserveEvaluationReviewSnapshots` no tienen borrador original y quedan fuera de la exportación; las creadas antes de `AddEvaluationTrainingMetadata` tienen `promptVersion` nulo.

- **Versión del prompt:** `GRADING_PROMPT_VERSION` en `src/ai/ai.service.ts`. Subirla junto con cualquier cambio del prompt de calificación; también forma parte de la llave de caché.
- **Motivo del ajuste:** `adjustmentReason` (`EvaluationAdjustmentReason`) y `adjustmentNote` (≤500) en `UpdateEvaluationInput`. Opcionales; no afectan la nota ni se muestran al estudiante.
- **Corrección por reevaluación:** `reviseEvaluation(id, input, teacherResponse)`. Solo el docente propietario, solo sobre una evaluación publicada con solicitud pendiente o aprobada, una única vez. Si la solicitud está pendiente, la aprueba en la misma transacción y exige `teacherResponse` (10–2000). Antes, aprobar una reevaluación no cambiaba la nota: `publishEvaluation` no modifica una evaluación ya publicada.

## Calificación con memoria

`GradingMemoryService` (activar con `GRADING_MEMORY_ENABLED=true`) entrega al modelo, junto al prompt, un resumen de cómo el mismo docente corrigió borradores anteriores de la misma rúbrica: tendencia media por criterio (docente − borrador) y hasta 5 correcciones recientes con el comentario del docente y el motivo. Lee como máximo las 30 evaluaciones publicadas más recientes y el bloque no supera 4000 caracteres.

- No viaja el trabajo de otros estudiantes ni nombres: solo notas, comentarios del docente (pasados por la limpieza de datos personales) y motivos.
- El bloque se presenta al modelo como datos, no instrucciones; la rúbrica sigue siendo la norma.
- Si falla o no hay historial, la calificación continúa sin memoria.
- Los borradores generados con memoria se etiquetan `grading-v2+memory`; sin ella, `grading-v2`. Así se comparan en el panel.
- La memoria se busca por la rúbrica asignada a la actividad: una versión nueva de la rúbrica empieza sin historial.

## Panel de precisión

`GET /api/evaluations/grading-insights?courseId=` (solo Administrador; institución tomada de la sesión). Compara el borrador de IA con la nota vigente (la corrección por reevaluación si existe), en escala 0–5:

- `meanAbsoluteDifference`: cuánto se alejó el borrador. `meanSignedDifference`: positivo si el docente calificó más alto (IA estricta). `unchangedRate`: publicadas sin cambiar la nota.
- Desglose por curso, rúbrica, criterio y **versión del prompt + modelo** (incluye tasa de reevaluación), más el conteo de motivos de ajuste.
- Los borradores manuales se excluyen. Con pocas evaluaciones por grupo las cifras no son concluyentes: el panel no calcula significancia estadística.

## Exportación CSV

`POST /api/evaluations/training-export` con `{ "dataset": "evaluations" | "criteria" | "jsonl", "includeSubmissionText"?: boolean, "courseId"?: uuid, "redactPersonalData"?: boolean }`.

- Solo rol Administrador. El administrador de institución recibe únicamente su institución (tomada de la sesión, nunca del cuerpo); el administrador de plataforma, todas.
- Es POST a propósito: las peticiones que modifican se auditan, así que cada descarga queda en `audit_logs` (recurso `TrainingExport`) con las opciones usadas.
- `evaluations`: una fila por evaluación con borrador, versión final, diferencia, motivo, reevaluación y corrección. `criteria`: una fila por criterio de la rúbrica vigente al calificar.
- Personas seudonimizadas con HMAC-SHA256 (`stu_…`, `tch_…`), estables entre archivos. Clave: `TRAINING_EXPORT_PSEUDONYM_SECRET`, o `JWT_SECRET` si falta; cambiarla cambia todos los seudónimos. Sin nombre, correo ni documento.
- `jsonl`: un ejemplo por línea con `input` (tarea, rúbrica y, si se pide, la entrega), `output` (calificación vigente del docente por criterio), `draft` (lo que propuso la IA) y `meta`.
- `courseId` limita la exportación a un curso, siempre dentro de la institución del administrador.
- El texto de la entrega solo se incluye con `includeSubmissionText: true` (en `evaluations` y `jsonl`).
- **Limpieza de datos personales** (`redactPersonalData`, activa salvo que se envíe `false`): en comentarios, notas, motivos de reevaluación y texto de entregas reemplaza correos, números largos (teléfonos, documentos) y los nombres y apellidos del estudiante y del docente de ese registro por `[CORREO]`, `[NUMERO]` y `[NOMBRE]`. Es heurística: no reconoce nombres de terceros ni datos escritos de forma inusual, y puede tapar una palabra común que coincida con un nombre. No sustituye una revisión antes de compartir el archivo.
- UTF-8 con BOM, CRLF, comillas RFC 4180 y neutralización de fórmulas (`=`, `+`, `-`, `@`) en celdas de texto.
- Se genera en memoria: adecuado para el volumen de un piloto; con decenas de miles de evaluaciones habría que paginar o transmitir.

El uso de estos datos para entrenar un modelo es una finalidad distinta a calificar. No se implementó un registro de autorización: obtenerla y decidir qué se exporta es responsabilidad de la institución.

## Pruebas

`jest test/evaluation test/submission`: registros y etiquetas, corrección por reevaluación, codificación CSV, JSONL, filtro por curso, alcance por institución, seudónimos, limpieza de datos personales, memoria de calificación, panel de precisión y frontera HTTP. La consulta y la migración no se han ejecutado contra PostgreSQL real.
