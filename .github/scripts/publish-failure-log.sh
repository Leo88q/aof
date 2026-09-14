#!/usr/bin/env bash
# Publish a captured build log through channels that can be read *without*
# downloading Actions logs.
#
# Why: the Actions log/artifact endpoints are served from
# results-receiver.actions.githubusercontent.com, which is not reachable from
# every environment (restricted sandboxes, some corporate proxies). When a build
# fails there, the failure text is otherwise invisible and debugging becomes
# guesswork.
#
# Channels used, in order:
#   1. Workflow annotations (`::error::`) - readable via
#      GET /repos/{owner}/{repo}/check-runs/{id}/annotations
#   2. Check-run output text - readable via
#      GET /repos/{owner}/{repo}/check-runs/{id}  (needs `checks: write`)
#
# Usage: publish-failure-log.sh <log-file> <job-display-name> [max-annotations]
# Never fails the job: this is a reporting helper.

set -uo pipefail

log_file="${1:-}"
job_name="${2:-unknown job}"
max_annotations="${3:-10}"

if [ -z "$log_file" ] || [ ! -f "$log_file" ]; then
  echo "publish-failure-log: no captured log at '$log_file' - nothing to publish"
  exit 0
fi

echo "===== tail of $log_file ====="
tail -n 60 "$log_file"
echo "===== end of tail ====="

# Workflow commands need %, CR and LF escaped.
escape_command() {
  printf '%s' "$1" | sed -e 's/%/%25/g' -e 's/\r/%0D/g'
}

# 1) Annotations: keep only lines that carry diagnostic value (rustc errors and
#    their source locations, cargo/anchor CLI errors, panics).
error_lines=$(
  grep -E "^error(\[[A-Za-z0-9_]+\])?:|^error: |^[[:space:]]*--> |^Error: |^Caused by:|panicked at|cannot borrow|not found in|expected|mismatched types|no method named|no field|unresolved import|failed to (run|compile|load|download)|Segmentation fault" \
    "$log_file" 2>/dev/null | head -n "$max_annotations"
)

if [ -n "$error_lines" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "::error title=${job_name}::$(escape_command "$line")"
  done <<< "$error_lines"
else
  echo "::error title=${job_name}::build failed; no recognisable error line captured, see the full job log"
fi

# 2) Check-run output text (best effort - requires checks: write).
if command -v gh >/dev/null 2>&1 && [ -n "${GH_TOKEN:-}" ] && [ -n "${GITHUB_RUN_ID:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  tmp_dir=$(mktemp -d)
  tail -c 60000 "$log_file" > "$tmp_dir/log_tail.txt"

  job_id=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/jobs" \
    --paginate --jq ".jobs[] | select(.name == \"$job_name\") | .id" 2>/dev/null | head -1)

  if [ -n "$job_id" ] && command -v jq >/dev/null 2>&1; then
    jq -n \
      --arg title "Build failure log: $job_name" \
      --arg summary "Tail of the captured build output, published here because the Actions log endpoint is not reachable from every environment." \
      --rawfile text "$tmp_dir/log_tail.txt" \
      '{output: {title: $title, summary: $summary, text: $text}}' > "$tmp_dir/payload.json"

    if gh api -X PATCH "repos/$GITHUB_REPOSITORY/check-runs/$job_id" \
      --input "$tmp_dir/payload.json" >/dev/null 2>&1; then
      echo "publish-failure-log: published log tail to check-run $job_id output"
    else
      echo "publish-failure-log: could not update check-run output (permissions?), annotations still published"
    fi
  else
    echo "publish-failure-log: could not resolve job id for '$job_name'"
  fi

  rm -rf "$tmp_dir"
fi

exit 0
