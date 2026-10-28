# Preparación del curso: actividades y documentos oficiales

Incremento autorizado de la etapa 3 sobre dev. Reutilizar actividades, rúbricas, fechas generales y prórrogas existentes. Añadir en Cursos un panel de actividades ordenadas por fecha con vínculo explícito a una versión publicada de GUIDE y SCHEDULE, y sección/página indicada por el docente para cada fuente. La revisión es una confirmación humana de coherencia, no un análisis automático del PDF.

Guardar una confirmación por actividad con versiones, secciones, docente, fecha y huella de título, instrucciones, curso, fecha general y contenido de la rúbrica. Mostrar pendiente si falta, requiere revisión si cambian esos datos o se retiran/sustituyen las fuentes. No cambiar fechas automáticamente ni desactivar tareas existentes. Un borrador de documento no puede confirmarse. Solo fuentes publicadas del mismo curso. El docente debe confirmar los datos que efectivamente vio mediante huella enviada por el cliente; una edición concurrente devuelve 409.

GET /api/courses/:courseId/documents/preparation: listado paginado (20, máximo 50), fuentes publicadas actuales, fecha general y fecha efectiva propia del estudiante; sin datos de otros estudiantes. POST /preparation/:assignmentId/confirm: dos versiones, dos secciones, confirmed=true y activityHash. Autorización académica actual por operación; escritura solo propietario activo/aprobado del curso. Sin secretos de almacenamiento en respuestas. Bloqueo de actividad y documentos en orden estable al confirmar. Huellas recalculadas en lecturas: cambios posteriores invalidan de forma conservadora.

Tabla aditiva course_activity_confirmations con PK assignment_id, FK de versiones y revisor; eliminación de actividad elimina su confirmación, eliminación de originales/revisor restringida. No modifica actividades existentes ni fabrica confirmaciones. Una nueva confirmación reemplaza la vigente; el historial documental permanece en la biblioteca.

UI compacta con detalle plegado, indicador de confirmación, fecha, guía/cronograma con ojo y descarga. Formulario de revisión solo docente, fuentes actuales y secciones obligatorias. Mostrar instrucciones y rúbrica que se están confirmando. Estudiantes solo ven vínculos publicados aún vigentes y su fecha efectiva; en estado desactualizado se ocultan los vínculos confirmados para evitar atribución engañosa.

Alcance: primer incremento de la etapa 3. Generación IA de actividades, nuevos eventos de clase, RAG y Telegram permanecen pendientes. No llamar proveedores de IA ni modificar documentos oficiales automáticamente.
