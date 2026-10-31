# Aura Grade: estado y traspaso a Claude

Fecha de corte: 31 de octubre de 2026, America/Bogota.

## Encargo para Claude

Revisa el backend y el frontend, contrasta este resumen con el código y ejecuta las comprobaciones pertinentes. Presenta hallazgos con archivo, consecuencia y prioridad. Cierra primero los defectos que bloqueen el piloto del asistente web y continúa después con la etapa 5: vinculación y consultas por Telegram. Conserva las decisiones académicas reservadas al docente y documenta qué verificaste realmente.

La base de RAG ya existe: reutiliza `AcademicAccessService`, `AcademicQueriesService` y `CourseAssistantService`. La integración Telegram y su canal de notificaciones todavía están pendientes.

## Estado observado ahora

| Repositorio | Ruta local | Rama y último commit |
| --- | --- | --- |
| Backend | `/Users/stiwara/Documents/aura-grade` | `dev`, `c3cc3332` — RAG autorizado, citas y límites |
| Frontend | `/Users/stiwara/Documents/aura-grade-front` | `dev`, `9c886fc` — panel del asistente y consultas privadas |

Ambos árboles estaban limpios al iniciar esta revisión. Cada rama aparece un commit por delante de su referencia local `origin/dev`. No se hizo `fetch`: esto no certifica el estado actual del servidor Git. Este documento es el único archivo añadido durante el resumen; no se cambió código, base de datos ni configuración.

Se inspeccionaron Git, documentación y puntos de entrada del código. No se ejecutaron de nuevo las suites, no se consultó la base actual ni se verificó el despliegue. La evidencia operativa citada abajo corresponde a sesiones documentadas del 24 al 29 de octubre.

## Qué está implementado

Aura Grade es una plataforma de gestión y evaluación académica con instituciones, roles, cursos, matrículas, actividades, rúbricas, entregas, calificación asistida por IA, revisión/publicación docente y solicitudes de reevaluación. El backend usa NestJS, TypeScript, GraphQL/REST, TypeORM/PostgreSQL, Redis/BullMQ y Cloudinary. El frontend usa Next.js/React y un BFF que conserva las credenciales del backend en servidor. Hay módulos existentes de notificaciones, auditoría, outbox, observabilidad, onboarding y operaciones; su existencia no supone una auditoría completa de todos ellos en este traspaso.

| Área | Estado y alcance |
| --- | --- |
| Acceso académico | Comprueba cuenta activa/aprobada, institución activa, misma institución y matrícula vigente. El asistente revalida antes de operaciones costosas y antes de responder. |
| Biblioteca oficial | PDF/DOCX privados, extracción, versiones, revisión por hash, publicación, retiro, descarga y reapertura de la última publicación retirada. Interfaz docente/estudiante implementada. |
| Preparación del curso | Vincula actividades con versiones publicadas de guía/cronograma y sección. Confirmación docente con huella; cambios relevantes invalidan la confirmación. Fechas efectivas con prórrogas personales. |
| Consultas personales | Actividades, próxima entrega propia, estado de entrega, nota y retroalimentación publicada mediante consultas deterministas autorizadas. La nota cero es válida. |
| Asistente RAG web | Preparación docente por lotes, pgvector, recuperación limitada al curso, respuesta con referencias a documento/versión/página y visor autorizado. El estudiante dispone de panel web. |
| Integridad de fuentes | Índices completos antes de consultar; invalidación transaccional por retiro/cambio de texto; rechazo de respuestas si la publicación cambia durante la consulta. |
| Costos del asistente | Cuotas Redis atómicas por actor y globales, exclusión de operaciones simultáneas por actor, límites de tamaño/contexto/salida y timeout. Redis indisponible bloquea el consumo. |
| Trazabilidad de evaluación | Código y migración conservan `originalDraftSnapshot` y `teacherReviewSnapshot`. No equivale a tener un pipeline de entrenamiento o aprendizaje automático validado. |
| Telegram | Sin implementación encontrada en el código revisado. Etapa siguiente. |
| Notificaciones Telegram | Pendientes; deben extender los canales existentes y el outbox. |

El RAG actual no guarda memoria conversacional. Las notas y entregas no pasan por el modelo ni entran en el índice compartido. El almacenamiento vectorial usa búsqueda exacta; HNSW no forma parte de este incremento.

## Evidencia disponible y límites

La referencia más reciente es `docs/verification/2026-10-29-course-rag.md`:

- Backend: 654 pruebas aprobadas en 81 suites; una prueba Redis opcional omitida en la suite general.
- Frontend: 43 pruebas funcionales y 8 de seguridad aprobadas.
- TypeScript en ambos repositorios, build Nest/SWC, build Next/Webpack y lint de archivos nuevos aprobados.
- Integración con PostgreSQL/Redis reales y rollback: aislamiento, revocación, indexación, invalidación, cuotas y concurrencia. La matriz HTTP utilizó sesiones sintéticas y Gemini simulado.
- Prueba separada con Gemini real: 60 fragmentos preparados (58 de guía y 2 de cronograma), sin repetir embeddings al preparar de nuevo. Consulta sobre criterios de la actividad 3 respondida con referencia a la página 18 de la guía.
- UI comprobada en un arnés con API simulada, temas claro/oscuro y panel de 390 px. No equivale a recorrer el sitio con login/OTP y cuentas reales.
- La biblioteca tiene evidencia anterior de PDF/DOCX y Cloudinary real en `docs/verification/2026-10-24-course-library-live.md`.

No hay certificación del recorrido completo autenticado del asistente, calidad general de todas las respuestas ni activación en producción. Los logs y capturas temporales mencionados por los informes pueden no existir en otro equipo; conservar los documentos y reproducir las comprobaciones necesarias.

## Curso piloto: decisiones pendientes del docente

Inventario documentado, no releído de la base el 31 de octubre: curso denominado «Algortimos II», guía V1 y cronograma V1 publicados; tres actividades inactivas y siete rúbricas, tres publicadas por asociación y cuatro DRAFT.

| Actividades | Preparación registrada | Pendiente |
| --- | --- | --- |
| 1, 4 y 6 | Actividades inactivas con rúbricas oficiales asociadas | Revisar y activar cuando corresponda; confirmar coherencia con fuentes. Los cierres de 1 y 4 ya pasaron; el de 6 es 06/11/2026 23:59 Colombia. |
| 2 y 5 | Rúbricas DRAFT normalizadas de 105% y 125% a 100% | Revisar e incorporar los cambios aprobados a una nueva guía oficial antes de utilizarlas. No se crearon actividades. |
| 3 y 7 | Rúbricas DRAFT con cuatro criterios de la guía, pesos propuestos del 25% y niveles propuestos | Revisión docente e incorporación oficial antes de programar los exámenes. Los pesos/niveles son propuestas, no datos extraídos de la guía. |

No se registraron confirmaciones humanas automáticas. El cronograma tiene una inconsistencia documentada en actividad 7: apertura 13/11/2026 y cierre 16/05/2026. El usuario excluyó expresamente corregirla en el trabajo anterior: conservarla como incidencia para decisión docente, sin inferir una fecha ni modificarla por iniciativa técnica. El asistente debe señalar contradicciones y remitir a las fechas personales del sistema cuando corresponda.

## Pendientes, en orden recomendado

### 1. Cerrar la validación del asistente web

- Reproducir el flujo con cuentas de prueba y autenticación habitual: docente prepara fuentes; estudiante consulta, abre referencias y ve próximas entregas/resultados propios.
- Verificar roles, matrícula retirada, cuenta/institución inactiva, reapertura/cambio de versión, cancelación y errores de proveedor. Ninguna denegación debe disparar consumo de IA.
- Ampliar aceptación RAG: preguntas sin evidencia, fuera de tema, fuentes contradictorias, actividad 7, DOCX real, cambio de versión y aislamiento entre cursos/estudiantes. Evaluar el contenido de la respuesta además de la validez formal de la cita.
- Coordinar con el docente la revisión del piloto descrita arriba.

Criterio de cierre: matriz reproducible con resultados y defectos corregidos; separar claramente pruebas con mocks, sesiones sintéticas y recorrido real de navegador. Las decisiones docentes aún pendientes deben quedar identificadas.

### 2. Implementar Telegram: siguiente fase funcional

- Vinculación desde una sesión web autenticada mediante token de un uso y caducidad; relación persistente y revocable independiente de la duración de la sesión web.
- Webhook con autenticación propia, chat privado y deduplicación de actualizaciones. Mantener intacta la protección global BFF; resolver la entrada Telegram de forma acotada.
- Procesamiento mediante cola y revalidación del acceso al ejecutar el trabajo y antes de consumir IA o entregar información privada.
- Resolver estudiante y cursos desde la vinculación validada; selección explícita de curso cuando haya varios. El texto del mensaje no concede identidad ni permisos.
- Reutilizar RAG para documentos y `AcademicQueriesService` para fechas personales, entregas, resultados y retroalimentación. Diseñar comandos o controles claros para las consultas personales.
- Definir cómo se abrirán las citas desde Telegram conservando la autorización y la privacidad de los documentos.

Criterio de cierre: pruebas de token vencido/reutilizado, desvinculación, webhook inválido, actualización duplicada, grupo rechazado, matrícula revocada durante la cola, aislamiento, cuotas y consulta completa de prueba. Las pruebas que contacten Telegram real deben distinguirse de los mocks.

### 3. Añadir notificaciones Telegram

Extender preferencias, entregas por canal y outbox existentes. Respetar elegibilidad vigente al enviar, deduplicación y recuperación por canales esperados; evitar suposiciones de un número fijo de canales. Un estudiante inactivo no recibe avisos y su reactivación no debe reenviar eventos descartados previamente.

### 4. Preparar el despliegue del incremento

- Verificar en la base destino disponibilidad/permisos de pgvector, respaldo restaurable y migraciones pendientes. La instalación local no acredita compatibilidad remota.
- Revisar `AddCourseRag1793275200000` e `InvalidateRagOnTextChanges1793275201000`, además de cualquier migración anterior pendiente en ese destino. Mantener `synchronize: false`.
- Mantener RAG deshabilitado hasta verificar configuración, credenciales y proveedor en destino. El valor predeterminado es `RAG_ENABLED=false`.
- Establecer límites y alertas de consumo del proveedor. Las cuotas de solicitudes/fragmentos no representan un presupuesto monetario exacto ni una contabilidad de tokens.
- Revisar integración de los commits en el remoto y ejecutar smoke posterior al despliegue cuando se autorice esa fase.

### 5. Backlog que no debe confundirse con trabajo terminado

- Generación de actividades como borradores dentro de Preparación del curso; la generación de rúbricas existente no completa este flujo.
- Calendario estructurado de sesiones de clase y otros eventos, más allá de entregas y prórrogas.
- OCR para documentos escaneados, si se incorpora al alcance; actualmente se requiere texto extraíble.
- Actualizar referencias documentales desfasadas: varios README y planes antiguos aún dicen que biblioteca, consultas o RAG están pendientes. Los informes del 28 también contienen inventarios anteriores a sus propias actualizaciones; prevalece la evidencia posterior del 29 y la comprobación del código/base actual.

## Reglas que debe preservar la continuación

- La guía y el cronograma publicados son fuentes oficiales. Una propuesta IA permanece en borrador hasta revisión e incorporación manual del docente.
- Las consultas privadas derivan la identidad de sesión/vinculación validada. Mantener matrícula vigente en el asistente sin alterar incidentalmente la política histórica de lectura de evaluaciones de la web.
- Revalidar acceso antes de recuperación, embeddings, generación y ejecución de trabajos en cola. No cachear permisos positivos.
- Conservar el borrador original y la revisión docente por separado; no describir los snapshots como entrenamiento ya implementado.
- Mantener la identidad visual existente, temas claro/oscuro y manejo de nota cero. Verificar los contratos BFF/backend conjuntamente.
- Trabajar sobre la línea `dev` acordada y respetar cambios ajenos. Una revisión o implementación local no constituye autorización para publicar actividades, enviar avisos reales o desplegar producción.

## Archivos para comenzar

Rutas relativas al backend, salvo indicación:

| Para revisar | Archivos |
| --- | --- |
| Ruta del producto | `docs/superpowers/specs/2026-10-24-academic-assistant.md` |
| Evidencia más reciente | `docs/verification/2026-10-29-course-rag.md` |
| Piloto y propuestas | `docs/verification/2026-10-28-vector-and-course-pilot.md`, `scripts/course-pilot/manifest.ts` |
| Acceso y consultas | `src/academic-access/academic-access.service.ts`, `src/academic-queries/academic-queries.service.ts` |
| RAG | `src/course-assistant/README.md`, `course-assistant.service.ts`, `rag-store.ts`, `rag-budget.ts`, `rag-provider.ts`, `rag-content.ts`, `rag-context.ts` dentro del mismo directorio |
| Biblioteca y confirmación | `src/course-documents/course-documents.service.ts`, `src/course-preparation/course-preparation.service.ts` |
| Entrada y colas | `src/common/guards/bff-auth.guard.ts`, `src/notifications/`, `src/outbox/` |
| Frontend | En `aura-grade-front`: `docs/course-assistant.md`, `src/components/CourseAssistant/CourseAssistant.tsx`, `src/components/CoursePreparation/CoursePreparation.tsx`, `src/lib/server/courseAssistantProxy.ts` |

## Comprobaciones reproducibles para la revisión

Desde el backend:

```sh
./node_modules/.bin/jest --runInBand
./node_modules/.bin/tsc --noEmit --incremental false
DB_HOST=127.0.0.1 STATE=dev node scripts/verify-vector.cjs
RUN_RAG_INTEGRATION=true RUN_HTTP_INTEGRATION=true DB_HOST=127.0.0.1 STATE=dev ./node_modules/.bin/ts-node -r tsconfig-paths/register scripts/verify-course-preparation.ts
```

La integración exige servicios locales y permisos de red; usa PostgreSQL/Redis reales, sesiones sintéticas, IA simulada y rollback. Leer el script antes de ejecutarlo en otro entorno. `verify-vector.cjs` sin `--enable` comprueba sin activar la extensión. Las pruebas unitarias HTTP pueden requerir permiso para escuchar en puertos locales.

Desde el frontend:

```sh
node --test scripts/*.test.mjs
node --test scripts/security.test.cjs
./node_modules/.bin/tsc --noEmit --incremental false
```

Consultar los scripts de cada `package.json` para build y lint. El lint del backend incluye `--fix`: para una revisión sin cambios, invocar ESLint sin ese modificador. Los importadores con `--apply` persisten datos y `prepare-course-rag.ts --apply --query` puede consumir Gemini real; no forman parte de una comprobación de lectura.

Entregable esperado de Claude: hallazgos priorizados, validación del piloto, cambios y pruebas de la siguiente fase, y lista explícita de decisiones docentes o comprobaciones externas que sigan pendientes.
