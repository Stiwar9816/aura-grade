# Course RAG Implementation Plan

> Execute inline using executing-plans and test-driven-development; final independent review.

**Goal:** Consultar fuentes oficiales y datos personales autorizados desde el curso.
**Architecture:** Servicio aislado, pgvector, cuotas Redis, adaptador Gemini, BFF y panel React.
**Spec:** docs/superpowers/specs/2026-10-28-course-rag.md

## Global constraints
Dev en ambos repositorios. Fuentes publicadas exclusivamente. No activar actividades ni corregir fechas omitidas. No Telegram ni despliegue. Modelo/dimensiones/segmentación fijos para compatibilidad.

## Task 1: Backend
- [x] Escribir y ejecutar pruebas de segmentación, vectores/citas, autorización previa, cuotas, retiro concurrente e idempotencia.
- [x] Migración índices/fragmentos y retiro transaccional; repositorio SQL acotado; Gemini y cuotas; servicio, DTO y controlador.
- [x] Esperado: pruebas específicas verdes, TypeScript y suite completa.

## Task 2: Sitio
- [x] Pruebas BFF de validación/sesión/CSRF y estados UI.
- [x] Proxy y panel por curso: preparación docente, consulta con fuentes, próximas entregas/resultados privados.
- [x] Esperado: pruebas, types, build y comprobación visual.

## Task 3: Verificación
- [x] Backup y migración local; integración PostgreSQL/Redis de aislamiento, invalidación, denegaciones y cuota concurrente.
- [x] Preparar guía/cronograma y consulta Gemini acotada sin publicar actividades.
- [x] Revisión independiente, corregir hallazgos, documentar evidencias y preparar commits.

Evidencias y límites: docs/verification/2026-10-29-course-rag.md. Revisión independiente y correcciones concluidas; commits preparados al cierre.
