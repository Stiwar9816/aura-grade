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

- **BullMQ**: Procesamiento asíncrono en segundo plano para tareas pesadas como las evaluaciones con IA.
- **Bull Board**: Panel de control interactivo para monitorizar el estado de los trabajos (jobs) en tiempo real.

### 🔐 Autenticación y Autorización

- ✅ Registro, Login y Recuperación de contraseña (JWT & Emails).
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
- ✅ Templates personalizables

### 📚 Documentación

- ✅ Swagger para API REST
- ✅ GraphQL Playground
- ✅ Documentación de tipos con decoradores

### 🛠️ Utilidades

- **Database Seeding**: Poblado automático de base de datos con usuarios y rúbricas de prueba.
- **GraphQL API**: Schema-first approach con TypeGraphQL.

## 📋 Requisitos Previos

- Node.js >= 22.x (LTS)
- pnpm >= 10.x
- Docker & Docker Compose (para DB y Redis)
- Cuenta en Cloudinary
- Cuenta y API key de Resend
- API Key de OpenAI o Gemini

## 🚀 Instalación y Configuración

### 1. Clonar y dependencias

```bash
git clone <repository-url>
cd aura-grade
pnpm install
```

### 2. Configurar Entorno

Copia el archivo `.env.template` a `.env` y configura tus credenciales:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aura_grade
DB_USERNAME=postgres
DB_PASSWORD=secret

# JWT
JWT_SECRET=super-secret-key

# Mail
MAIL_FROM="Aura Grade <noreply@tu-dominio-verificado.com>"
RESEND_API_KEY=re_tu_api_key
RESEND_CONFIRMATION_TEMPLATE_ID=tmpl_xxxxxxxxx
RESEND_UPDATE_PASSWORD_TEMPLATE_ID=tmpl_xxxxxxxxx
RESEND_RESET_PASSWORD_TEMPLATE_ID=tmpl_xxxxxxxxx

# Cloudinary (Archivos)
CLOUDINARY_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret

# OpenAI (Inteligencia Artificial)
OPENAI_API_KEY=sk-tu-api-key-openai

# Gemini (Inteligencia Artificial)
GEMINI_API_KEY=sk-tu-api-key-gemini

# AI Provider
AI_PROVIDER=gemini|openai

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Sesiones opacas respaldadas por Redis
SESSION_IDLE_SECONDS=1800
SESSION_ABSOLUTE_SECONDS=28800
SESSION_REMEMBER_IDLE_SECONDS=604800
SESSION_REMEMBER_ABSOLUTE_SECONDS=2592000
SESSION_ADMIN_IDLE_SECONDS=900
SESSION_ADMIN_ABSOLUTE_SECONDS=14400
SESSION_REFRESH_INTERVAL_SECONDS=60
SESSION_MAX_PER_USER=5

# Seguridad (Bull Board Monitoring)
BASIC_AUTH_PASSWORD=tu-password-seguro

# Comunicación confiable Next.js BFF -> Backend
BFF_SHARED_SECRET=un-secreto-aleatorio-de-al-menos-32-caracteres
TRUST_PROXY_HOPS=1

# Scraping interno de /api/metrics
METRICS_TOKEN=un-token-aleatorio-de-al-menos-32-caracteres

# Ventana temporal de migración; cambiar a false al retirar JWT
AUTH_ACCEPT_LEGACY_JWT=true

# App
APP_NAME='Aura Grade'
PORT=3000
FRONTEND_URL=http://localhost:3000
```

### 3. Iniciar Servicios (Docker)

```bash
docker-compose up -d
```

### 4. Ejecutar Aplicación

```bash
# Desarrollo
pnpm start:dev
```

### 5. Gestión de Base de Datos (Migraciones)

AuraGrade utiliza **TypeORM Migrations** para gestionar el esquema de la base de datos de forma segura y versionada.

#### Mantenimiento de Entidades (Desarrollo)

Cada vez que realices un cambio en un archivo `.entity.ts`, sigue este flujo:

1. **Generar la migración**:
   ```bash
   pnpm run migration:generate -- src/migrations/NombreDeMiCambio
   ```
2. **Aplicar los cambios localmente**:
   ```bash
   pnpm run migration:run
   ```

#### Despliegue (Producción)

En entornos de producción (Docker), las migraciones se ejecutan **automáticamente** antes de iniciar el servidor:

- El pipeline utiliza `pnpm run migration:run:prod` para aplicar los archivos `.js` compilados.
- Si una migración falla, el servidor no arrancará, previniendo estados inconsistentes.

| Comando                       | Descripción                                       | Entorno     |
| :---------------------------- | :------------------------------------------------ | :---------- |
| `pnpm run migration:generate` | Crea un archivo `.ts` con los cambios detectados. | Local       |
| `pnpm run migration:run`      | Sincroniza la DB local con las migraciones `.ts`. | Local       |
| `pnpm run migration:revert`   | Deshace la última migración aplicada.             | Local       |
| `pnpm run migration:run:prod` | Aplica las migraciones compiladas (`dist/`).      | Prod (Auto) |

## 🌱 Seeding (Datos de Prueba)

Para poblar la base de datos con usuarios, cursos y rúbricas iniciales, ejecuta la siguiente mutación en el Playground de GraphQL:

```graphql
mutation ExecuteSeed {
  executeSeed
}
```

Esto creará:

- Docentes y Estudiantes de prueba.
- Rúbricas (Ensayo Académico, Proyecto Software).
- Tareas de ejemplo.

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

```
Test Suites: 15 total
Tests:       160 total (158 passing, 98.75%)
Coverage:    66.93% statements | 49.38% branches | 49.53% functions | 66.51% lines
```

**Módulos con 100% de cobertura:**

- ✅ Auth Guards
- ✅ JWT Strategy
- ✅ Mail Service
- ✅ Auth Enums
- ✅ Login DTO

## 🔄 CI/CD

El proyecto incluye un pipeline automatizado con **GitHub Actions** (`.github/workflows/main.yml`) que realiza:

- **Build & Push**: Construcción de la imagen Docker y subida automática a Docker Hub.

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
├── notifications/        # Gateway de WebSockets
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
- **Autenticación**: **[JWT](https://jwt.io/)** + **[Passport](https://www.passportjs.org/)**
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
