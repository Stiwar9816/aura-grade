# Asistente del curso en el sitio

Primera entrega RAG sobre documentos oficiales; Telegram queda para la siguiente etapa. Se trabaja en dev por instrucción del usuario.

- Docente propietario prepara cada versión publicada por lotes reanudables de 16 fragmentos, sin colas ni trabajos ocultos. Solo índices completos se consultan. Repetir una preparación completa no consume API.
- Fragmentos de hasta 1600 caracteres, solapamiento 200, conservando página PDF o número de fragmento DOCX; embedding gemini-embedding-001 de 768 dimensiones normalizado. Identidad fija de modelo y segmentación. No mezclar espacios vectoriales.
- PostgreSQL/pgvector, búsqueda exacta por curso y versión vigente. Un trigger elimina el índice al retirar/modificar la fuente; publicación nueva exige preparación. Sin notas/entregas en el índice.
- DOCX usa texto extraído aunque no tenga páginas. Una fuente demasiado grande informa su error en el listado sin ocultar las demás.
- Estudiante activo, aprobado, institución activa y matrícula vigente verificados antes de recuperar, antes de cada llamada de IA y antes de responder. Docente autorizado al preparar, antes de API y al persistir. No cachear permisos ni respuestas.
- Preguntas de 3–1000 caracteres, seis fragmentos como máximo, respuesta de hasta 4000 caracteres. Gemini devuelve respuesta y referencias que se validan contra los fragmentos recuperados. Sin evidencia: respuesta explícita, sin inventar citas. El texto documental es dato no confiable, nunca instrucciones.
- Cuota atómica Redis: 20 preguntas por estudiante/día, 1000 preguntas globales/día; 512 fragmentos por docente/día, 4096 globales/día. Una operación simultánea por actor, TTL 90 segundos. Día de Colombia, TTL cuotas 48h. Fallos consumen reserva; Redis indisponible deniega antes de la API. Valores configurables acotados. Sin reintentos automáticos del proveedor.
- Consultas privadas se muestran desde AcademicQueriesService mediante controles explícitos de próximas entregas y resultados; no pasan por el modelo. No cambiar ni activar borradores.
- UI por curso, plegable, límites y estados claros, fuentes con página/versión y vista previa; texto plano escapado, sin HTML generado. Sin historial persistente. BFF valida rutas, sesión, origen y tamaño.
- Migración requiere vector previamente habilitado; aplicación local tras backup. Probar con dobles para seguridad/carreras y PostgreSQL/Redis reales. Verificación Gemini limitada al piloto; distinguir de pruebas automatizadas.

Referencia técnica: https://ai.google.dev/gemini-api/docs/embeddings (taskType RETRIEVAL_DOCUMENT/QUERY, normalización manual 768 para embedding-001); SDK @google/genai ya instalado. No modificar el proveedor de calificación.
