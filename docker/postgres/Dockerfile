ARG POSTGRES_IMAGE=postgres:17-alpine
FROM ${POSTGRES_IMAGE} AS build
ARG PGVECTOR_VERSION=0.8.7
RUN apk add --no-cache build-base curl \
    && curl -fsSL "https://github.com/pgvector/pgvector/archive/refs/tags/v${PGVECTOR_VERSION}.tar.gz" -o /tmp/vector.tar.gz \
    && tar -xzf /tmp/vector.tar.gz -C /tmp \
    && cd "/tmp/pgvector-${PGVECTOR_VERSION}" \
    && make OPTFLAGS="" with_llvm=no \
    && make install with_llvm=no

FROM ${POSTGRES_IMAGE}
COPY --from=build /usr/local/lib/postgresql/vector.so /usr/local/lib/postgresql/vector.so
COPY --from=build /usr/local/share/postgresql/extension/vector* /usr/local/share/postgresql/extension/
