# Biblioteca oficial — ejecución

**Spec:** ../specs/2026-10-24-course-library.md

Implementación nativa autorizada por el usuario al continuar la ruta, conservando los cambios de etapa 1 en dev.

- [x] Pruebas de archivos reales, permisos y publicación.
- [x] Extracción PDF/DOCX aislada y almacenamiento privado reutilizable.
- [x] Entidades, migración aditiva y servicio de versiones/revisión/publicación.
- [x] Controlador multipart autenticado, módulo y documentación de integración.
- [x] Pruebas HTTP, suite completa, compilación, tipos, lint y revisión independiente.

Revisar especialmente: publicación concurrente, hash de revisión y clave de idempotencia, acceso a documentos de otro curso, filtrado de versiones retiradas, archivos malformados o sin texto. No aplicar migraciones a producción.

## Resultado de verificación (2026-10-24)

- Suite completa: 70 suites y 591 pruebas aprobadas; una suite/prueba Redis opt-in omitida. Incluye cuatro pruebas HTTP reales con Nest/Supertest, BFF, multipart y validación de DTO.
- `nest build`: 279 archivos compilados. `tsc --noEmit --incremental false`: correcto. ESLint de archivos de esta etapa: correcto. `git diff --check`: correcto.
- Extracción PDF/DOCX verificada con archivos reales tanto desde TypeScript como desde `dist` compilado. No se hacen llamadas de IA.
- Migración `up/down/up` y restricciones comprobadas en PostgreSQL 17 local, en esquema temporal con tablas mínimas de referencia y `ROLLBACK`. No se aplicó al esquema de aplicación ni a producción. No se ejecutó una carrera concurrente contra PostgreSQL: pruebas unitarias verifican el bloqueo y la reutilización de una subida que ganó la carrera; la base comprueba unicidad de publicación.
- Revisión independiente encontró evasión del límite DOCX por contador ZIP inconsistente y descompresión síncrona previa al worker. Ambos corregidos y revalidados; cuatro regresiones de estructura manipulada fallaron antes de la corrección y pasan después.
- Cloudinary simulado en pruebas. Pendientes una carga/descarga real y la integración de las pantallas del frontend antes del piloto. No se declara completada la etapa de producto ni implementado RAG/Telegram.

Contrato y guía de integración: `src/course-documents/README.md`.

## Integración web y preparación de commits

El usuario autorizó integrar la biblioteca en dev de `aura-grade-front` y crear commits locales en ambos proyectos. La interfaz está implementada; su prueba de navegador utiliza un backend sintético (carga multipart, revisión, publicación, consulta estudiantil, cambio de curso y estados vacíos). El backend conserva 591 pruebas aprobadas y una opcional Redis omitida. Compilación y tipos correctos. La revisión de lint global encontró 98 errores de formato y 5 avisos en archivos preexistentes sin cambios; se mantiene la validación focalizada de los archivos afectados.

No se aplicó la migración al esquema real ni se conectó a Cloudinary real. Tampoco se realiza push o despliegue; esos pasos quedan después de los commits por instrucción del usuario.
