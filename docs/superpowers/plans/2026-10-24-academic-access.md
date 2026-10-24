# Acceso académico — plan de implementación

> Ejecución nativa en esta conversación mediante executing-plans, sobre la rama `dev` solicitada.

**Objetivo:** centralizar elegibilidad y matrícula antes de operaciones del asistente y excluir destinatarios sin acceso de avisos académicos.

**Arquitectura:** política pura compartida, módulo NestJS con lectura fresca de User/Course y operaciones protegidas, integración en sesiones y notificaciones existentes.

**Tecnologías:** NestJS, TypeORM, PostgreSQL, Jest; sin nuevas dependencias.

**Especificación:** [Diseño y ruta](../specs/2026-10-24-academic-assistant.md).

## Restricciones

- Trabajar en dev; sin publicar, desplegar ni modificar bases remotas.
- No relajar MFA, vencimientos, authVersion o controles de propiedad existentes.
- Fallar de forma cerrada; no cachear permisos positivos.
- Esta entrega no implementa la biblioteca, RAG o Telegram.

## Casos prioritarios de revisión

- Desactivación después de encolar: no enviar ni ejecutar operaciones protegidas.
- Institución ausente/inactiva o aprobación pendiente: denegar.
- Matrícula retirada o curso de otra institución: denegar.
- Error al consultar permisos: no continuar con proveedores.
- Evento omitido: registrar estado terminal por canal para que outbox no lo recupere indefinidamente.

## Tareas

- [x] 1. Pruebas de regresión de avisos y sesiones: ejecutar Jest, observar fallos de exclusión antes del cambio.
- [x] 2. Crear `src/academic-access/academic-access.policy.ts` con elegibilidad estricta y prueba de tabla de casos.
- [x] 3. Crear `AcademicAccessService`/`AcademicAccessModule`: `requireStudent(userId)`, `requireStudentCourse(userId, courseId)` y `runForStudentCourse(userId, courseId, operation)`; contexto mínimo; pruebas con repositorios como fronteras y callback externo observable.
- [x] 4. Reutilizar política en validación de sesiones; mantener pruebas de MFA y authVersion.
- [x] 5. Aplicar política y relaciones en escaneo, recordatorios manuales y procesamiento de notas/recordatorios; registrar canales omitidos para eventos ineligibles.
- [x] 6. Ejecutar suite completa (`jest --runInBand`), build (`nest build`), lint focalizado sin --fix, revisar diff y documentar resultados.

## Registro

- Se reutiliza el checkout limpio que ya está en dev por petición expresa del usuario.
- La autorización para ejecutar la ruta ya está dada; se conserva la especificación en el repositorio como referencia durante la implementación.
- Evidencia inicial: 8 pruebas de exclusión de notificaciones fallaron con envíos/encolados no autorizados antes de la corrección; 10 pruebas previas pasaron.
- Revisión independiente: se reprodujo con dos pruebas fallidas la reaparición de avisos internos tras reactivar al estudiante y repetir un evento descartado. Corregido verificando los canales omitidos antes de crear avisos internos; las 20 pruebas del procesador pasan.
- Verificación final: suite completa con 555 pruebas aprobadas en 67 suites, 1 prueba omitida de integración Redis (`RUN_REDIS_INTEGRATION` desactivado). `nest build`, `tsc --noEmit --incremental false`, ESLint de archivos afectados y `git diff --check` aprobados.
- No se conectó a proveedores de IA ni se verificó contra PostgreSQL/Redis desplegados. Las pruebas usan dobles en fronteras de persistencia y transporte.
