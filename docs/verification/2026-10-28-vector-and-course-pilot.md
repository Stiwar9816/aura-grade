# Preparación vectorial y curso piloto

## Infraestructura local

Imagen `aura-grade-postgres:17-vector0.8.7`, construida desde PostgreSQL 17 Alpine. Conserva el mismo montaje `./postgres:/var/lib/postgresql/data`; no se cambió de major ni familia Linux ni se eliminó el volumen. La compilación de pgvector desactiva las optimizaciones específicas de la CPU. Dockerfile: `docker/postgres/Dockerfile`.

Antes de recrear el contenedor se generó un respaldo lógico privado en `.tmp/backups/pre-vector-1793209728260.dump`, fuera de Git. Se restauró con `pg_restore --exit-on-error` en una base temporal y se compararon conteos de migraciones, documentos y usuarios con la fuente; después se eliminó únicamente esa base temporal. Tamaño: 206061 bytes. El respaldo corresponde al estado anterior a la carga del piloto.

Se activó el contenedor y la extensión en la base local. Resultado: pgvector 0.8.7; distancia L2 entre [1,0,0] y [0,0,0] igual a 1. La API volvió a reportar database/redis_bullmq/storage up. No se añadió una migración que obligue a habilitar la extensión en bases ajenas a esta preparación.

```sh
docker compose build db
# Respaldar y verificar restauración antes de recrear una base existente.
docker compose up -d --no-deps --wait db
DB_HOST=127.0.0.1 STATE=dev node scripts/verify-vector.cjs --enable
DB_HOST=127.0.0.1 STATE=dev node scripts/verify-vector.cjs
```

`verify-vector.cjs` consulta por defecto sin cambiar el esquema. `--enable` solo admite STATE=dev y host localhost/127.0.0.1. La política TLS replica los valores predeterminados de la app: require para prod, disable para dev, con respeto de DB_SSL_MODE explícito. Esta equivalencia tiene pruebas, incluida la regresión detectada en revisión final.

## Despliegue remoto pendiente

El compose de producción está preparado para construir la misma imagen, pero no se ejecutó ni desplegó. Para una base administrada, comprobar primero que el proveedor ofrezca `vector`, su versión y el permiso para habilitarla; después ejecutar el preflight con la configuración real, sin `--enable`. No se inspeccionó una base remota en esta sesión. No adoptar un índice vectorial definitivo ni aplicar migraciones RAG antes de esta comprobación.

Referencia de instalación y activación: [documentación oficial de pgvector](https://github.com/pgvector/pgvector). Fijado a 0.8.7 para esta imagen; cambios de versión requieren reconstrucción y pruebas.

## Importación del piloto

Guía publicada v1 (39 páginas, 60410 caracteres) y cronograma publicado v1. El PDF de la guía se descargó de Cloudinary en lectura: 530130 bytes, hash y texto por página iguales a los registrados. Se inspeccionaron visualmente las páginas de las rúbricas 1, 2, 4, 5 y 6.

Manifiesto revisable: `scripts/course-pilot/manifest.ts`. Importador: `scripts/import-course-pilot.ts`. Usa los servicios de dominio, transacción y bloqueo del curso; identifica rúbricas por curso/versión/actividad y no sobrescribe registros existentes. Por defecto ensaya y revierte; `--apply` persiste. Solo admite PostgreSQL local dev y exige fuentes publicadas/revisadas del mismo curso.

| Actividad | Resultado | Cierre Colombia |
| --- | --- | --- |
| 1. Pseudocódigo a Python | Actividad inactiva y rúbrica oficial asociada | 21/08/2026 23:59 |
| 2. Análisis y comparación | Solo rúbrica DRAFT normalizada de 105% a 100% | No se creó actividad |
| 3. Examen parcial 1 | Rúbrica DRAFT propuesta posteriormente por solicitud del usuario: 4 criterios al 25% | No se creó actividad |
| 4. Diseño y modularización | Actividad inactiva y rúbrica oficial asociada | 09/10/2026 23:59 |
| 5. Gestión de información | Solo rúbrica DRAFT normalizada de 125% a 100% | No se creó actividad |
| 6. Proyecto final | Actividad inactiva y rúbrica oficial asociada | 06/11/2026 23:59 |
| 7. Examen final | Rúbrica DRAFT propuesta posteriormente por solicitud del usuario: 4 criterios al 25% | No se creó actividad |

El usuario autorizó normalizar exclusivamente los borradores del sitio; no se cambió la guía. Actividad 2: pesos 19.05, 23.81, 19.05, 14.28, 23.81. Actividad 5: 12, 20, 20, 16, 12, 20. Se guardaron pesos originales, normalizados y referencias de origen en los metadatos de cada rúbrica. El redondeo por restos mayores mantiene exactamente 100.00%.

Las rúbricas de 1, 4 y 6 se publican mediante el flujo existente al asociarse a una actividad; conservan los pesos y niveles oficiales. Las actividades quedan inactivas. Las rúbricas 2 y 5 siguen DRAFT y no se utilizan en actividades para evitar publicar normalizaciones que todavía no están en la guía. No se inventaron pesos de los exámenes, no se corrigió el cronograma excluido por el usuario y no se registraron confirmaciones humanas de coherencia.

```sh
# Ensayo con rollback
DB_HOST=127.0.0.1 STATE=dev ./node_modules/.bin/ts-node -r tsconfig-paths/register scripts/import-course-pilot.ts
# Aplicación local autorizada
DB_HOST=127.0.0.1 STATE=dev ./node_modules/.bin/ts-node -r tsconfig-paths/register scripts/import-course-pilot.ts --apply
```

Para el piloto estudiantil: el docente debe revisar/activar las actividades preparadas y confirmar su coherencia en Preparación del curso; revisar los pesos propuestos de los exámenes; incorporar las normalizaciones aprobadas a una nueva guía oficial antes de utilizar 2 y 5. Las fechas de 1 y 4 ya son pasadas; se preservaron literalmente. RAG y Telegram continúan como siguientes etapas.

### Actualización: criterios de los exámenes 3 y 7

El usuario solicitó crear los criterios faltantes. Se conservaron los cuatro nombres de criterio de cada examen en la guía; se propusieron pesos iguales de 25% y cuatro niveles de desempeño específicos del propósito conceptual de cada examen. No se exige entregar o ejecutar un programa como requisito nuevo.

| Examen parcial 1 (actividad 3) | Examen final (actividad 7) | Peso por criterio |
| --- | --- | --- |
| Comprensión conceptual | Comprensión conceptual | 25% |
| Capacidad de análisis | Capacidad de análisis | 25% |
| Claridad en la argumentación | Argumentación | 25% |
| Identificación de errores | Interpretación de código | 25% |

Los borradores distinguen su origen: `source=AI`, `criteriaOrigin=PUBLISHED_GUIDE` y `weightsAndLevelsOrigin=ASSISTANT_PROPOSAL`. Los pesos propuestos no se registran como pesos extraídos de la guía (`sourceWeights=null`). No se atribuye un modelo o una llamada API que no se haya ejecutado. Se guardan solo rúbricas DRAFT; no se publican, no crean tareas ni cambian el cronograma. El docente debe revisar estas propuestas antes de incorporarlas a la guía oficial y programar los exámenes.

El manifiesto y el importador incluyen ahora ambas propuestas de forma idempotente. Las rúbricas/actividades importadas anteriormente se conservan sin cambios.

Validación de esta actualización: ensayo con rollback y aplicación correctos; lectura posterior confirma ambas rúbricas DRAFT de origen AI, cuatro criterios de 25% y cuatro niveles por criterio. Total 100% en cada rúbrica. TypeScript y los 635 tests del backend pasan (un test opcional de Redis omitido). Inventario posterior: siete rúbricas del piloto, tres PUBLISHED y cuatro DRAFT; continúan las mismas tres actividades inactivas.

## Verificación final de la implementación

- Backend: 635 tests aprobados en 77 suites; el test opcional específico de Redis queda omitido en la suite general. La integración nueva sí ejecutó Redis real junto a PostgreSQL, HTTP y guards, y pasó.
- Frontend: 48 tests aprobados (40 de funcionalidad/contratos y 8 de seguridad), TypeScript, ESLint de archivos nuevos y build Next.js pasan. El build incluye la ruta `/api/courses/[courseId]/academic-queries/[...segments]`.
- Backend: TypeScript, ESLint de módulo/tests y build Nest/SWC pasan. Prueba RED/GREEN del valor predeterminado TLS de producción después del hallazgo independiente.
- Segunda importación `--apply`: mismos identificadores, sin duplicados ni cambios. Inventario final: 3 actividades inactivas, 5 rúbricas del piloto (3 publicadas por asociación y 2 DRAFT), 2 fuentes publicadas, cero confirmaciones automáticas y cero instituciones temporales de pruebas.
- PostgreSQL conserva versión 17.10, 31 migraciones y pgvector0.8.7. No se ejecutó deploy remoto, proveedor IA ni notificaciones. La integración HTTP usa sesiones sintéticas y no sustituye login/OTP o recorrido visual completo.
