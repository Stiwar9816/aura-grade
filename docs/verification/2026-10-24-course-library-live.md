# Verificación local de biblioteca con Cloudinary real

Fecha: 2026-10-24. Backend `dev`, implementación `e87d5369`; frontend `dev`, implementación `cd975f6`. Prueba operativa solicitada después de integrar la biblioteca y preparar ambos commits.

## Entorno y migración

- PostgreSQL 17 local, base `auraGradeDB`, `STATE=dev`, `synchronize=false`.
- Aplicadas mediante TypeORM, en una transacción: `PreserveEvaluationReviewSnapshots1791806400000` y `AddCourseDocumentLibrary1792843200000`. La primera agrega dos columnas JSONB de historial de evaluación; la segunda crea la biblioteca. `migration:show` confirmó las 30 migraciones aplicadas.
- Backend Docker en `http://localhost:3000`; frontend de desarrollo existente en `http://localhost:3001`; Redis local. `/api/health` respondió 200.
- El primer intento detectó que el proceso del backend aún no había cargado las nuevas rutas: POST devolvía 404 y Swagger no incluía documentos. Además faltaba `pdf-parse` en el volumen de dependencias del contenedor. Se ejecutó `docker exec aura_grade_dev pnpm install --frozen-lockfile` y `docker compose restart aura_grade_api`. Se instaló `pdf-parse` 2.4.5 y arrancó `CourseDocumentsModule`. No fue necesario modificar código.

## Pruebas reales

Se crearon una institución, un curso y cuentas temporales de docente/estudiante. El acceso usó contraseña y OTP por los endpoints existentes; no se deshabilitaron guards. Las operaciones de biblioteca pasaron por las rutas HTTP del BFF con la sesión de prueba y comprobación de origen. El contenido de los archivos fue sintético; almacenamiento, extracción, autorización, base de datos y descargas fueron reales.

| Comprobación | Resultado |
| --- | --- |
| Acceso sin sesión | 401 |
| PDF multipart, extracción y referencia de página | READY; texto y página correctos |
| Reintento con la misma clave y bytes | Misma versión; una fila |
| Borrador consultado por estudiante | Lista vacía y detalle 404 |
| Publicación sin revisión | 400 |
| Revisión vinculada al hash y publicación | Publicación visible para estudiante matriculado |
| Descarga a través del BFF | 302 a HTTPS Cloudinary; `Cache-Control: no-store` |
| Original descargado | 200 y bytes idénticos al PDF/DOCX subido |
| URL del original sin firma | 401 |
| URL con firma vencida | 401 |
| URL realmente emitida, transcurridos sus 60 segundos | 401, sin regenerar la firma |
| Retirar matrícula | Nueva descarga 403; al matricular de nuevo vuelve a 302 |
| Desactivar estudiante con sesión existente | Nueva descarga 401 |
| Segunda versión DOCX | READY, texto correcto y sin páginas artificiales |
| Publicar segunda versión | Primera archivada; segunda publicada |
| Retirar publicación | Versión archivada; conserva historial |

## Limpieza y alcance

Se revocaron las sesiones temporales y se eliminaron las filas creadas por la prueba. La limpieza inicial esperaba que la consulta de un archivo eliminado devolviera 404, pero la cuenta tiene respaldos habilitados: Cloudinary conservó registros `placeholder=true`, `bytes=0`, `backup=true`. Las descargas nuevas ya devolvían 404. Se eliminaron exclusivamente las versiones respaldadas de los dos archivos de esta prueba; la consulta posterior confirmó 404 para ambos recursos. No se modificó la configuración general de respaldos. Este comportamiento está documentado en [Backups and Version Management](https://cloudinary.com/documentation/backups_and_version_management).

No se hicieron llamadas a modelos de IA, envíos de correo, push, despliegue ni migración de producción. El test real no repitió la inspección visual del navegador; esa validación anterior usó un backend sintético. El bloqueo por institución inactiva y otros estados de aprobación conserva cobertura automatizada, pero no se repitió en esta prueba real. RAG y Telegram siguen pendientes.
