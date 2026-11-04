# Biblioteca oficial por curso

API backend para conservar la guía, el cronograma y materiales que el docente comparte con sus estudiantes. Esta entrega no genera actividades, no interpreta fechas ni llama a proveedores de IA. La interfaz web está implementada en `aura-grade-front`, dentro de Cursos para docentes y estudiantes; el índice RAG todavía no está conectado.

## Flujo del docente

1. Crear un documento `GUIDE`, `SCHEDULE` o `MATERIAL`. Hay una guía y un cronograma por curso; sus actualizaciones son nuevas versiones del mismo documento.
2. Subir el PDF o DOCX definitivo. Si hay actividades generadas con IA, el docente las incorpora manualmente al archivo antes de subirlo.
3. Consultar el detalle y comparar el texto extraído con el original descargable. Una extracción `NEEDS_TEXT` exige una nueva versión legible; no hay OCR en esta entrega.
4. Confirmar la revisión enviando el `contentHash` del detalle.
5. Publicar. La publicación anterior pasa a `ARCHIVED` en la misma transacción. Los estudiantes ven únicamente la publicación vigente.

Retirar una publicación conserva archivos e historial. Se puede reabrir la última publicación retirada si conserva texto legible y revisión confirmada. Las versiones archivadas por una publicación posterior no se republican; para recuperar ese contenido se sube una nueva versión. Un borrador anterior a la última publicación tampoco puede reemplazarla.

## Contrato HTTP

Base: `/api/courses/:courseId/documents`. UUID en identificadores. Todas las rutas requieren JWT y pasan por el guard BFF existente; el secreto BFF se conserva exclusivamente en el servidor del frontend.

| Método y ruta relativa | Entrada / resultado |
| --- | --- |
| `POST /` | `{ "title": "Guía del curso", "kind": "GUIDE" }` → documento |
| `GET /?page=1&limit=20` | `{ items, total, page, limit }`, metadatos de documentos visibles |
| `GET /:documentId/versions?page=1&limit=20` | Versiones visibles, metadatos paginados |
| `POST /:documentId/versions` | Multipart con un único campo `file`; cabecera `Idempotency-Key` UUID → metadatos de versión |
| `GET /:documentId/versions/:versionId` | Metadatos, `extractedText`, `pages: [{ page, text }]` y `canReopen` |
| `POST /:documentId/versions/:versionId/review` | `{ "confirmed": true, "contentHash": "<SHA-256 del detalle>" }` |
| `POST /:documentId/versions/:versionId/publish` | Publica un borrador revisado o reabre la última publicación retirada |
| `POST /:documentId/archive` | Retira la publicación vigente |
| `GET /:documentId/versions/:versionId/download` | `{ "url": "<enlace privado temporal>" }` |

Todos los GET usan `Cache-Control: no-store`. Los listados no incluyen texto; el detalle y la descarga vuelven a comprobar autorización. PDF conserva páginas; DOCX devuelve `pages: []` porque su paginación depende del renderizado.

Ejemplo de subida **desde el BFF**, usando su sesión validada y configuración privada:

```ts
const form = new FormData();
form.append('file', file);
const response = await fetch(`${backendUrl}/api/courses/${courseId}/documents/${documentId}/versions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${sessionAccessToken}`,
    'X-BFF-Secret': bffSecret,
    'Idempotency-Key': uploadKey,
  },
  body: form,
  cache: 'no-store',
});
if (!response.ok) throw new Error(`La carga falló: ${response.status}`);
const version = await response.json();
```

El BFF no debe fijar `Content-Type` al enviar FormData: `fetch` añade el boundary. Conservar el mismo `uploadKey` UUID al reintentar el mismo archivo; generar otro al cambiarlo. La repetición con los mismos bytes devuelve la versión existente; reutilizar la clave para otro archivo devuelve 409.

## Acceso y límites

- Administra el docente propietario, activo y aprobado, de una institución activa. No hay acceso administrativo global a documentos.
- Lee el estudiante activo/aprobado de institución activa, matriculado en ese curso y de la misma institución. La baja impide emitir nuevas descargas. Una URL ya emitida vence a los 60 segundos.
- PDF/DOCX de hasta 15 MiB; DOCX hasta 50 MiB descomprimido; PDF hasta 300 páginas; texto hasta 500000 caracteres. Validación estructural DOCX y extracción se ejecutan en worker con timeout de 20 segundos y límites de heap de V8. No son un límite total de memoria nativa del proceso.
- Subidas limitadas a 10 por minuto mediante el throttler existente. La extracción se ejecuta por petición; en despliegues con muchos docentes simultáneos conviene añadir una cola y limitar concurrencia antes de aumentar capacidad.
- Originales autenticados en `auragrade/course-documents`, separados de entregas. Nunca se devuelve el identificador interno del almacenamiento.
- Tras subir el archivo se vuelve a autorizar antes de persistir. Si falla la transacción, se intenta borrar el archivo; un fallo de limpieza registra su identificador para recuperación operativa.
- Las claves foráneas `RESTRICT` conservan trazabilidad: no se pueden eliminar físicamente cursos o usuarios referenciados por documentos. Se usa la desactivación existente para revocar acceso.

Errores esperados: 400 archivo/revisión inválidos, 401 sesión inválida, 403 acceso denegado, 404 documento/versión no disponible, 409 conflicto de documento o publicación, 413 tamaño excedido, 429 límite de solicitudes.

## Activación y verificación

Migración aditiva: `1792843200000-AddCourseDocumentLibrary`. Aplicarla en el entorno destino mediante el procedimiento habitual antes de servir estas rutas. Usa la configuración Cloudinary existente; no necesita credenciales de IA ni Telegram. `synchronize` debe permanecer desactivado.

El smoke SQL reproducible se genera con `node scripts/print-course-library-migration-check.cjs` después de compilar. Ejecutar ese SQL con `psql -v ON_ERROR_STOP=1`: crea un esquema temporal dentro de una transacción, prueba restricciones y `up/down/up`, y termina con `ROLLBACK`. Usa tablas mínimas de usuarios/cursos; no sustituye una prueba de actualización completa del entorno.

Pruebas en `test/course-documents` cubren archivos reales, ZIP manipulado, publicación, acceso, idempotencia, limpieza y middleware multipart. Estas pruebas automatizadas simulan Cloudinary. El 2026-10-24 también se verificó el proveedor real desde el BFF del frontend contra el backend local, PostgreSQL y Redis: PDF/DOCX, revisión, publicación, descarga, revocación y vencimiento. Evidencia y límites en [verificación del entorno](../../docs/verification/2026-10-24-course-library-live.md).

La migración quedó aplicada en la base local de desarrollo `auraGradeDB`; los demás entornos deben ejecutar su propio procedimiento de migración. La inspección visual anterior usó datos sintéticos; la prueba real posterior ejercitó las rutas HTTP del BFF, sin repetir la inspección visual. El siguiente paso es enlazar actividades y calendario con las versiones oficiales; el RAG recuperará solo publicaciones autorizadas y tendrá que retirar contenido archivado de sus índices.
