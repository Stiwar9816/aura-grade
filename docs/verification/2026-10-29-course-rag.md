# Verificación del asistente del curso — 29 de octubre de 2026

Implementado en dev de backend/frontend. Sin push ni despliegue. Telegram sigue pendiente.

## Resultado local

- Respaldo previo: `.tmp/backups/pre-vector-1793215502506.dump`, 216330 bytes, restauración temporal verificada.
- Migraciones `AddCourseRag1793275200000` e `InvalidateRagOnTextChanges1793275201000` aplicadas; pgvector ya estaba habilitado. La segunda protege también cambios de texto DOCX sin páginas.
- API local habilitada con `RAG_ENABLED=true`; health posterior: database, redis_bullmq y storage up. Producción conserva default false; comprobar vector, migraciones y credenciales en el destino antes de habilitar.
- Gemini real preparó 60 fragmentos: cronograma V1 (2) y guía V1 (58) del curso Algortimos II. Preparar otra vez no hizo llamadas de embedding. Estado final: ambas completas.
- Consulta real: «¿Qué criterios se evalúan en la actividad 3, examen parcial?». Respuesta: comprensión conceptual, capacidad de análisis, claridad en la argumentación e identificación de errores. Cita válida: Guía didactica V1, página18. Estudiante temporal dentro de transacción revertida; no se publicó ni activó ninguna actividad.
- La primera recuperación omitía la continuación del encabezado. Se corrigió con contexto contiguo acotado y preferencia de mención explícita de actividad. Generación usa thinkingLevel MINIMAL y salida máxima1600tokens. No se interpreta una única respuesta correcta como certificación de todas las consultas.

## Pruebas

- Backend: **654 pasaron**, una prueba opcional Redis omitida; 81 suites pasaron. `/tmp/aura-rag-all-tests-final.log`.
- Frontend: **43 funcionales + 8 seguridad pasaron**. `/tmp/aura-rag-front-all-tests-final.log`.
- TypeScript backend/frontend, Nest SWC303 archivos, build Next Webpack y lint de archivos nuevos: pasaron. `git diff --check` sin errores.
- PostgreSQL/Redis reales con rollback: indexación idempotente, solo índices completos, aislamiento de curso, fuentes retiradas eliminadas, rechazo de guardado obsoleto, reapertura, modificación de texto, acceso inactivo/retirado, permisos docente. Ocho reservas concurrentes admiten exactamente una; la cuota diaria deniega sin incrementos parciales.
- HTTP RAG real con PostgreSQL/Redis y sesiones sintéticas:201/400/401/403, validación DTO, secreto BFF, rol estudiante no puede preparar, matrícula y cuenta revocadas. Gemini simulado en esta matriz. `/tmp/aura-rag-integration-final.log`.
- Revisión independiente: dos P2 (DOCX sin pages, fuente demasiado grande que ocultaba el listado) corregidos con pruebas que fallaron antes y pasaron después. Revisión de correcciones sin nuevos bloqueantes.
- UI renderizada en arnés temporal, API simulada: escritorio, panel390px, tema claro/oscuro, cerrar/abrir, respuesta con referencia, visor, resultados y nota0. Captura `.tmp/course-rag/panel-estudiante.png`. No equivale a E2E del inicio de sesión/OTP ni de una cuenta real en el sitio.

## Próxima comprobación operativa

Entrar en el sitio como docente y estudiante de prueba, revisar fuentes/actividades y probar el recorrido completo con la sesión habitual. Ampliar preguntas de aceptación (fuera de tema, contradicciones, versiones nuevas, actividad7 y DOCX reales) antes de producción. No se corrigió la inconsistencia del cronograma ni se publicaron rúbricas propuestas. Después integrar vinculación revocable con Telegram y su webhook.
