# Asistente académico y documentos oficiales

## Ruta acordada

Implementación incremental sobre `dev`, autorizada en la conversación del 24 de octubre de 2026.

1. Acceso académico: cuenta activa, aprobación, institución activa y matrícula vigente antes de consultar contenidos o consumir IA; repetir la comprobación al ejecutar trabajos en cola.
2. Biblioteca oficial: cargar PDF/DOCX, extraer, revisar, versionar y publicar guía, cronograma y materiales por curso; conservar originales descargables. Los borradores no alimentan el RAG. PDF escaneado requiere OCR o una versión con texto.
3. Preparación del curso: generar actividades como borradores revisables; el docente las incorpora manualmente a la guía, carga la versión final y confirma coherencia entre guía, cronograma, rúbricas y actividades programadas. Cada actividad referencia su documento y sección. Calendario estructurado confirmado por el docente, con prórrogas individuales como excepciones.
4. RAG: recuperar exclusivamente fuentes publicadas y autorizadas, con citas y versiones. Notas, fechas y entregas se consultan en el sistema. Actualizar o retirar índices cuando cambia la fuente. Verificar disponibilidad de pgvector antes de elegir almacenamiento.
5. Telegram: vinculación persistente revocable mediante token inicial de un uso; webhook autenticado, deduplicación, cola y consultas privadas. La vinculación no sustituye las comprobaciones actuales de acceso.
6. Notificaciones: sumar Telegram a los canales existentes, preferencias y recuperación por canales esperados, sin conteos fijos. Inactivos no reciben avisos.

## Primera entrega: acceso académico

Política compartida sin llamadas externas: usuario existente, `isActive === true`, aprobación `APPROVED` e institución cargada y activa. Ausencia de datos necesarios deniega acceso. La sesión web mantiene sus comprobaciones adicionales de MFA, vencimiento y authVersion.

Servicio independiente que obtiene al estudiante actual desde PostgreSQL en cada operación. Para un curso, exige rol estudiante, misma institución del propietario y matrícula vigente. No memoriza autorizaciones positivas. Entrega un contexto mínimo de identificadores, no entidades con datos personales. Una operación protegida ejecuta su callback solamente después de autorizar; este será el punto de entrada para recuperación, embeddings y generación en etapas posteriores. Los fallos de base de datos propagan el error y no ejecutan la operación.

Los identificadores de usuario de este servicio deben provenir de la sesión validada o de una vinculación validada por el servidor; nunca del texto del estudiante. El servicio no autentica identidades por sí solo.

Los recordatorios y avisos de notas publicados vuelven a comprobar elegibilidad al procesar el trabajo. Cargar las relaciones necesarias para que la ausencia de institución no se interprete como acceso válido. Los avisos de notas requieren evaluación publicada y matrícula vigente del destinatario en el curso de la misma institución. Los eventos descartados por destinatario no elegible se registran como canales omitidos para evitar reintentos infinitos de outbox; no se reenvían retrospectivamente por reactivación.

Para las nuevas consultas del asistente se requiere matrícula vigente, también al consultar notas históricas. Esta primera entrega no cambia la política histórica de lectura de evaluaciones de la web, que se revisará al incorporar su capa de consultas. No modifica el proceso de calificación de entregas previamente aceptadas.

## Límites y pruebas

Primera entrega sin migraciones, nuevas dependencias, frontend ni llamadas a proveedores. Probar desactivación/reactivación entre consultas, cambios de aprobación/institución/matrícula, pertenencia a otra institución, errores de repositorio y cero ejecuciones de la operación protegida al denegar. Probar recordatorios automáticos/manuales y avisos encolados, y regresión de MFA/sesiones. Ejecutar suite completa, compilación y lint de archivos afectados.

Las siguientes entregas necesitan su propio diseño detallado y pruebas. No se declara implementado Telegram ni RAG al completar esta base.

## Estado de la ruta

- Etapa 1 implementada localmente en dev: política compartida, servicio de acceso para futuros consumidores y comprobaciones de destinatarios en notificaciones.
- Etapa 2: backend de biblioteca implementado localmente en dev, con almacenamiento privado, extracción PDF/DOCX, versiones, revisión y publicación. Migración aplicada el 2026-10-24 en la base local de desarrollo `auraGradeDB`, sin migraciones pendientes. Especificación: `2026-10-24-course-library.md`.
- Interfaz de biblioteca implementada en dev de `aura-grade-front`: carga, revisión, publicación, retiro y consulta estudiantil. Validación de navegador con datos sintéticos y prueba posterior de rutas HTTP del BFF contra backend, PostgreSQL, Redis y Cloudinary reales. PDF/DOCX, descarga privada, vencimiento y bloqueo por baja/matrícula verificados; datos temporales retirados. Evidencia: `docs/verification/2026-10-24-course-library-live.md`. Siguiente etapa: preparación de actividades y calendario.
- Etapas 3–6 pendientes. Sin despliegue. Los consumidores futuros deben usar explícitamente las operaciones protegidas; todavía no existe un endpoint de RAG ni bot Telegram.
