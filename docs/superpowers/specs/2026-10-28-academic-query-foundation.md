# Pendientes previos al asistente académico

Solicitud: completar los pendientes de la verificación del 28 de octubre en dev, con la guía ya publicada. El usuario excluyó corregir la fecha del cronograma y eligió cierres a las 23:59 America/Bogota. Continuación autorizada de la ruta existente; sin despliegue remoto ni llamadas a modelos.

## Consultas personales

Crear AcademicQueriesModule y AcademicQueriesService. Cada operación usa AcademicAccessService.runForStudentCourse con identidad proveniente de la sesión, antes de consultar datos. No cambia EvaluationService ni la política histórica de la web. Los futuros consumidores Telegram también deben entrar por este servicio.

GET /api/courses/:courseId/academic-queries/activities admite page (1–100000), limit (1–50) y upcoming (true/false). Devuelve actividades activas del curso, ordenadas por fecha efectiva del estudiante (máximo entre general y prórroga propia), con id, título, instrucciones, fechas y estado de entrega propio. upcoming filtra por fecha efectiva >= ahora. Paginación en SQL, sin cargar a otros estudiantes.

GET /api/courses/:courseId/academic-queries/activities/:assignmentId/result devuelve la actividad activa del curso, entrega propia y exclusivamente evaluación PUBLISHED. Si no hay entrega o publicación, respuesta explícita sin nota ni retroalimentación inventada. DTO limitado a id/fecha/estado de entrega, nota total, comentarios generales y comentarios normalizados por criterio. Nunca devuelve snapshots internos, texto de entregas, información del modelo, direcciones de archivos ni identidades de terceros. Guard de sesión, BFF y no-store. No requiere proveedor de IA.

## Infraestructura vectorial

Imagen propia derivada de PostgreSQL 17 Alpine que instala pgvector 0.8.7 compilado sin optimizaciones específicas de CPU. Mantener la misma versión PostgreSQL y familia Alpine del volumen local existente. Hacer respaldo lógico local antes de recrear el contenedor, verificar restauración en base temporal y conservarlo fuera de Git. Habilitación explícita mediante script de preparación, no migración automática que bloquee instalaciones sin extensión. Verificar búsqueda por distancia con vectores sintéticos. Documentar preflight para producción; no modificar producción sin acceso/contexto confirmado.

## Curso piloto

Usar exclusivamente versiones publicadas de guía y cronograma. Preparar importación idempotente de actividades y rúbricas que puedan reconstruirse fielmente; cierres 23:59 America/Bogota. No inventar pesos de examen ni corregir la fecha excluida. Las actividades nuevas quedan inactivas y sin confirmación humana de coherencia; conservar páginas/secciones en un manifiesto revisable. Si una actividad no tiene datos suficientes, explicar la omisión concreta. No enviar notificaciones ni modificar tareas existentes.

## Pruebas

Pruebas primero para consultas: denegación previa a lectura, DTO mínimo, borradores ocultos, nota cero, prórroga propia, orden/paginación por fecha efectiva, curso ajeno, identidad inyectada y revocación entre llamadas. Integración PostgreSQL con rollback y autenticación HTTP. Suite completa, tipos, compilación y lint pertinente. Pruebas de infraestructura reales y lectura del inventario piloto posterior. RAG conversacional, indexación y Telegram son etapas posteriores a estos prerrequisitos.
