# Comprobaciones previas a RAG y Telegram

## Actualización posterior autorizada

Se implementaron las consultas académicas personales y sus rutas BFF, y se habilitó pgvector 0.8.7 local después de verificar un respaldo restaurable. La guía ya está publicada. Se prepararon actividades 1/4/6 inactivas y rúbricas 2/5 normalizadas únicamente como borradores por instrucción expresa del usuario; los exámenes 3/7 carecen de pesos por criterio. La corrección de fecha del cronograma fue excluida por el usuario y no se ejecutó. No hay confirmaciones humanas nuevas ni consultas RAG/Telegram activadas.

Detalles actuales: [infraestructura y piloto](2026-10-28-vector-and-course-pilot.md), [consultas autorizadas](../../src/academic-queries/README.md). El inventario y los pendientes que siguen a continuación corresponden a la comprobación inicial, antes de estos cambios.

---

Fecha: 2026-10-28. Entorno local de desarrollo. Backend `dev` en `c555535b`, frontend `dev` en `838fa5f` al comenzar. Ambos árboles estaban limpios.

## Dictamen

La base de permisos, biblioteca y preparación de actividades supera las comprobaciones ejecutadas. Todavía no hay un curso piloto completo ni infraestructura vectorial local preparada. No habilitar consultas estudiantiles del asistente hasta completar las fuentes y la capa de consultas autorizadas. RAG y Telegram siguen sin implementar; estas pruebas no certifican sus futuros consumidores.

## Resultados ejecutados

| Comprobación | Resultado y alcance |
| --- | --- |
| Suite backend | 611 tests pasan en 73 suites. El test opcional de Redis se ejecutó aparte. |
| Redis real | 1 test adicional pasa: sesiones compartidas entre instancias, límite concurrente y revocación. Usuario sintético y limpieza de sesiones. |
| Suite frontend | 37 tests pasan. Incluye contratos de biblioteca/preparación; no equivale a una prueba visual ni a navegación autenticada completa. |
| Seguridad frontend | 8 tests adicionales pasan: límites de cuerpo, JSON y restricciones de origen, entre otros contratos. |
| TypeScript | Backend y frontend pasan `tsc --noEmit --incremental false`. Backend repetido tras ampliar el script de integración. |
| Salud local | `/api/health`: database, redis_bullmq y storage `up`. |
| PostgreSQL | PostgreSQL 17.10. `migration:show` confirma 31 migraciones aplicadas, ninguna pendiente; última `AddCourseActivityConfirmations1793188800000`. |
| Flujo de dominio con PostgreSQL real | Confirmación de guía/cronograma, lectura del estudiante, prórroga propia, retiro/reapertura de fuente, invalidación por edición y conflicto por huella desactualizada pasan. |
| Permisos con PostgreSQL real | Pendiente/rechazado, institución inactiva, matrícula retirada, institución ajena y estudiante desactivado bloquean biblioteca, preparación y operación protegida. Reactivación permite una nueva operación. |
| Control previo al gasto | En todos los escenarios denegados, el callback que representa al proveedor tuvo cero invocaciones. Se comprobó autorización inicial seguida de desactivación antes de volver a autorizar la ejecución. No se ejecutó un worker RAG ni un modelo real. |
| Limpieza de fixtures | El script termina revirtiendo la transacción. Consulta posterior: cero instituciones temporales de esta verificación. |
| Cloudinary real | Descarga autenticada del cronograma publicado: HTTP 200, 162253 bytes, SHA-256 igual al registrado. Lectura exclusivamente; sin cargar, retirar ni reemplazar documentos. |
| Extracción del documento real | Reextracción de las dos páginas coincide exactamente con `pages` y `extracted_text` almacenados. La página 2 se renderizó e inspeccionó visualmente. |

Los primeros intentos de HTTP/PostgreSQL fallaron por restricciones del entorno aislado (puertos locales/EPERM). Se repitieron con acceso autorizado fuera del aislamiento y pasaron. No fueron defectos de la aplicación.

## Pendientes encontrados

### 1. Completar y corregir el curso piloto

La base local tiene un único documento en la biblioteca: un SCHEDULE, versión 1, publicado, revisado, READY, con 1704 caracteres y dos páginas. No hay GUIDE. Hay cero confirmaciones de actividades y el curso que contiene ese cronograma no tiene actividades registradas en `assignments`. Este inventario corresponde a esta base local, no a producción.

En la página 2 del PDF original, **Actividad 7: EXAMEN PARCIAL FINAL** tiene apertura **13/11/2026** y cierre **16/05/2026**, anterior a la apertura. La extracción conserva lo que dice el original. La fecha correcta debe confirmarla el docente; no se infirió ni corrigió automáticamente.

Acciones: corregir el documento fuente y publicar una nueva versión revisada; cargar la guía oficial socializada; registrar las actividades, rúbricas y fechas correspondientes; confirmar su vinculación con ambas versiones desde Preparación del curso.

### 2. Resolver el almacenamiento vectorial

La consulta a `pg_available_extensions` para `vector` devuelve cero filas. La extensión no está disponible en la instalación local; crear una migración con `CREATE EXTENSION` por sí solo no resolvería esa ausencia. No se alteró la imagen de PostgreSQL ni su volumen.

Antes de adoptar pgvector, preparar un entorno local compatible y verificar disponibilidad/permisos en la base de despliegue. El entorno remoto no fue inspeccionado. La alternativa de almacenamiento debe decidirse con esa evidencia.

### 3. Añadir la capa de consultas académicas del asistente

`EvaluationService.findAll`, `findOne` y `findBySubmission` conservan la política de lectura histórica de la web: el estudiante accede a su propia evaluación publicada. Esos métodos no comprueban matrícula vigente. La especificación acordada distingue expresamente esa política de la del nuevo asistente.

El asistente necesita operaciones que primero invoquen `AcademicAccessService` y después consulten únicamente sus actividades, prórrogas, entregas, notas y retroalimentaciones publicadas. El identificador del estudiante debe provenir de una sesión o vinculación validada. No copiar notas ni comentarios privados al índice compartido. No se modificó aquí la política histórica existente.

### 4. Verificar los consumidores cuando existan

- RAG: falta fragmentación con citas por documento/versión/página o sección, recuperación por curso e institución, exclusión inmediata de versiones retiradas/sustituidas y manejo de consultas sin evidencia suficiente.
- Costos: faltan cuotas y presupuesto específicos del asistente, límites de contexto/respuesta, registro de consumo, deduplicación y manejo de errores. Los límites HTTP existentes no prueban un presupuesto de IA.
- Calidad: preparar preguntas de evaluación antes de habilitar el piloto. Incluir citas correctas, ambigüedad entre cursos, datos ausentes, fuente contradictoria, cambio de versión y aislamiento entre estudiantes.
- Telegram: falta vinculación persistente revocable y autenticación propia del webhook. El guard BFF actual exige `x-bff-secret`; no se debe desactivar globalmente para acomodar Telegram. Probar token de un uso, caducidad, revocación, chat privado y actualizaciones duplicadas cuando se implemente.
- Calendario: el incremento actual cubre fechas de entrega y prórrogas; las sesiones de clase y otros eventos todavía no tienen un calendario estructurado propio.

## Orden recomendado

1. Corregir cronograma y completar guía, actividades y confirmaciones del curso piloto.
2. Implementar y probar las consultas académicas autorizadas para datos personales.
3. Resolver almacenamiento vectorial; implementar indexación de versiones, recuperación con citas y controles de consumo.
4. Validar el asistente desde el sitio con preguntas de referencia y pruebas de acceso/cambio de fuentes.
5. Integrar Telegram sobre los mismos servicios y políticas; comprobar vinculación y webhook.

## Reproducción de comprobaciones

Desde el backend:

```sh
./node_modules/.bin/jest --runInBand
RUN_REDIS_INTEGRATION=true ./node_modules/.bin/jest test/auth/session/session.redis-integration.spec.ts --runInBand
DB_HOST=127.0.0.1 STATE=dev ./node_modules/.bin/ts-node -r tsconfig-paths/register scripts/verify-course-preparation.ts
./node_modules/.bin/tsc --noEmit --incremental false
DB_HOST=127.0.0.1 STATE=dev ./node_modules/.bin/ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:show -d src/config/datasource.config.ts
```

Desde el frontend:

```sh
node --test scripts/*.test.mjs
node --test scripts/security.test.cjs
./node_modules/.bin/tsc --noEmit --incremental false
```

Consulta de capacidad vectorial, en modo lectura:

```sql
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name = 'vector';
```

El script de integración usa fixtures sintéticos dentro de una transacción y servicios reales con el mismo EntityManager; no ejercita el BFF ni el navegador. Los contratos HTTP se comprobaron en Jest. La descarga Cloudinary usa el original real, sin publicar firmas ni credenciales en el informe.

## Límites de esta verificación

No se repitió el recorrido completo del navegador con sesiones reales y todas las operaciones nuevas de preparación. Tampoco se certificaron producción, OCR/tablas arbitrarias, vencimiento de enlaces en esta sesión, embeddings, respuestas del modelo, cuotas efectivas ni Telegram. La prueba previa del 24 de octubre documenta el vencimiento de firmas y las operaciones de biblioteca a través del BFF, pero no sustituye una nueva prueba integral del asistente.

No se hicieron llamadas a modelos de IA, envíos de correo, migraciones nuevas, cambios de datos académicos reales, push ni despliegue. Se amplió únicamente el script de comprobación y se agregó este informe.
