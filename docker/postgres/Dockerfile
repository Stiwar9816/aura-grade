# Local PostgreSQL matching the managed database (Supabase): pgvector + pg_cron.
ARG POSTGRES_IMAGE=postgres:17-alpine
FROM ${POSTGRES_IMAGE} AS build
ARG PGVECTOR_VERSION=0.8.7
# Same pg_cron version as Supabase, so scheduled jobs behave alike in both environments.
ARG PG_CRON_VERSION=1.6.4
RUN apk add --no-cache build-base curl \
    && curl -fsSL "https://github.com/pgvector/pgvector/archive/refs/tags/v${PGVECTOR_VERSION}.tar.gz" -o /tmp/vector.tar.gz \
    && tar -xzf /tmp/vector.tar.gz -C /tmp \
    && cd "/tmp/pgvector-${PGVECTOR_VERSION}" \
    && make OPTFLAGS="" with_llvm=no \
    && make install with_llvm=no \
    && curl -fsSL "https://github.com/citusdata/pg_cron/archive/refs/tags/v${PG_CRON_VERSION}.tar.gz" -o /tmp/pg_cron.tar.gz \
    && tar -xzf /tmp/pg_cron.tar.gz -C /tmp \
    && cd "/tmp/pg_cron-${PG_CRON_VERSION}" \
    && make with_llvm=no \
    && make install with_llvm=no

FROM ${POSTGRES_IMAGE}
COPY --from=build /usr/local/lib/postgresql/vector.so /usr/local/lib/postgresql/vector.so
COPY --from=build /usr/local/share/postgresql/extension/vector* /usr/local/share/postgresql/extension/
COPY --from=build /usr/local/lib/postgresql/pg_cron.so /usr/local/lib/postgresql/pg_cron.so
COPY --from=build /usr/local/share/postgresql/extension/pg_cron* /usr/local/share/postgresql/extension/
