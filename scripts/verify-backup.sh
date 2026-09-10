#!/usr/bin/env bash
# Only the disposable security verification container is addressed here.
set -euo pipefail
umask 077
backup_file="$(mktemp /private/tmp/aura-security-backup.XXXXXX)"
restore_db="aura_restore_$(date +%s)"
trap 'rm -f "$backup_file"' EXIT
docker exec aura-security-postgres pg_dump -U postgres -Fc aura_security_check > "$backup_file"
docker exec aura-security-postgres createdb -U postgres "$restore_db"
docker exec -i aura-security-postgres pg_restore -U postgres --exit-on-error --no-owner -d "$restore_db" < "$backup_file"
restored_users="$(docker exec aura-security-postgres psql -U postgres -d "$restore_db" -Atc 'SELECT count(*) FROM users')"
restored_tables="$(docker exec aura-security-postgres psql -U postgres -d "$restore_db" -Atc \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('outbox_events','submissions','migrations')\")"
test "$restored_users" -gt 0
test "$restored_tables" = 3
docker exec aura-security-postgres dropdb -U postgres "$restore_db"
echo "Disposable PostgreSQL backup restored successfully; users, migrations, submissions and outbox verified."
