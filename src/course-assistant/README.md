# Asistente del curso

RAG del sitio, anterior a Telegram. `CourseAssistantService` valida matrícula, aprobación, cuenta e institución antes de recuperación/API y antes de devolver la respuesta. No hay memoria conversacional ni caché de permisos/respuestas. Para notas/entregas usar `AcademicQueriesService`; esos datos nunca se indexan.

## Preparación

1. Comprobar `node scripts/verify-vector.cjs` con configuración del destino. La migración `AddCourseRag1793275200000` requiere extensión vector ya habilitada; no la instala automáticamente.
2. Aplicar migraciones con respaldo. Mantener `RAG_ENABLED=false` hasta completar configuración/verificación del destino.
3. Configurar `RAG_ENABLED=true`, `GEMINI_API_KEY`. Se usa `gemini-embedding-001` (768 dimensiones normalizadas). `RAG_GENERATION_MODEL` predeterminado `gemini-3.5-flash`; requiere soporte para JSON schema y thinkingLevel MINIMAL. Revisar disponibilidad antes de cambiar modelo. El proveedor de calificación permanece separado.
4. Docente → curso → Asistente del curso → preparar cada fuente publicada. Cada POST procesa hasta16 fragmentos y conserva avance. Cerrar detiene solicitudes siguientes; un lote ya enviado puede terminar y consumir cuota. No se consulta un curso hasta tener todas sus fuentes publicadas preparadas.

`GET /api/courses/:courseId/assistant/sources` (docente propietario), `POST .../sources/:versionId/prepare` (docente), `POST .../questions` `{question}` (estudiante). BFF exige sesión; POST comprueba origen y cuerpo <=8192bytes, pregunta3–1000caracteres. Los guards globales siguen activos.

Cuotas atómicas Redis por día de Colombia: `RAG_DAILY_QUESTIONS=20`, `RAG_GLOBAL_QUESTIONS=1000`, `RAG_DAILY_CHUNKS=512`, `RAG_GLOBAL_CHUNKS=4096`. Cada variable admite enteros1–100000; inválida impide llamadas. Una operación simultánea por actor con lease90s. API timeout20s por operación, sin reintentos; una consulta utiliza embedding y generación. Intentos fallidos consumen reserva, no se reembolsan automáticamente. Redis indisponible falla cerrado. Los límites por solicitud/fragmento/contexto/salida complementan la cuota; no representan presupuesto monetario exacto. Ajustar alertas y límites del proveedor antes de producción.

El índice usa FK por versión, modelo/revisión/hash y solo se consulta completo. La recuperación exacta por curso combina mención explícita de actividad con similitud y continuación acotada (máximo6 fragmentos). No se añadió HNSW: piloto pequeño; medir antes de optimizar. Retirar/modificar una fuente elimina sus fragmentos mediante trigger en la misma transacción; reabrir exige preparar otra vez. Se compara publicación antes/después de generación para descartar respuestas obsoletas. Las citas se construyen en servidor y se abren por el endpoint autorizado de biblioteca. Son referencias verificables; no constituyen una prueba automática de fidelidad de toda afirmación generada.

## Pruebas

- `jest --runInBand src/course-assistant`: segmentación, normalización, citas, denegación temprana, cuotas fallidas, revocación durante consulta, retiro durante generación, idempotencia y continuación.
- `RUN_RAG_INTEGRATION=true RUN_HTTP_INTEGRATION=true DB_HOST=127.0.0.1 STATE=dev ts-node -r tsconfig-paths/register scripts/verify-course-preparation.ts`: PostgreSQL y Redis reales, IA simulada, fixtures en rollback.
- `scripts/prepare-course-rag.ts` solo piloto local: vista previa por defecto; `--apply --query` usa Gemini real y conserva índices. La consulta emplea un estudiante temporal dentro de una transacción revertida. `--diagnose` imprime extractos de fuentes: uso local controlado, no habilitar en logs de producción.

Documentación del proveedor: https://ai.google.dev/gemini-api/docs/embeddings y https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.5.
