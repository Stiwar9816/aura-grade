# Consultas académicas autorizadas

Capa determinista para el futuro asistente del sitio y Telegram. No llama modelos ni almacena datos personales en índices vectoriales. Importar AcademicQueriesModule y usar AcademicQueriesService; cada llamada vuelve a autorizar estudiante activo/aprobado, institución y matrícula mediante AcademicAccessService.

## API privada

Las rutas requieren el BFF y una sesión verificada con rol Estudiante. Respuestas `Cache-Control: no-store`. El frontend tiene rutas equivalentes bajo `/api/courses/:courseId/academic-queries/` y reenvía la cookie de sesión mediante su BFF.

- `GET activities?page=1&limit=20&upcoming=true`: actividades activas ordenadas por fecha efectiva propia, con instrucciones y metadatos de la entrega más reciente. `upcoming` omite fechas efectivas pasadas; no significa “sin entregar”. Límite máximo 50; desempate estable por id. Las prórrogas de otros estudiantes no intervienen en el orden.
- `GET activities/:assignmentId/result`: actividad, entrega más reciente propia y evaluación publicada. `state` es NOT_SUBMITTED, AWAITING_PUBLICATION o PUBLISHED. La nota puede ser cero; ausencia de evaluación se representa con null. `submission.status` conserva el estado operativo de la entrega, incluido FAILED.

No exponer studentId como parámetro del modelo: el controlador lo obtiene de la sesión; un futuro adaptador Telegram deberá obtenerlo de la vinculación validada. Los métodos de servicio también vuelven a autorizar. Una tarea en cola debe llamar el servicio al ejecutarse, no persistir una autorización anterior.

El DTO de evaluación permite id, totalScore, generalFeedback y criteria con identificador/nombre/score/weight/feedback. Normaliza criteriaId/criterionId y feedback/observations; descarta claves arbitrarias del JSON. No devuelve instantáneas de IA/revisión, almacenamiento, archivos, texto entregado ni entidades de terceros. La lectura histórica de EvaluationService sigue intacta.

## Comprobación

`jest test/academic-queries --runInBand` cubre DTO y frontera HTTP. La integración real está en:

```sh
RUN_HTTP_INTEGRATION=true DB_HOST=127.0.0.1 STATE=dev ./node_modules/.bin/ts-node -r tsconfig-paths/register scripts/verify-course-preparation.ts
```

Usa PostgreSQL transaccional, Redis local, controladores y guards reales. La sesión se emite sintéticamente para usuarios de prueba: no prueba el ingreso por contraseña/OTP ni envía correos. Revoca sesiones y revierte fixtures. No es una prueba de navegador ni una evaluación de respuestas de RAG.
