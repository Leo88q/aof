#!/usr/bin/env bash
# Consistent backup of the AOF backend database (SQLite baseline) + restore drill.
#
#   scripts/backup-db.sh backup  [db_path] [backup_dir]
#   scripts/backup-db.sh restore <backup_file> <target_db_path>
#   scripts/backup-db.sh drill   [db_path]            # backup -> restore to tmp -> integrity + migrate status
#
# Uses sqlite3 .backup (online, consistent; NOT `cp`, which can copy a torn file
# while the API is writing). Compose: the DB lives in the aof_data volume at
# /app/data/aof.db; run this from the host with the volume mounted or via
#   docker compose exec backend sh -c 'sqlite3 /app/data/aof.db ".backup /tmp/aof.db"'
#
# Retention: keeps BACKUP_KEEP (default 30) newest files. Cron example (daily 03:15):
#   15 3 * * * cd /srv/aof && scripts/backup-db.sh backup /srv/aof/data/aof.db /srv/aof/backups >> /var/log/aof-backup.log 2>&1
#
# When the project moves to PostgreSQL replace the sqlite3 calls with
# pg_dump -Fc / pg_restore; keep the drill step.

set -euo pipefail
cmd="${1:-}"; shift || true
KEEP="${BACKUP_KEEP:-30}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1" >&2; exit 2; }; }
need sqlite3

backup() {
  local db="${1:-aof_backend/../data/aof.db}" dir="${2:-backups}"
  [[ -f "$db" ]] || { echo "db not found: $db" >&2; exit 2; }
  mkdir -p "$dir"
  local out="$dir/aof-$(date -u +%Y%m%dT%H%M%SZ).db"
  sqlite3 "$db" ".backup '$out'"
  sqlite3 "$out" "PRAGMA integrity_check;" | grep -qx ok || { echo "integrity check failed on $out" >&2; rm -f "$out"; exit 1; }
  gzip -f "$out"
  sha256sum "$out.gz" > "$out.gz.sha256"
  echo "backup written: $out.gz ($(stat -c %s "$out.gz") bytes)"
  # retention
  ls -1t "$dir"/aof-*.db.gz 2>/dev/null | tail -n +"$((KEEP+1))" | while read -r old; do rm -f "$old" "$old.sha256"; echo "pruned $old"; done
}

restore() {
  local file="${1:?backup file}" target="${2:?target db path}"
  [[ -f "$file" ]] || { echo "backup not found: $file" >&2; exit 2; }
  if [[ -f "$file.sha256" ]]; then sha256sum -c "$file.sha256" >/dev/null || { echo "checksum mismatch: $file" >&2; exit 1; }; fi
  [[ -e "$target" ]] && { echo "refusing to overwrite existing $target (move it away first)" >&2; exit 1; }
  gunzip -c "$file" > "$target"
  sqlite3 "$target" "PRAGMA integrity_check;" | grep -qx ok || { echo "restored file failed integrity check" >&2; exit 1; }
  echo "restored $file -> $target"
}

drill() {
  local db="${1:-aof_backend/../data/aof.db}"
  local tmp; tmp="$(mktemp -d)"
  backup "$db" "$tmp/b"
  local latest; latest="$(ls -1t "$tmp"/b/aof-*.db.gz | head -1)"
  restore "$latest" "$tmp/restored.db"
  # Schema must be at the same migration level as the code expects.
  if [[ -d aof_backend/prisma ]]; then
    ( cd aof_backend && DATABASE_URL="file:$tmp/restored.db?connection_limit=1" npx prisma migrate status --schema prisma/schema.prisma ) \
      || { echo "prisma migrate status reported drift on the restored copy" >&2; rm -rf "$tmp"; exit 1; }
  fi
  local src_tables dst_tables
  src_tables=$(sqlite3 "$db" "SELECT count(*) FROM sqlite_master WHERE type='table';")
  dst_tables=$(sqlite3 "$tmp/restored.db" "SELECT count(*) FROM sqlite_master WHERE type='table';")
  [[ "$src_tables" == "$dst_tables" ]] || { echo "table count differs: $src_tables vs $dst_tables" >&2; rm -rf "$tmp"; exit 1; }
  rm -rf "$tmp"
  echo "restore drill passed ($src_tables tables, migrations in sync)"
}

case "$cmd" in
  backup) backup "$@" ;;
  restore) restore "$@" ;;
  drill) drill "$@" ;;
  *) sed -n '2,20p' "$0"; exit 2 ;;
esac
