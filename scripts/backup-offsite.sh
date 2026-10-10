#!/usr/bin/env bash
# Upload one backup artifact. No-op when BACKUP_S3_URI is unset.
# Fail closed when the URI is set but neither aws nor rclone is on PATH:
# a silent local-only copy would look like an offsite backup.
#
#   BACKUP_S3_URI=s3://bucket/aof/mainnet scripts/backup-offsite.sh backups/aof-….db.gz
#   # R2 with the aws CLI: also set AWS_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com
#   # rclone: BACKUP_S3_URI=r2:bucket/aof/mainnet
#
# Credentials stay in the tool's own config, not in the URI. Remote retention
# is a bucket lifecycle rule; this script does not delete old objects.
set -euo pipefail

file="${1:?backup file}"
uri="${BACKUP_S3_URI:-}"
[[ -n "$uri" ]] || exit 0
[[ -f "$file" ]] || { echo "backup not found: $file" >&2; exit 1; }

copy() {
  local src="$1" dest="$2"
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "$src" "$dest"
  elif command -v rclone >/dev/null 2>&1; then
    rclone copyto "$src" "$dest"
  else
    echo "BACKUP_S3_URI is set but neither aws nor rclone is installed; local copy kept, offsite copy missing" >&2
    exit 1
  fi
}

base="$(basename "$file")"
dest="${uri%/}/$base"
copy "$file" "$dest"
if [[ -f "$file.sha256" ]]; then
  copy "$file.sha256" "$dest.sha256"
fi
echo "offsite copy requested for $base"
