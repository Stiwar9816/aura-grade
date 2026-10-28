# Plan: preparación del curso

Especificación: ../specs/2026-10-28-course-preparation.md. Repositorios dev existentes, sin worktree adicional por instrucción del usuario.

1. Backend: pruebas de huella, confirmación, accesos, documentos ajenos/no publicados, cambios concurrentes, retiro y fechas individuales; servicio, DTO, rutas y migración aditiva.
2. Frontend: BFF permitido y pruebas, panel compacto para ambos roles con confirmación docente y enlaces autorizados; integrar en Cursos.
3. Verificar pruebas, tipos, lint enfocado, migración en PostgreSQL y flujo local con datos de prueba; revisión final independiente y commits locales. No push ni despliegue.

Decisión: conservar la creación de actividades actual; la confirmación se añade después y no cambia visibilidad ni fechas. La falta de guía/cronograma publicados se explica en UI, sin inventar fuentes. Calendario usa dueDate y prórrogas vigentes.

## Registro de ejecución

- Backend: huella probada RED (4 fallos) → GREEN; servicio probado RED (11 fallos) → GREEN. Autorización reutiliza la política de biblioteca y el servicio de acceso académico.
- Frontend: nueva ruta del BFF probada RED (400 en ruta válida) → GREEN. Panel en Cursos docente/estudiante; revisión manual sin IA.
- Revisión independiente: corregidos pérdida de formulario por focus y carga innecesaria del texto completo en listados. Proyección explícita de metadatos; refresco manual o tras cambios locales de biblioteca.
- Verificación: suite backend 611 pruebas aprobadas y 1 Redis opt-in omitida; 17 pruebas nuevas/enfocadas de preparación aprobadas después de la revisión. Frontend 37 pruebas aprobadas. Tipos y lint de archivos afectados correctos; build backend correcto.
- PostgreSQL real con fixtures dentro de rollback: migración up/down/up, consultas TypeORM, confirmación, retiro/reapertura, huella desactualizada, prórrogas de dos estudiantes aisladas y desactivación. Sin subir archivos a Cloudinary.
- Navegador aislado con API sintética y componentes reales: revisión, visor DOCX, conservación de secciones al cerrar visor, confirmación, vista estudiantil, prórroga, retiro de fuente y ocultación de enlaces. Tema claro/oscuro y contenedor 390 px inspeccionados; no es una prueba de viewport móvil completo ni sesión real de usuario.

- Activación local: migración AddCourseActivityConfirmations1793188800000 aplicada como número 31 en auraGradeDB; solo esa migración estaba pendiente. Backend reiniciado y /api/health confirmó database/redis/storage up. Build Next.js correcto. No despliegue ni push.
- Entrega cerrada para este incremento. La generación IA de actividades como borradores y eventos adicionales siguen pendientes dentro de etapa 3; RAG/Telegram aún no implementados.
