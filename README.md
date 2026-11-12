<p align="center">
  <a href="https://aura-grade-front.vercel.app/" target="blank"><img src="https://cwqqnloewcseaoxzuhrf.supabase.co/storage/v1/object/sign/auragrade/auragrade.png?token=eyJraWQiOiJkYzM0OTJkNi04MmNlLTRiMDAtYjViZC05ODk2NDAwM2JlODYiLCJhbGciOiJFUzI1NiJ9.eyJ1cmwiOiJhdXJhZ3JhZGUvYXVyYWdyYWRlLnBuZyIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3OTQ1MDE2ODgsImV4cCI6MjEwOTg2MTY4OH0._UhmAzTz3R0g0mzLPo298aWq6nQMtw6TSCXKBlBkUbaULH0gUPXaLW6AhkgzKUcCaLpjMIjsj75S_8KSrk4ESQ" width="500" alt="AuraGrade Logo" /></a>
</p>

# 🚀 AuraGrade - NestJS (Clasificación asistida por IA)

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-E10098?style=for-the-badge&logo=graphql&logoColor=white)](https://graphql.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![Gemini](https://img.shields.io/badge/Gemini-412991?style=for-the-badge&logo=gemini-ai&logoColor=white)](https://gemini.google.com/)
[![Supabase](https://img.shields.io/badge/Supabase_Storage-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/storage)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Redis](https://img.shields.io/badge/Upstash_Redis-00E9A3?style=for-the-badge&logo=upstash&logoColor=white)](https://upstash.com/)
[![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com/)
[![CI/CD](https://img.shields.io/badge/CI/CD-412991?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/features/actions)

API para la gestión y calificación asistida por IA de trabajos académicos. AuraGrade analiza entregas en DOCX, las compara con rúbricas versionadas y genera un borrador de evaluación que el docente revisa antes de publicar. También administra la biblioteca de documentos de cada curso (PDF/DOCX) y un asistente que responde con base en esos documentos.

## 🗺️ Arquitectura de despliegue

| Componente       | Servicio                     | Notas                                                         |
| :--------------- | :--------------------------- | :------------------------------------------------------------ |
| API NestJS       | Render (Web Service, Docker) | Proceso continuo: HTTP, workers de BullMQ, outbox y timers    |
| Frontend + BFF   | Vercel (`aura-grade-front`)  | Único cliente autorizado del backend (`BFF_SHARED_SECRET`)    |
| PostgreSQL 17    | Supabase                     | `pgvector` para RAG y `pg_cron` para limpieza programada      |
| Archivos         | Supabase Storage             | Bucket privado `auragrade`, acceso por API S3 y URLs firmadas |
| Redis            | Upstash                      | Colas BullMQ, sesiones y rate limiting (TLS, `rediss://`)     |
| Correo / Errores | Resend / Sentry              |                                                               |

La API no usa la API REST, Auth ni Realtime de Supabase: los roles `anon`,
`authenticated` y `service_role` no tienen permisos sobre las tablas de
`public`.

## ✨ Características

### 🤖 Inteligencia Artificial & Automatización

- **Evaluación asistida**: borrador de calificación con OpenAI (`gpt-4o`) o Gemini (`gemini-3.5-flash`) según rúbricas versionadas; el docente revisa y publica.
- **Extracción de texto**: DOCX para entregas; PDF y DOCX para documentos del curso.
- **Feedback estructurado**: puntaje por criterio, retroalimentación cualitativa, diagnósticos de calificación y solicitudes de reevaluación.
- **Biblioteca y asistente del curso (RAG)**: documentos oficiales versionados con revisión y publicación, fragmentados e indexados con `gemini-embedding-001` en `pgvector`.
- **Exportación para entrenamiento**: historial de calificaciones exportable en JSONL.

### ☁️ Gestión de Archivos

- **Almacenamiento privado**: Supabase Storage mediante su API compatible con S3 (`src/storage`). Las llaves S3 solo dan acceso a Storage, no a la base de datos.
- **Organización**: bucket `auragrade` con carpetas `submissions/` y `course-documents/`; claves `<carpeta>/<uuid>.<pdf|docx>` validadas por carpeta antes de cada operación.
- **Descargas**: URLs firmadas de 60 segundos emitidas tras validar sesión y permisos. El campo GraphQL `fileUrl` devuelve la ruta del BFF, nunca una URL del proveedor.
- **Validación**: el bucket solo admite `application/pdf` y DOCX, con máximo 15 MB.

### 🔔 Notificaciones

- **Centro in-app, correo, Web Push y Telegram**, con preferencias por usuario.
- **WebSocket Gateway** (Socket.io) disponible para actualizaciones del estado de calificación.

### 🛡️ Seguridad y Rendimiento

- **Rate Limiting**: `@nestjs/throttler` con almacenamiento en Redis (200 req/min por cliente).
- **Mínimo privilegio en base de datos**: la API conecta con el rol `aura_grade_app` (solo lectura/escritura de datos); las migraciones usan el rol administrador.
- **Auditoría**: registro durable de acciones administrativas con retención de 30 días.
- **Validación de Entorno**: Esquemas de validación con Joi para asegurar que la App no arranque con variables faltantes.
- **Docker Hardening**: Imagen basada en Alpine (Node 22 LTS), Multi-stage builds y ejecución segura con usuario no-root.

### ⚙️ Procesamiento Asíncrono y Colas

- **BullMQ**: colas `grading`, `notifications`, `audit` y `telegram`.
- **Outbox transaccional**: los eventos se guardan en `outbox_events` dentro de la misma transacción y un despachador (cada 5 s) los publica en BullMQ; un reconciliador recupera trabajos perdidos.
- **Bajo consumo en Redis**: workers y listeners esperan trabajos hasta 5 minutos por consulta (`src/common/queue/queue-polling.options.ts`), y el escaneo de recordatorios usa un timer del proceso en lugar de un job repetitivo. Upstash cobra por comando; así el consumo en reposo baja a unos 4–5k comandos/día.
- **Bull Board**: panel en `/queues` protegido con Basic Auth.
- **Entrega idempotente**: registro por evento y canal para reintentar solo el canal pendiente.
- **Limpieza programada**: `pg_cron` ejecuta `public.purge_expired_records()` a diario (ver [Retención de datos](#-retención-de-datos)).

### 🔐 Autenticación y Autorización

- ✅ Registro, inicio de sesión y recuperación de contraseña por correo.
- ✅ Sesiones opacas almacenadas en Redis, con expiración por inactividad y absoluta.
- ✅ Segundo factor TOTP compatible con Google Authenticator y Microsoft Authenticator.
- ✅ Roles (Administrador, Docente, Estudiante).
- ✅ Guards y Decoradores personalizados.
- ✅ Basic Auth para proteger el panel de monitoreo de Bull Board.

### 👥 Gestión de Usuarios

- ✅ CRUD completo de usuarios
- ✅ Roles de usuario (Administrador, Docente, Estudiante)
- ✅ Activación/desactivación de usuarios
- ✅ Validación de documentos (6 tipos diferentes)
- ✅ Normalización automática de emails

### 📧 Sistema de Emails

- ✅ Confirmación de registro
- ✅ Actualización de contraseña
- ✅ Recuperación de contraseña
- ✅ Invitación de usuarios importados
- ✅ Avisos de nuevas entregas, calificaciones publicadas y recordatorios de tareas
- ✅ Templates personalizables

### 📚 Documentación

- ✅ Swagger para API REST
- ✅ GraphQL Playground
- ✅ Documentación de tipos con decoradores

### 🛠️ Utilidades

- **Database Seeding**: Poblado automático de base de datos con usuarios y rúbricas de prueba.
- **GraphQL API**: esquema generado desde decoradores de NestJS (code-first).

## 📋 Requisitos Previos

- Node.js >= 22.x (LTS)
- pnpm 11.23.0 (fijado en `package.json` y en la imagen Docker)
- Docker & Docker Compose (PostgreSQL con pgvector + pg_cron y Redis locales)
- Proyecto de Supabase (PostgreSQL y Storage con un bucket privado y llaves S3)
- Base Redis en Upstash para producción
- Cuenta y API key de Resend
- API Key de OpenAI o Gemini
- Proyecto y DSN de Sentry (opcional)

## 🚀 Instalación y Configuración

### 1. Clonar y dependencias

```bash
git clone <repository-url>
cd aura-grade
corepack enable
pnpm --version # Debe mostrar 11.23.0
pnpm install --frozen-lockfile
```

Corepack puede descargar pnpm la primera vez que se ejecuta; ese mensaje es
normal. En CI o en cualquier instalación sin terminal interactiva usa:

```bash
CI=true pnpm install --frozen-lockfile
```

El `Dockerfile` ya establece `CI=true` en las etapas `deps`, `builder` y
`prod-deps`, por lo que no solicita confirmación si debe reconstruir un
`node_modules` creado con otra versión de pnpm. La imagen final no incluye
Corepack ni pnpm.

La carpeta `.pnpm-store/` es una caché local recreable: no se versiona ni se
envía en el contexto de Docker. El archivo que garantiza instalaciones
reproducibles y sí debe permanecer en Git es `pnpm-lock.yaml`.

### 2. Configurar Entorno

Copia el archivo `.env.template` a `.env` y configura tus credenciales:

```bash
cp .env.template .env
```

No copies secretos reales en `.env.template` ni en el repositorio. Como mínimo,
verifica estos grupos antes de iniciar la API:

- Aplicación: `STATE`, `APP_NAME`, `PORT` y `FRONTEND_URL`.
- Base de datos: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`,
  `DB_SSL_MODE` y `DB_CONNECTION_TIMEOUT_MS`.
- Correo: `MAIL_FROM`, `RESEND_API_KEY` y todos los identificadores
  `RESEND_*_TEMPLATE_ID`, incluidos `RESEND_TASK_REMINDER_TEMPLATE_ID` y
  `RESEND_USER_INVITATION_TEMPLATE_ID`.
- IA: `AI_PROVIDER=openai` o `AI_PROVIDER=gemini` y la clave del proveedor
  seleccionado.
- Almacenamiento: `STORAGE_S3_ENDPOINT`
  (`https://<project-ref>.storage.supabase.co/storage/v1/s3`),
  `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY_ID`,
  `STORAGE_S3_SECRET_ACCESS_KEY` y `STORAGE_BUCKET`. Las llaves se crean en
  Supabase > Storage > Settings > S3 Connection. Para desarrollo usa un bucket
  distinto al de producción.
- Notificaciones: `VAPID_*` y, si se habilita Telegram, `TELEGRAM_*`.
- Seguridad: `JWT_SECRET`, `BASIC_AUTH_PASSWORD`, `BFF_SHARED_SECRET`,
  `METRICS_TOKEN` y `AUTH_2FA_ENCRYPTION_KEY`.
- Observabilidad: `SENTRY_ENABLED`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`,
  `SENTRY_RELEASE` y `SENTRY_TRACES_SAMPLE_RATE`.

Redis admite dos configuraciones excluyentes según el entorno:

| Ejecución                                | Variables                                  |
| :--------------------------------------- | :----------------------------------------- |
| API dentro del Compose de desarrollo     | `REDIS_HOST=redis` y `REDIS_PORT=6379`     |
| API local con Redis publicado por Docker | `REDIS_HOST=localhost` y `REDIS_PORT=6379` |
| Producción (Upstash)                     | `REDIS_URL=rediss://default:...@...:6379`  |

En Upstash desactiva **Eviction**: BullMQ requiere `noeviction` para no perder
trabajos (`upstash redis disable-eviction --db-id <DB_ID>`).

En producción, `BFF_SHARED_SECRET`, `METRICS_TOKEN` y
`AUTH_2FA_ENCRYPTION_KEY` deben tener al menos 32 caracteres. Las variables
`BOOTSTRAP_*` son temporales: se usan únicamente al crear la primera institución
y deben retirarse del entorno después de aplicar la migración correspondiente.

Genera `BFF_SHARED_SECRET` y `METRICS_TOKEN` con un alfabeto seguro para
archivos `.env` (por ejemplo, `openssl rand -hex 32`). Evita valores con `$`
sin escapar, porque Docker Compose y Next.js pueden interpretarlos como
expansión de variables.

Genera el par VAPID una sola vez con
`./node_modules/.bin/web-push generate-vapid-keys --json`. Conserva la clave
privada únicamente en el gestor de secretos de cada entorno y publica solo
`VAPID_PUBLIC_KEY` a través del endpoint autenticado de notificaciones.

Las notificaciones académicas se encolan en `notifications` con cinco intentos
y backoff exponencial. Cada entrega queda registrada por evento y canal en
`notification_deliveries`; un reintento omite los canales ya enviados o
deshabilitados. Los trabajos completados se conservan siete días y los fallidos
treinta días. `/api/metrics` expone contadores de trabajos encolados, duplicados,
reintentos, agotados y resultados por canal.

### Sentry

La API reporta excepciones internas no controladas y trabajos de BullMQ que
agotaron sus reintentos. Los errores HTTP esperados (4xx) no se reportan. La
carga de la solicitud, cabeceras de autenticación, cookies, secretos, tokens,
OTP y datos de documento se eliminan antes del envío.

En desarrollo Sentry permanece apagado por defecto. Para producción configura
las variables en el gestor de secretos del proveedor, nunca en Git:

```dotenv
SENTRY_ENABLED=true
SENTRY_DSN=https://public-key@o0.ingest.sentry.io/0
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=aura-grade@1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.05
```

Comienza con un muestreo de trazas de `0.05` (5 %) y ajústalo según el volumen.
`SENTRY_RELEASE` debe coincidir con la versión o SHA desplegada para agrupar los
errores correctamente. `SENTRY_ENABLED=false` desactiva el envío incluso si hay
un DSN configurado; durante las pruebas también se desactiva automáticamente.

Sentry Logs está habilitado y recopila las llamadas de consola de nivel `log`,
`warn` y `error`. Antes del envío se filtran credenciales, tokens, cookies,
contraseñas, códigos OTP y otros atributos sensibles.

La imagen publicada por CI usa `aura-grade@<git-sha>` como release, inyecta los
identificadores de depuración, sube los source maps a Sentry y luego elimina los
`.map` de la imagen pública. Configura en GitHub antes del siguiente despliegue:

- Secret de Actions: `SENTRY_AUTH_TOKEN`, con permisos de proyecto y releases.
- Variables de Actions: `SENTRY_ORG` y `SENTRY_PROJECT`, usando sus respectivos
  slugs de Sentry.

El token se monta como secreto de BuildKit y no queda guardado en las capas de
Docker. El pipeline detiene el despliegue si falta alguno de estos tres valores,
evitando publicar una release sin mapas. El `SENTRY_RELEASE` de ejecución queda
incorporado en la imagen y coincide con los artefactos subidos.

El centro interno persiste una sola entrada por usuario y evento en
`in_app_notifications`. `GET /api/notifications` devuelve el historial paginado
y el contador de no leídas; `PATCH /api/notifications/:id/read` y
`PATCH /api/notifications/read-all` actualizan únicamente registros del usuario
autenticado. Las preferencias de entregas y calificaciones también controlan
la creación de estas entradas.

Los recordatorios de tareas ejecutan un escaneo durable cada 30 minutos. Para
cada tarea activa que venza dentro de 48 o 24 horas se encola, como máximo, un
aviso por estudiante matriculado que todavía no haya entregado. Antes de enviar
se vuelven a comprobar la fecha límite, el estado de la tarea, la matrícula, la
ausencia de entrega y la preferencia `remindersEnabled`. El docente propietario
también puede consultar destinatarios con
`GET /api/notifications/assignments/:assignmentId/reminder-preview` y encolar un
recordatorio manual con `POST /api/notifications/assignments/:assignmentId/reminders`;
el envío manual aplica un enfriamiento real de seis horas por estudiante y tarea.

### 3. Iniciar Servicios (Docker)

La imagen local de PostgreSQL (`docker/postgres/Dockerfile`) compila pgvector
0.8.7 y pg_cron 1.6.4, la misma versión de pg_cron que usa Supabase. Compose la
inicia con `shared_preload_libraries=pg_cron` y `cron.database_name=${DB_NAME}`,
de modo que las migraciones y los jobs programados se comportan igual en local y
en producción.

Para ejecutar API, PostgreSQL y Redis dentro de Docker:

```bash
docker compose --env-file .env -f docker-compose.yaml up -d --build
```

Antes de desplegar la composición de producción, valida que todas las variables
puedan resolverse:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### 4. Ejecutar la aplicación fuera de Docker

Si prefieres ejecutar NestJS en el host, inicia únicamente la infraestructura y
apunta la API al puerto publicado de Redis:

```bash
docker compose --env-file .env -f docker-compose.yaml up -d db redis
REDIS_HOST=localhost pnpm run start:dev
```

### 5. Gestión de Base de Datos (Migraciones)

AuraGrade utiliza **TypeORM Migrations** para gestionar el esquema de la base de datos de forma segura y versionada.

#### Mantenimiento de Entidades (Desarrollo)

Cada vez que realices un cambio en un archivo `.entity.ts`, sigue este flujo:

1. **Modifica la entidad**, pero no habilites `synchronize`; debe permanecer en
   `false`.
2. **Genera una migración con un nombre descriptivo**:

   ```bash
   pnpm run migration:generate -- src/migrations/AddNombreDelCambio
   ```

3. **Revisa el archivo generado** antes de ejecutarlo. Comprueba especialmente:
   operaciones destructivas, columnas `NOT NULL` sobre tablas con datos,
   conversiones de tipos, índices, claves foráneas y el método `down`.
4. **Consulta el estado local**:

   ```bash
   pnpm run migration:show
   ```

5. **Aplica las migraciones pendientes localmente**:

   ```bash
   pnpm run migration:run
   ```

6. **Verifica que sea idempotente**. La segunda ejecución no debe aplicar nada:

   ```bash
   pnpm run migration:run
   pnpm run migration:show
   ```

7. **Ejecuta las comprobaciones antes de publicar**:

   ```bash
   pnpm test --runInBand
   pnpm run build
   ```

8. Incluye en el mismo commit la entidad, la migración, sus pruebas y cualquier
   variable/documentación asociada.

`migration:revert` se reserva para desarrollo y revierte solo la última
migración aplicada. En producción se corrige con una nueva migración; no se
revierte manualmente una base sin una estrategia de recuperación y respaldo.

#### Despliegue (Producción)

La imagen de producción **no ejecuta migraciones automáticamente**. El
contenedor inicia la API directamente con `node dist/main`; las migraciones se
revisan en el PR y se aplican como un paso operativo explícito.

Cada PR que cambie el esquema debe incluir:

1. La entidad modificada y su migración TypeORM.
2. Evidencia de ejecución sobre una base de prueba y de una segunda ejecución
   idempotente.
3. Evaluación de bloqueo, pérdida de datos y compatibilidad con la versión
   actualmente desplegada.
4. Plan de respaldo, aplicación y recuperación para producción.

Después de aprobar y fusionar el PR, el responsable ejecuta manualmente el
workflow de GitHub Actions **Production Database Migrations** desde `main`.
Este flujo no requiere Shell ni SSH en Render y nunca se dispara con un `push`
o un despliegue.

Configura estos secretos en **GitHub > Settings > Secrets and variables >
Actions**:

| Secreto                               | Valor (Supabase, rol administrador)                    |
| :------------------------------------ | :----------------------------------------------------- |
| `PRODUCTION_DB_HOST`                  | `aws-1-us-east-1.pooler.supabase.com` (Session pooler) |
| `PRODUCTION_DB_PORT`                  | `5432`                                                 |
| `PRODUCTION_DB_NAME`                  | `postgres`                                             |
| `PRODUCTION_DB_USERNAME`              | `postgres.<project-ref>`                               |
| `PRODUCTION_DB_PASSWORD`              | Contraseña del administrador de la base                |
| `PRODUCTION_DB_SSL_MODE`              | `require`                                              |
| `PRODUCTION_DB_CONNECTION_TIMEOUT_MS` | `10000`                                                |

Las migraciones crean tablas, funciones y jobs de `pg_cron`, por eso usan el rol
administrador y **no** `aura_grade_app`. No uses la conexión directa
`db.<ref>.supabase.co`: en el plan gratuito solo funciona por IPv6.

Para ejecutar:

1. Abre **GitHub > Actions > Production Database Migrations**.
2. Selecciona **Run workflow**, conserva la rama `main` y escribe
   `MIGRATE_PRODUCTION`.
3. Revisa el estado mostrado antes y después de la ejecución.
4. Despliega la aplicación solo cuando el workflow termine correctamente.

La configuración de la CLI valida únicamente las variables de PostgreSQL. No
copies al workflow secretos de JWT, correo, Redis, IA, almacenamiento ni del BFF.

Como alternativa local, un responsable con acceso al endpoint externo puede
compilar y ejecutar:

```bash
pnpm install --frozen-lockfile
pnpm run build
STATE=prod pnpm run migration:show:prod
STATE=prod pnpm run migration:run:prod
STATE=prod pnpm run migration:show:prod
```

Solo después de confirmar que no quedan migraciones pendientes se despliega o
reinicia la aplicación. Antes de una migración destructiva, crea y comprueba un
respaldo. En producción no uses `migration:revert`; corrige mediante una nueva
migración revisada.

- Usa `DB_SSL_MODE=disable` con el PostgreSQL incluido en Compose.
- Usa `DB_SSL_MODE=require` con Supabase.
- Dentro de Compose, la API conecta a `db:5432`; `DB_PORT` solo cambia el puerto
  publicado en el host para desarrollo.

| Comando                        | Descripción                                       | Entorno     |
| :----------------------------- | :------------------------------------------------ | :---------- |
| `pnpm run migration:generate`  | Genera una migración `.ts` desde las entidades.   | Local       |
| `pnpm run migration:show`      | Lista migraciones locales aplicadas y pendientes. | Local       |
| `pnpm run migration:run`       | Aplica las migraciones `.ts` pendientes.          | Local       |
| `pnpm run migration:revert`    | Revierte la última migración local.               | Local       |
| `pnpm run migration:show:prod` | Lista el estado del artefacto compilado.          | Prod/manual |
| `pnpm run migration:run:prod`  | Aplica manualmente las migraciones compiladas.    | Prod/manual |

### Rol de la aplicación en Supabase

`scripts/provision-app-role.cjs` crea o actualiza el rol `aura_grade_app`
(sin superusuario, sin crear tablas ni roles, máximo 20 conexiones), le otorga
`SELECT/INSERT/UPDATE/DELETE` sobre `public` y permisos por defecto para tablas
futuras, habilita `vector` y retira todo acceso de `anon`, `authenticated` y
`service_role`. Es idempotente: ejecútalo con la conexión administradora antes
de la primera migración y después de migraciones que creen tablas.

```bash
ADMIN_DATABASE_URL=... APP_DB_PASSWORD=... node scripts/provision-app-role.cjs
```

En Render la API usa `DB_USERNAME=aura_grade_app.<project-ref>` y el host del
Session pooler. Las credenciales administradoras se guardan solo localmente
(archivo ignorado por Git) y en los secretos de GitHub.

### 🧹 Retención de datos

La migración `ScheduleRecordRetention` crea `public.purge_expired_records()` y
la programa con `pg_cron` todos los días a las 08:30 GMT (03:30 en Bogotá):

| Tabla                     | Se elimina                                                                   |
| :------------------------ | :--------------------------------------------------------------------------- |
| `audit_logs`              | Registros con más de 30 días                                                 |
| `outbox_events`           | Eventos despachados hace más de 30 días, salvo calificaciones aún pendientes |
| `notification_deliveries` | Más de 90 días y sin evento de outbox asociado                               |
| `in_app_notifications`    | Leídas hace más de 90 días o con más de 180 días                             |
| `telegram_link_tokens`    | Usados o vencidos hace más de un día                                         |

Los plazos superan la retención de trabajos de BullMQ para no romper la
idempotencia. La migración falla si `pg_cron` no está precargado; solo el CI
la ejecuta con `ALLOW_MISSING_PG_CRON=true`. Para cambiar un plazo, crea una
migración nueva con `CREATE OR REPLACE FUNCTION`.

### Bootstrap institucional y aprobación de cuentas

La migración `AddInstitutionTenancyAndApproval` crea la primera institución,
asigna a ella los usuarios existentes y garantiza un administrador aprobado. En
una base vacía, sus variables `BOOTSTRAP_*` son obligatorias. La contraseña se
almacena con bcrypt y nunca debe quedar escrita en el repositorio.

1. Define las nueve variables `BOOTSTRAP_*` anteriores como secretos de GitHub
   Actions.
2. Ejecuta manualmente `Production Database Migrations` desde `main`.
3. Verifica el ingreso del administrador y cambia inmediatamente su contraseña.
4. Elimina `BOOTSTRAP_ADMIN_PASSWORD` y las demás variables `BOOTSTRAP_*` de
   GitHub una vez aplicada la migración. Las siguientes migraciones ya no las
   necesitarán.

El registro público solo acepta `Estudiante` o `Docente`. Ambos se crean con
estado `PENDING`, no reciben sesión y deben ser aprobados o rechazados por un
administrador de la misma institución mediante
`pendingInstitutionUsers`/`reviewInstitutionUser`. Los administradores no
pueden crearse desde el endpoint público.

## 🌱 Seeding (Datos de Prueba)

El seed destructivo no está expuesto mediante REST ni GraphQL. Para reconstruir
una base de datos exclusivamente local, confirma que `STATE=dev`, aplica antes
las migraciones y ejecuta:

```bash
pnpm run migration:run
pnpm run seed:dev
```

El comando se bloquea si `STATE` no es `dev`. Nunca debe ejecutarse contra
staging o producción: dentro de una transacción, vacía todos los datos de la
aplicación vinculados a instituciones, incluidos usuarios, matrículas, cursos,
rúbricas, tareas, entregas, evaluaciones y solicitudes de reevaluación. Si la
carga falla, la transacción se revierte.

Esto creará:

- 3 instituciones activas: Universidad Aura, Instituto Tecnológico del Pacífico
  y Colegio Innovación Andina.
- 15 usuarios: un administrador y un docente por institución; además de
  estudiantes aprobados, uno pendiente y uno rechazado para probar aprobación
  institucional.
- 3 cursos, 7 matrículas, 3 rúbricas y 6 tareas de ejemplo.

Todos los usuarios de prueba usan la contraseña `Password123!`.

## 🔐 Probar autenticación con Postman

Cuando `BFF_SHARED_SECRET` está configurado, el backend solo acepta solicitudes
del BFF. En Postman crea una variable de entorno `aura_bff_secret` con el mismo
valor de `BFF_SHARED_SECRET` del archivo `.env` y agrega este header a todas las
solicitudes de la API:

```text
X-BFF-Secret: {{aura_bff_secret}}
```

Sin ese header, `POST /api/auth/login` y `POST /api/auth/register` responden
`403 El acceso directo al backend no está permitido.` No copies el secreto a
colecciones compartidas. Tras ejecutar el seed puedes probar el inicio de
sesión con `admin@aura.edu.co` y la contraseña `Password123!`.

La recuperación se solicita mediante `POST /api/auth/forgot-password` con el
mismo header y este cuerpo:

```json
{ "email": "admin@aura.edu.co" }
```

## 🧪 Testing

### Ejecutar Tests

Las pruebas unitarias cargan valores ficticios desde `jest.env.js` antes de
importar la aplicación. No necesitan `.env` ni secretos de producción en
GitHub Actions; una variable definida explícitamente por el runner conserva su
valor.

```bash
# Tests unitarios
pnpm test

# Tests en modo watch
pnpm test:watch

# Tests con cobertura
pnpm test:cov

# Tests E2E
pnpm test:e2e

# Limpiar caché de Jest
pnpm test:clear
```

### Cobertura de Tests

`pnpm test:cov` genera el informe vigente en `coverage/`. Las cifras no se
mantienen manualmente en este documento porque cambian con cada suite añadida.

## 🔄 CI/CD

El proyecto incluye un pipeline automatizado con **GitHub Actions** (`.github/workflows/main.yml`) que realiza:

- **Verificación**: type check, pruebas (incluida integración con Redis), build y
  aplicación de todas las migraciones sobre una base aislada con pgvector.
- **Build & Push**: Construcción de la imagen Docker y subida automática a Docker Hub.
- **Production Database Migrations**: workflow manual para migrar Supabase.
- **Instalación reproducible**: Node 22 y pnpm 11.23.0 con lockfile congelado;
  las instalaciones Docker se ejecutan con `CI=true` para evitar solicitudes de
  confirmación sin TTY.

## 📖 Documentación de API

### Health checks

- `GET /api/health`: liveness sin consultar PostgreSQL ni Redis. Úsalo como
  health check de Render.
- `GET /api/health/providers`: estado de base de datos, Redis, disco y proveedor
  de IA. Requiere sesión de administrador.

### Swagger (REST API)

Una vez el proyecto esté corriendo, accede a:

```
http://localhost:3000/api/auth
```

### GraphQL Playground

Accede a `http://localhost:3000/graphql` para interactuar con la API.

**Ejemplo de Subida de Archivo y Creación de Entrega:**

```graphql
mutation CreateSubmission($file: Upload!, $input: CreateSubmissionInput!) {
  createSubmission(file: $file, createSubmissionInput: $input) {
    id
    status
    fileUrl
  }
}
```

## 🏗️ Estructura del Proyecto

```
src/
├── academic-access/      # Políticas de acceso académico
├── academic-queries/     # Consultas académicas privadas
├── ai/                   # Integración con OpenAI y Gemini
├── assignment/           # Tareas, prórrogas y fechas límite
├── audit/                # Auditoría durable (cola audit)
├── auth/                 # Sesiones, 2FA, guards y decoradores
├── common/               # Filtros, guards, throttler y opciones de colas
├── config/               # Variables de entorno y DataSource
├── course/               # Cursos y matrículas
├── course-assistant/     # Asistente del curso (RAG)
├── course-documents/     # Biblioteca de documentos versionados
├── course-preparation/   # Preparación de material del curso
├── criterion/            # Criterios de evaluación
├── evaluation/           # Calificaciones, feedback y exportación de entrenamiento
├── extractor/            # Extracción de texto (DOCX/PDF)
├── feedback/             # Comentarios de usuarios
├── health/               # Liveness y estado de dependencias
├── institution/          # Instituciones y aprobación de cuentas
├── mail/                 # Correo con Resend
├── migrations/           # Migraciones TypeORM
├── notifications/        # In-app, Web Push, correo y cola de notificaciones
├── observability/        # Sentry y métricas
├── onboarding/           # Primeros pasos
├── operations/           # Operación administrativa (reintentos, colas)
├── outbox/               # Outbox transaccional hacia BullMQ
├── redis/                # Cliente Redis compartido
├── reevaluation/         # Solicitudes de reevaluación
├── rubric/               # Rúbricas versionadas
├── seed/                 # Datos de prueba locales
├── storage/              # Almacenamiento privado (Supabase Storage vía S3)
├── submission/           # Entregas y procesador de calificación
├── telegram/             # Bot y vinculación de Telegram
├── user/                 # Usuarios
└── main.ts               # Entry point
```

## 🛠️ Stack Tecnológico

- **Framework**: **[NestJS](https://nestjs.com/)** - Framework Node.js progresivo
- **Lenguaje**: **[TypeScript](https://www.typescriptlang.org/)** - Lenguaje de programación tipado
- **API**: **[GraphQL](https://graphql.org/)** (Apollo Server)
- **Base de Datos**: **[PostgreSQL 17](https://www.postgresql.org/)** en **[Supabase](https://supabase.com/)** + **[TypeORM](https://typeorm.io/)**, con pgvector y pg_cron
- **Redis**: **[Upstash](https://upstash.com/)** para colas, sesiones y rate limiting
- **AI**: **[OpenAI](https://openai.com/)** gpt-4o | **[Gemini](https://ai.google.dev/)** gemini-3.5-flash y gemini-embedding-001
- **Almacenamiento**: **[Supabase Storage](https://supabase.com/storage)** (API compatible con S3, URLs firmadas)
- **Autenticación**: sesiones opacas en Redis + **[Passport](https://www.passportjs.org/)** + TOTP/OTP
- **Seguridad**: **[Throttler](https://github.com/nestjs/throttler)** (Rate Limit)
- **Despliegue**: **[Render](https://render.com/)** (API) y **[Vercel](https://vercel.com/)** (frontend)
- **Herramientas**: **[Docker](https://www.docker.com/)**, **[GitHub Actions](https://github.com/features/actions)**, **[Mammoth](https://github.com/mwilliamson/mammoth)**, **[pdf-parse](https://www.npmjs.com/package/pdf-parse)**
- **Testing**: **[Jest](https://jestjs.io/)**
- **Mail**: **[Resend](https://resend.com/)**
- **WebSockets**: **[Socket.io](https://socket.io/)**
- **BullMQ**: **[BullMQ](https://docs.bullmq.io/)**

## 👤 Autor

### **Stiwar Asprilla**

Redes Sociales:

- GitHub: [@Stiwar9816](https://github.com/Stiwar9816)
- Docker Hub: [stiwar1098](https://hub.docker.com/u/stiwar1098)
- LinkedIn: [Stiwar Asprilla](https://www.linkedin.com/in/stiwar-asprilla/)

---

<p align="center">Hecho con ❤️ y ☕ para AuraGrade</p>
