<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>

# 🚀 AuraGrade - NestJS (Clasificación asistida por IA)

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-E10098?style=for-the-badge&logo=graphql&logoColor=white)](https://graphql.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)](https://cloudinary.com/)

API avanzada para la gestión y calificación automática de trabajos universitarios. AuraGrade utiliza Inteligencia Artificial para analizar documentos (PDF/DOCX), comparar el contenido con rúbricas dinámicas y proporcionar feedback detallado en tiempo real.

## ✨ Características

### 🤖 Inteligencia Artificial & Automatización

- **Evaluación Automática**: Análisis de contenido con OpenAI (GPT-4) o Gemini (gemini-2.5-flash) basado en rúbricas personalizadas.
- **Extracción de Texto**: Soporte nativo para lectura de archivos PDF y DOCX.
- **Feedback Estructurado**: Generación de puntuaciones por criterio y retroalimentación cualitativa.

### ☁️ Gestión de Archivos

- **Carga Directa**: Upload de archivos a Cloudinary mediante GraphQL Streams.
- **Validación**: Control de tipos MIME y tamaño máximo (15MB).

### 🔔 Tiempo Real

- **WebSocket Gateway**: Notificaciones en vivo sobre el estado de la evaluación (Procesando -> Completado).
- **Salas Privadas**: Canales seguros por usuario para recibir actualizaciones personales.

### 🔐 Autenticación y Autorización

- ✅ Registro, Login y Recuperación de contraseña (JWT & Emails).
- ✅ Roles (Administrador, Docente, Estudiante).
- ✅ Guards y Decoradores personalizados.

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

- Node.js >= 18.x
- pnpm (recomendado)
- Docker Desktop (para base de datos local)
- Cuenta en Cloudinary
- Servidor de correo electrónico (SMTP) actual (Mailtrap para testing)
- API Key de OpenAI
- API Key de Gemini

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
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=tu-email@gmail.com
MAIL_PASSWORD=tu-app-password

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

# App
PORT=3000
FRONTEND_URL=http://localhost:4200
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
├── config/               # Configuración de variables de entorno
├── course/               # Gestión de cursos
├── criterion/            # Criterios de evaluación
├── evaluation/           # Lógica de calificaciones y feedback
├── extractor/            # Extracción de texto (PDF/DOCX)
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
- **AI**: **[OpenAI](https://openai.com/)** GPT-4o | **[Gemini](https://gemini.com/)** gemini-2.5-flash
- **Almacenamiento**: **[Cloudinary](https://cloudinary.com/)**
- **Autenticación**: **[JWT](https://jwt.io/)**
- **Mail**: **[Mailtrap](https://www.mailtrap.io/)**
- **WebSockets**: **[Socket.io](https://socket.io/)**
- **Herramientas**: **[Docker](https://www.docker.com/)**, **[Jest](https://jestjs.io/)**, **[pdf-parse](https://github.com/teoremp/pdf-parse)**, **[mammoth](https://github.com/teoremp/mammoth)**
- **Documentación**: **[Swagger](https://swagger.io/)**, **[GraphQL Playground](https://github.com/graphql/graphql-playground)**
- **Testing**: **[Jest](https://jestjs.io/)**

## 👤 Autor

**Stiwar Asprilla**

Redes Sociales:

- GitHub: [@Stiwar9816](https://github.com/Stiwar9816)
- Docker Hub: [stiwar1098](https://hub.docker.com/u/stiwar1098)
- LinkedIn: [Stiwar Asprilla](https://www.linkedin.com/in/stiwar-asprilla/)

---

<p align="center">Hecho con ❤️ y ☕ para AuraGrade</p>
