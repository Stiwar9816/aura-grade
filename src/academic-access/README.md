# Acceso académico

Este módulo no autentica usuarios ni expone endpoints. Recibe identidades verificadas por una sesión o una futura vinculación de Telegram. Importar `AcademicAccessModule` en cada módulo consumidor; no reutilizar las entidades completas de usuario como contexto del modelo.

- `requireStudent(userId)`: carga cuenta e institución actuales; exige estudiante activo, aprobado e institución activa. Retorna solo `studentId` e `institutionId`.
- `requireStudentCourse(userId, courseId)`: además comprueba matrícula y misma institución del propietario del curso. Retorna también `courseId`.
- `runForStudentCourse(userId, courseId, operation)`: comprueba acceso y ejecuta la operación únicamente si está autorizado. El callback recibe los tres identificadores anteriores.

El futuro worker de recuperación o generación debe llamar `runForStudentCourse` al ejecutar el trabajo, no confiar en la autorización obtenida cuando se encoló. Si un flujo contiene operaciones costosas separadas por esperas, volver a comprobar antes de cada llamada. La vinculación persistente de Telegram no concede acceso cuando cambia el estado académico.

No cachear autorizaciones positivas. Ante una denegación responder con una plantilla fija (sin embeddings ni generación); ante error de base de datos informar indisponibilidad sin continuar al proveedor. `ACADEMIC_ACCESS_DENIED` no revela si existe un curso ajeno.

`hasAcademicAccess` comparte la política de cuenta con sesiones y estrategia JWT, manteniendo sus controles de MFA, vencimiento y authVersion. `canStudentAccessCourse` requiere relaciones cargadas y se utiliza en el envío/escaneo de notificaciones; no obtiene información por sí mismo.

Esta entrega no proporciona RAG ni Telegram. Biblioteca documental, contenido publicado, consultas académicas mínimas y vinculación son las siguientes etapas de la especificación en `docs/superpowers/specs/2026-10-24-academic-assistant.md`.
