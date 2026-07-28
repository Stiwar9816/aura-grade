## Resumen

<!-- Describe el cambio y su impacto. -->

## Verificación

- [ ] Ejecuté las pruebas relacionadas.
- [ ] Ejecuté `pnpm run build`.

## Cambios de base de datos

- [ ] Este PR no modifica el esquema de la base de datos.
- [ ] Este PR modifica el esquema e incluye una migración TypeORM.

Si el PR incluye una migración:

- [ ] `synchronize` permanece deshabilitado.
- [ ] Revisé los métodos `up` y `down`, bloqueos y posible pérdida de datos.
- [ ] Probé la migración sobre una base representativa y confirmé una segunda ejecución idempotente.
- [ ] Verifiqué compatibilidad con la versión actualmente desplegada.
- [ ] Documenté respaldo, aplicación manual y recuperación.
- [ ] Después del merge se ejecutará `STATE=prod pnpm run migration:show:prod`.
- [ ] La aplicación manual se realizará con `STATE=prod pnpm run migration:run:prod` antes de desplegar la aplicación.
