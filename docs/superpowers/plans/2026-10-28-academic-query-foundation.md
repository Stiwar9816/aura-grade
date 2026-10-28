# Academic query foundation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task by task.

**Goal:** Resolver los prerrequisitos locales restantes para RAG, omitiendo la corrección de fecha solicitada.
**Architecture:** Consultas personales protegidas independientes de los lectores históricos; PostgreSQL Alpine con pgvector; importación piloto revisable desde fuentes oficiales.
**Tech Stack:** NestJS, TypeORM/PostgreSQL, Jest, Docker, pgvector.
**Spec:** docs/superpowers/specs/2026-10-28-academic-query-foundation.md

## Global Constraints

- Trabajar en dev y preservar cambios previos de verificación.
- Sin IA, corrección de fecha excluida, notificaciones ni despliegue remoto.
- No autorizar desde texto del estudiante; no almacenar notas en índice compartido.
- Cierres 23:59 America/Bogota; importación nueva inactiva y sin confirmar coherencia por el docente.

## Review Focus

- Revocación de matrícula entre llamadas: denegar antes de consultas personales.
- Nota cero y evaluación borrador: conservar cero; ocultar borrador.
- Prórrogas ajenas: no cambiar orden ni fechas propias.
- Cambio de imagen: misma familia/major, backup restaurable y ninguna pérdida de datos.
- Fuentes incompletas: no inventar criterios/pesos/fechas ni registrar confirmaciones humanas.

## Task 1: Consultas académicas

- [x] Tests iniciales fallan por módulo ausente; implementados denegación/DTO/notas cero/draft y validación HTTP.
- [x] Servicio, controlador, DTO y módulo en `src/academic-queries`, registrado en AppModule. Interfaces: `activities(studentId, courseId, query)` y `result(studentId, courseId, assignmentId)`. BFF privado equivalente añadido en frontend con 3 pruebas nuevas.
- [x] Integración real PostgreSQL (dos estudiantes, prórrogas, draft/publicado, revocación) y HTTP con Redis y guards reales, fixtures revertidos.
- [x] Tests GREEN, tipos y builds backend/frontend pasan.

## Task 2: pgvector

- [x] Dockerfile PostgreSQL y compose, script explícito de preflight/habilitación.
- [x] Imagen compilada; respaldo lógico restaurado y comparado, base temporal retirada; imagen local activada conservando volumen.
- [x] pgvector 0.8.7 habilitado, distancia L2=1 verificada; health up.

## Task 3: Curso piloto

- [x] Guía/rúbricas revisadas en texto y PDF; manifiesto idempotente por versiones/curso.
- [x] Usuario autorizó normalizar solo borradores 2/5 (sumas originales 105/125). Pesos se redondean por restos mayores y suman 100.00; 7 tests pasan.
- [x] Ensayo con rollback, importación y segunda aplicación idempotente pasan. Actividades 1/4/6 inactivas a las23:59; rúbricas2/5 solo DRAFT; exámenes3/7 omitidos porque no hay pesos por criterio. Sin corrección del cronograma ni confirmación humana automática.

## Task 4: Cierre

- [x] Suite, tipos, lint y compilación pasan; revisión independiente completada. Hallazgo P2 de TLS predeterminado en preflight: test mostró fallo en prod sin DB_SSL_MODE, corregido y 3 tests pasan.
- [x] Informe actualizado con evidencia y pasos docentes restantes; se conserva explícitamente el alcance local, sin producción ni navegador completo.

## Registro

- Diseño derivado de la ruta e informe aprobados por el usuario. Se ejecuta en el checkout dev solicitado, sin worktree adicional.
- Guía publicada confirmada: versión 1, 39 páginas, 60410 caracteres. Cronograma versión 1. Sin actividades al iniciar.
- Decisión: usar servicios existentes para importar, que publican rúbricas válidas al asociarlas a actividades. Para mantener las normalizaciones exclusivamente en borrador, 2/5 no se asociaron a actividades. No se relajaron las reglas de publicación existentes.
- Pendiente docente: revisar/activar 1/4/6 y confirmar fuentes; definir pesos de exámenes; actualizar guía antes de utilizar normalizaciones2/5. Pendiente externo: preflight de base remota antes del despliegue.
