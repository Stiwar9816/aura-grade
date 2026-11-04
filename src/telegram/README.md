# Telegram (etapa 5)

Vinculación y consultas privadas por chat privado. Reutiliza `AcademicAccessService` (vía `AcademicQueriesService`) y `CourseAssistantService`; no añade lógica de permisos propia. Las notificaciones Telegram son la etapa 6 y no están aquí.

## Flujo

1. Estudiante autenticado: `POST /api/telegram/link/token` → `{ url: https://t.me/<bot>?start=<código>, expiresAt }`. Código de 256 bits, un solo uso, 10 min, máximo 5 por hora y usuario; solo se guarda su SHA-256 y un código nuevo anula los anteriores. `GET /api/telegram/link` informa el estado y `DELETE /api/telegram/link` revoca.
2. En Telegram, `/start <código>` consume el código con un `UPDATE … WHERE used_at IS NULL AND expires_at > now()` atómico, revalida cuenta/institución/rol y crea `telegram_links` (revocable, independiente de la sesión web). Un Telegram vinculado a otra cuenta se rechaza hasta `/desvincular`.
3. `POST /api/telegram/webhook` (Telegram → backend, **sin** `x-bff-secret`): autentica con `x-telegram-bot-api-secret-token` (comparación en tiempo constante), acepta solo texto de personas en chat privado donde el remitente es el chat, limita 20 mensajes/min por remitente, deduplica por `update_id` (Redis `NX`, 48 h) y encola con `attempts: 1`. Grupos, canales, bots, ediciones y otros tipos se confirman con 200 y se ignoran. Si falla el encolado se libera la marca y se responde 503 para que Telegram reenvíe.
4. El worker (`telegram-updates`) resuelve la vinculación por `telegram_user_id` + `chat_id` y llama a servicios que revalidan el acceso en cada operación, incluida una matrícula retirada mientras el trabajo esperaba. El texto del mensaje nunca aporta identidad ni curso.

Comandos: `/cursos`, `/curso N`, `/entregas`, `/actividades`, `/resultado N`, `/desvincular`, `/ayuda`; cualquier otro texto es una pregunta RAG (cuota diaria y exclusión simultánea existentes). Con un solo curso se usa sin elegir; con varios hay que elegir (`selected_course_id` es solo una preferencia, se revalida). Las notas se muestran solo si están publicadas; la nota 0 es válida. Las fechas usan hora de Colombia y la prórroga personal.

Citas: Telegram recibe título, versión y página; nunca el documento. Se enlaza a la web, donde el visor autorizado aplica la sesión del estudiante.

## Seguridad y operación

- `SkipBffAuth` exime **solo** al handler del webhook; el resto de rutas conserva `BffAuthGuard`. El throttler global por IP se omite en el webhook porque Telegram comparte IPs; lo sustituye el límite por remitente tras autenticar.
- Desactivado por defecto. Requiere `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (ver `.env.template`). Sin ellas el webhook responde 404 y la web oculta la tarjeta.
- Los trabajos conservan el texto del mensaje (puede contener un código ya consumido o una pregunta): 1 h si terminan, 24 h si fallan. Bull Board está protegido por autenticación básica. No se registran cuerpos ni la URL de la API de Telegram.
- Telegram debe alcanzar el backend por HTTPS público. Hoy el backend se asume detrás del BFF: la exposición de `/api/telegram/webhook` (y solo esa ruta) en el proxy/ingress es una decisión de despliegue pendiente. Registrar con `setWebhook` usando `url`, `secret_token` y `allowed_updates=["message"]`.
- Migración: `AddTelegramLinks1793361600000` (aditiva). Si el worker falla después de aceptar el mensaje no hay reintento (por diseño, para no repetir una llamada de pago ni una respuesta): el estudiante repite la consulta.

## Pruebas

`jest test/telegram test/common/guards`: análisis de actualizaciones, webhook (secreto, grupo, duplicado, límite, Redis/cola caídos), bot (no vinculado, identidad solo por vinculación, denegación y revocación durante la cola, elección de curso, cuota, citas, nota 0, prórroga, vinculación), servicio de vinculación con base simulada y frontera HTTP con `BffAuthGuard` real. Frontend: `node --test scripts/telegram-link.test.mjs`.
