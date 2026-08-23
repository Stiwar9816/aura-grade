<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://res.cloudinary.com/dwtf5ftav/image/upload/v1778560040/1_ujpdg5.png" width="500" alt="AuraGrade Logo" /></a>
</p>

# 🚀 AuraGrade - NestJS (Clasificación asistida por IA)

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-E10098?style=for-the-badge&logo=graphql&logoColor=white)](https://graphql.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![Gemini](https://img.shields.io/badge/Gemini-412991?style=for-the-badge&logo=gemini-ai&logoColor=white)](https://gemini.google.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)](https://cloudinary.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Redis](https://img.shields.io/badge/Redis-DC3814?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![CI/CD](https://img.shields.io/badge/CI/CD-412991?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/features/actions)

API avanzada para la gestión y calificación automática de trabajos universitarios. AuraGrade utiliza Inteligencia Artificial para analizar documentos (.docx), comparar el contenido con rúbricas dinámicas y proporcionar feedback detallado en tiempo real.

## ✨ Características

### 🤖 Inteligencia Artificial & Automatización

- **Evaluación Automática**: Análisis de contenido con OpenAI (GPT-4) o Gemini (gemini-2.5-flash) basado en rúbricas personalizadas.
- **Extracción de Texto**: Soporte nativo para lectura de archivos DOCX.
- **Feedback Estructurado**: Generación de puntuaciones por criterio y retroalimentación cualitativa.

### ☁️ Gestión de Archivos

- **Carga Directa**: Upload de archivos a Cloudinary mediante GraphQL Streams.
- **Validación**: Control de tipos MIME y tamaño máximo (15MB).

### 🔔 Tiempo Real

- **WebSocket Gateway**: Notificaciones en vivo sobre el estado de la evaluación (Procesando -> Completado).
- **Salas Privadas**: Canales seguros por usuario para recibir actualizaciones personales.

### 🛡️ Seguridad y Rendimiento

- **Rate Limiting**: Protección global contra abusos mediante `@nestjs/throttler` (100 req/min).
- **Caché con Redis**: Optimización de costos y velocidad en evaluaciones de IA usando `CACHE_MANAGER`.
- **Validación de Entorno**: Esquemas de validación con Joi para asegurar que la App no arranque con variables faltantes.
- **Docker Hardening**: Imagen basada en Alpine (Node 22 LTS), Multi-stage builds y ejecución segura con usuario no-root.

### ⚙️ Procesamiento Asíncrono y Colas

- **BullMQ**: Procesamiento asíncrono y durable para evaluaciones con IA y notificaciones de nuevas entregas y calificaciones publicadas.
- **Bull Board**: Panel de control interactivo para monitorizar el estado de los trabajos (jobs) en tiempo real.
- **Entrega idempotente**: Registro por evento y canal para reintentar solo el correo o push pendiente sin duplicar el canal ya completado.

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
- Docker & Docker Compose (para DB y Redis)
- Cuenta en Cloudinary
- Cuenta y API key de Resend
- API Key de OpenAI o Gemini

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
- Seguridad: `JWT_SECRET`, `BASIC_AUTH_PASSWORD`, `BFF_SHARED_SECRET`,
  `METRICS_TOKEN` y `AUTH_2FA_ENCRYPTION_KEY`.

Redis admite dos configuraciones excluyentes según el entorno:

| Ejecución                                | Variables                                  |
| :--------------------------------------- | :----------------------------------------- |
| API dentro del Compose de desarrollo     | `REDIS_HOST=redis` y `REDIS_PORT=6379`     |
| API local con Redis publicado por Docker | `REDIS_HOST=localhost` y `REDIS_PORT=6379` |
| Producción                               | `REDIS_URL=redis://...` o `rediss://...`   |

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
Este flujo permite operar con un Web Service Free de Render, que no ofrece
Shell ni SSH, y nunca se dispara con un `push` o un despliegue.

Configura estos secretos en **GitHub > Settings > Secrets and variables >
Actions**:

```text
PRODUCTION_DB_HOST
PRODUCTION_DB_NAME
PRODUCTION_DB_USERNAME
PRODUCTION_DB_PASSWORD
```

Usa el hostname **externo** de Render PostgreSQL. El workflow fija el puerto
`5432`, `STATE=prod` y `DB_SSL_MODE=require`. PostgreSQL debe permitir conexiones
externas desde el runner de GitHub; si existe una lista de acceso restrictiva,
la conexión será rechazada.

Para ejecutar:

1. Abre **GitHub > Actions > Production Database Migrations**.
2. Selecciona **Run workflow**, conserva la rama `main` y escribe
   `MIGRATE_PRODUCTION`.
3. Revisa el estado mostrado antes y después de la ejecución.
4. Despliega la aplicación solo cuando el workflow termine correctamente.

La configuración de la CLI valida únicamente las variables de PostgreSQL. No
copies al workflow secretos de JWT, correo, Redis, IA, Cloudinary ni del BFF.

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

- Usa `DB_SSL_MODE=disable` con el PostgreSQL incluido en Compose o con la
  conexión interna de Render.
- Usa `DB_SSL_MODE=require` con un endpoint externo que exija TLS.
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

- **Build & Push**: Construcción de la imagen Docker y subida automática a Docker Hub.
- **Instalación reproducible**: Node 22 y pnpm 11.23.0 con lockfile congelado;
  las instalaciones Docker se ejecutan con `CI=true` para evitar solicitudes de
  confirmación sin TTY.

## 📖 Documentación de API

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
├── ai/                   # Servicio de integración con OpenAI
├── assignment/           # Gestión de tareas académicas
├── auth/                 # Autenticación y Guards
├── cloudinary/           # Servicio de almacenamiento de archivos
├── common/               # Configuración Compartida
├── config/               # Configuración de variables de entorno
├── course/               # Gestión de cursos
├── criterion/            # Criterios de evaluación
├── evaluation/           # Lógica de calificaciones y feedback
├── extractor/            # Extracción de texto (DOCX)
├── mail/                 # Envío de correos electrónicos
├── notifications/        # WebSockets, Web Push y cola durable de notificaciones
├── rubric/               # Gestión de rúbricas dinámicas
├── seed/                 # Poblado de datos iniciales
├── submission/           # Gestión de entregas de estudiantes
├── user/                 # Gestión de usuarios
└── main.ts               # Entry point
```

## 🛠️ Stack Tecnológico

- **Framework**: **[NestJS](https://nestjs.com/)** - Framework Node.js progresivo
- **Lenguaje**: **[TypeScript](https://www.typescriptlang.org/)** - Lenguaje de programación tipado
- **API**: **[GraphQL](https://graphql.org/)** (Apollo Server)
- **Base de Datos**: **[PostgreSQL](https://www.postgresql.org/)** + **[TypeORM](https://typeorm.io/)**
- **Caché**: **[Redis](https://redis.io/)** + **[Cache Manager](https://github.com/node-cache-manager/node-cache-manager)**
- **AI**: **[OpenAI](https://openai.com/)** GPT-4o | **[Gemini](https://gemini.com/)** gemini-2.5-flash
- **Almacenamiento**: **[Cloudinary](https://cloudinary.com/)**
- **Autenticación**: sesiones opacas en Redis + **[Passport](https://www.passportjs.org/)** + TOTP/OTP
- **Seguridad**: **[Throttler](https://github.com/nestjs/throttler)** (Rate Limit)
- **Herramientas**: **[Docker](https://www.docker.com/)**, **[GitHub Actions](https://github.com/features/actions)**, **[Mammoth](https://github.com/mwilliamson/mammoth)**
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
