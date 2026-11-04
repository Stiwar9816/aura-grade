# Biblioteca oficial por curso — backend

Segunda entrega de la ruta acordada, sobre dev. API REST protegida por sesión/BFF; no realiza llamadas de IA. La interfaz del sitio es un consumidor posterior de este contrato y no está en este repositorio.

## Modelo y flujo

Un documento lógico pertenece a un curso y tiene título y tipo GUIDE, SCHEDULE o MATERIAL. Solo una guía y un cronograma por curso; los materiales admiten múltiples documentos. Sus versiones conservan archivo original privado, nombre, formato, tamaño, SHA-256, texto y páginas extraídas, resultado de extracción, autor, revisión y fechas de publicación/archivo.

Crear documento → subir versión PDF/DOCX → revisar texto → confirmar revisión del hash → publicar. Numeración monotónica por documento bajo bloqueo de fila. Una sola versión publicada por documento, protegida también por índice único parcial; publicar otra archiva la anterior en la misma transacción. La última publicación retirada puede reabrirse conservando su archivo y revisión confirmada; las versiones sustituidas por una publicación posterior requieren subir otra versión. Retirar una publicación archiva sus versiones publicadas sin borrar los archivos originales ni el historial.

La revisión confirma el contenido extraído de ese archivo inmutable, no permite modificarlo en la base de datos y desalinearlo de la guía descargable. La extracción vacía queda NEEDS_TEXT y no puede revisarse/publicarse; hay que subir una versión legible. El PDF con texto conserva números de página; DOCX no inventa números de página. No se extraen fechas automáticamente al calendario en esta entrega.

## Acceso

Solo docente activo/aprobado de institución activa propietario del curso administra documentos y ve borradores/historial. Estudiante activo/aprobado, de institución activa y matriculado en el mismo curso/institución solo lista, consulta y descarga versiones PUBLISHED. Verificaciones actuales mediante la política de la etapa 1; ninguna identidad se obtiene del cuerpo del request. Administradores no tienen acceso a documentos por defecto en esta entrega. DTOs explícitos excluyen identificadores del almacenamiento, hashes internos de revisión de otros actores y entidades relacionadas.

El texto extraído se devuelve en el detalle autorizado; el listado solo contiene metadatos. La descarga firma una URL privada de 60 segundos tras comprobar acceso. Las URLs ya emitidas conservan esa ventana, incluso si después se revoca acceso.

## Archivos y consistencia

Máximo 15 MiB, PDF/DOCX por extensión, MIME y estructura. Reutilizar validación estructural DOCX con límite de descompresión de 50 MiB. Extracción en worker con memoria acotada, timeout 20 s, máximo 300 páginas PDF y 500000 caracteres; errores de formato no crean versiones ni suben archivos. Los originales se guardan en carpeta Cloudinary separada y autenticada. Ante fallo de persistencia, intentar eliminar el archivo subido y registrar identificador para limpieza si también falla esa operación. Revalidar autor y curso antes de guardar tras extracción/subida.

La subida usa Idempotency-Key UUID por documento: reintentos con mismo hash devuelven la versión existente; contenido distinto con la misma clave devuelve conflicto. Transacciones bloquean el documento lógico para cambios de versión/publicación. No se realizan operaciones de red de almacenamiento dentro de la transacción.

## API

Base `/api/courses/:courseId/documents`:
- POST: crear documento `{title, kind}`.
- GET: listar documentos visibles, paginado.
- GET `/:documentId/versions`: listar versiones visibles, paginado.
- POST `/:documentId/versions`: multipart `file` + Idempotency-Key.
- GET `/:documentId/versions/:versionId`: detalle y texto extraído autorizado.
- POST `/:documentId/versions/:versionId/review`: `{confirmed: true, contentHash}`.
- POST `/:documentId/versions/:versionId/publish`: publicar versión revisada o reabrir la última publicación retirada.
- POST `/:documentId/archive`: retirar publicación.
- GET `/:documentId/versions/:versionId/download`: `{url}` con no-store.

## Validación

Pruebas de acceso cruzado, cuenta/institución inactiva, pérdida de matrícula, borrador inaccesible para estudiantes, falta de revisión/texto, versiones y repetición de subida, limpieza al fallar persistencia. Probar extracción real PDF y DOCX, PDF sin texto, archivos falsos/excesivos. HTTP multipart detrás de guards, DTOs y prefijo; migración reversible y restricciones en PostgreSQL aislado si está disponible. Suite completa, build, tipos y lint. No se declara desplegado ni migrado el entorno del usuario.
