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
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io/)

API para clasificación asistida por IA para trabajos universitarios usando NestJS con autenticación completa, recuperación de contraseña, integración de envío de emails, módulos de usuario listos usando GraphQL y PostgreSQL como base de datos. Endpoints de autenticación REST documentados con Swagger.

## ✨ Características

### 🔐 Autenticación y Autorización
- ✅ Registro de usuarios con validación de datos
- ✅ Login con JWT (JSON Web Tokens)
- ✅ Recuperación de contraseña vía email
- ✅ Guards personalizados (JWT, NoAuth)
- ✅ Decoradores personalizados para roles y usuario actual
- ✅ Estrategia JWT con Passport

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

### 🧪 Testing
- ✅ **160 tests unitarios** (98.75% pasando)
- ✅ **66.93% cobertura de código**
- ✅ Tests para servicios, controladores, resolvers, DTOs, guards, strategies
- ✅ 100% cobertura en módulos críticos (Guards, Strategies, Mail Service)

### 📚 Documentación
- ✅ Swagger para API REST
- ✅ GraphQL Playground
- ✅ Documentación de tipos con decoradores

## 📋 Requisitos Previos

- Node.js >= 18.x
- pnpm, npm o yarn
- Docker Desktop
- NestJS CLI (opcional)

## 🚀 Instalación

### 1. Instalar NestJS CLI (Opcional)

```bash
npm install -g @nestjs/cli
```

### 2. Clonar el repositorio

```bash
git clone <repository-url>
cd skeleton-nest
```

### 3. Instalar dependencias

```bash
# Con pnpm (recomendado)
pnpm install

# Con npm
npm install

# Con yarn
yarn install
```

### 4. Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.template .env

# Editar el archivo .env con tus configuraciones
```

**Variables de entorno principales:**
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aura_grade
DB_USERNAME=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=your-secret-key

# Mail
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password

# App
PORT=3000
APP_NAME=Aura Grade
FRONTEND_URL=http://localhost:4200
```

### 5. Levantar la base de datos con Docker

```bash
# Modo detached (en segundo plano)
docker-compose up -d

# Con logs visibles
docker-compose up
```

### 6. Ejecutar el proyecto

```bash
# Modo desarrollo
pnpm start:dev

# Modo producción
pnpm start:prod

# Modo debug
pnpm start:debug
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

## 🐳 Docker

### Desarrollo

```bash
# Levantar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

### Producción

```bash
# Construir imagen
docker-compose -f docker-compose.prod.yml --env-file .env.prod up --build

# Ejecutar imagen
docker-compose -f docker-compose.prod.yml --env-file .env.prod up

# Ejecutar desde Docker Hub
docker run -p 3000:3000 --env-file=.env.prod stiwar1098/skeleton
```

### Gestión de Imágenes Docker

```bash
# Etiquetar imagen
docker tag <nombre-app> <usuario-dockerhub>/<nombre-repositorio>

# Subir a Docker Hub
docker push <usuario-dockerhub>/<nombre-repositorio>
```

## 📖 Documentación de API

### Swagger (REST API)

Una vez el proyecto esté corriendo, accede a:

```
http://localhost:3000/api/auth
```

### GraphQL Playground

```
http://localhost:3000/graphql
```

**Queries y Mutations disponibles:**

**Auth:**
- `register` - Registro de usuario
- `login` - Inicio de sesión

**Users:**
- `users` - Listar usuarios
- `user(id)` - Obtener usuario por ID
- `userByEmail(email)` - Obtener usuario por email
- `updateUser` - Actualizar usuario
- `blockUser` - Bloquear/desbloquear usuario
- `resetPassword` - Resetear contraseña
- `resetPasswordAuth` - Resetear contraseña autenticado

## 🏗️ Estructura del Proyecto

```
skeleton-nest/
├── src/
│   ├── auth/                 # Módulo de autenticación
│   │   ├── decorators/       # Decoradores personalizados
│   │   ├── dto/              # Data Transfer Objects
│   │   ├── enums/            # Enumeraciones
│   │   ├── guards/           # Guards de autenticación
│   │   ├── strategies/       # Estrategias Passport
│   │   └── types/            # Tipos GraphQL
│   ├── mail/                 # Módulo de emails
│   ├── user/                 # Módulo de usuarios
│   │   ├── dto/              # DTOs de usuario
│   │   ├── entities/         # Entidades TypeORM
│   │   └── inputs/           # Inputs GraphQL
│   ├── config/               # Configuraciones
│   ├── app.module.ts         # Módulo principal
│   └── main.ts               # Punto de entrada
├── test/                     # Tests unitarios
│   ├── auth/                 # Tests de autenticación
│   ├── mail/                 # Tests de mail
│   └── user/                 # Tests de usuarios
├── docker-compose.yml        # Docker para desarrollo
├── docker-compose.prod.yml   # Docker para producción
└── jest.config.js            # Configuración de Jest
```

## 🛠️ Stack Tecnológico

### Backend
- **[NestJS](https://nestjs.com/)** - Framework Node.js progresivo
- **[TypeScript](https://www.typescriptlang.org/)** - Superset tipado de JavaScript
- **[TypeORM](https://typeorm.io/)** - ORM para TypeScript y JavaScript

### Base de Datos
- **[PostgreSQL](https://www.postgresql.org/)** - Base de datos relacional

### API
- **[GraphQL](https://graphql.org/)** - Lenguaje de consulta para APIs
- **[Apollo Server](https://www.apollographql.com/)** - Servidor GraphQL
- **[Swagger](https://swagger.io/)** - Documentación API REST

### Autenticación
- **[Passport](http://www.passportjs.org/)** - Middleware de autenticación
- **[JWT](https://jwt.io/)** - JSON Web Tokens
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** - Hashing de contraseñas

### Email
- **[@nestjs-modules/mailer](https://github.com/nest-modules/mailer)** - Módulo de emails para NestJS
- **[Handlebars](https://handlebarsjs.com/)** - Motor de templates

### Testing
- **[Jest](https://jestjs.io/)** - Framework de testing
- **[Supertest](https://github.com/visionmedia/supertest)** - Testing HTTP

### DevOps
- **[Docker](https://www.docker.com/)** - Containerización
- **[Docker Compose](https://docs.docker.com/compose/)** - Orquestación de contenedores

## 📝 Scripts Disponibles

```bash
# Desarrollo
pnpm start:dev          # Inicia en modo desarrollo con hot-reload
pnpm start:debug        # Inicia en modo debug

# Producción
pnpm build              # Compila el proyecto
pnpm start:prod         # Inicia en modo producción

# Testing
pnpm test               # Ejecuta tests unitarios
pnpm test:watch         # Tests en modo watch
pnpm test:cov           # Tests con cobertura
pnpm test:e2e           # Tests end-to-end
pnpm test:clear         # Limpia caché de Jest

# Linting
pnpm lint               # Ejecuta ESLint
pnpm format             # Formatea código con Prettier
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 👤 Autor

**Stiwar Asprilla**

- GitHub: [@Stiwar9816](https://github.com/Stiwar9816)
- Docker Hub: [stiwar1098](https://hub.docker.com/u/stiwar1098)
- LinkedIn: [Stiwar Asprilla](https://www.linkedin.com/in/stiwar-asprilla/)

## 🙏 Agradecimientos

- [NestJS](https://nestjs.com/) por el increíble framework
- Comunidad de código abierto por las herramientas y librerías utilizadas
