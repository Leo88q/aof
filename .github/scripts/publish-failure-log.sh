#!/usr/bin/env bash
# Publish a captured build log through channels that can be read *without*
# downloading Actions logs.
#
# Why: Actions logs and artifacts are served from
# results-receiver.actions.githubusercontent.com, which is unreachable from some
# sandboxes and proxies. When a build fails there, the failure text is otherwise
# invisible and debugging degenerates into guesswork.
#
# Channels, in order of usefulness:
#   1. A pull request comment holding the log tail (needs `pull-requests: write`).
#      Re-uses a single marked comment per PR so repeated runs do not spam.
#   2. Workflow annotations (`::error::`) - readable via
#      GET /repos/{owner}/{repo}/check-runs/{id}/annotations
#   3. Check-run output text (needs `checks: write`) - readable via
#      GET /repos/{owner}/{repo}/check-runs/{id}
#
# Usage: publish-failure-log.sh <log-file> <job-display-name> [max-annotations]
# Never fails the job: this is a reporting helper.

set -uo pipefail

log_file="${1:-}"
job_name="${2:-unknown job}"
max_annotations="${3:-6}"
# One comment per job: the marker carries a slug of the job name so jobs
# running in parallel do not overwrite each other's log.
job_slug=$(printf '%s' "$job_name" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9]\+/-/g' -e 's/^-//' -e 's/-$//')
marker="<!-- aof-ci-failure-log:${job_slug} -->"
max_annotation_chars=400
tail_bytes=60000

if [ -z "$log_file" ] || [ ! -f "$log_file" ]; then
  echo "publish-failure-log: no captured log at '$log_file' - nothing to publish"
  exit 0
fi

log_size=$(wc -c < "$log_file" | tr -d ' ')
log_lines=$(wc -l < "$log_file" | tr -d ' ')
run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

echo "===== tail of $log_file ($log_lines lines, $log_size bytes) ====="
tail -n 80 "$log_file"
echo "===== end of tail ====="

# Workflow commands need %, CR and LF escaped; keep messages short.
escape_command() {
  printf '%s' "$1" | sed -e 's/%/%25/g' -e 's/\r/%0D/g' | cut -c1-"$max_annotation_chars"
}

annotate() {
  echo "::error title=${job_name}::$(escape_command "$1")"
}

# ---------------------------------------------------------------------------
# 1) Pull request comment with the full tail
# ---------------------------------------------------------------------------
publish_pr_comment() {
  command -v gh >/dev/null 2>&1 || { echo "publish-failure-log: gh not available"; return 1; }
  [ -n "${GH_TOKEN:-}" ] || { echo "publish-failure-log: GH_TOKEN not set"; return 1; }
  [ -n "${GITHUB_REPOSITORY:-}" ] || { echo "publish-failure-log: GITHUB_REPOSITORY not set"; return 1; }

  branch="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-}}"
  [ -n "$branch" ] || { echo "publish-failure-log: cannot determine branch"; return 1; }

  pr_number=$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$branch" --state open \
    --json number --jq '.[0].number // empty' 2>/dev/null | head -1)
  [ -n "$pr_number" ] || { echo "publish-failure-log: no open PR for branch '$branch'"; return 1; }

  tmp_dir=$(mktemp -d)
  {
    echo "$marker"
    echo "### CI failure log: ${job_name}"
    echo
    echo "- run: ${run_url}"
    echo "- log: \`${log_file}\` (${log_lines} lines, ${log_size} bytes, tail below)"
    echo "- updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo
    echo '```text'
    tail -c "$tail_bytes" "$log_file" | sed 's/```/` ` `/g'
    echo '```'
  } > "$tmp_dir/body.md"

  existing=$(gh api "repos/$GITHUB_REPOSITORY/issues/$pr_number/comments" --paginate \
    --jq ".[] | select(.body | contains(\"$marker\")) | .id" 2>/dev/null | head -1)

  if [ -n "$existing" ]; then
    if gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$existing" \
      -F body=@"$tmp_dir/body.md" >/dev/null 2>"$tmp_dir/err"; then
      echo "publish-failure-log: updated comment $existing on PR #$pr_number"
    else
      echo "::warning::could not update PR comment: $(head -c 300 "$tmp_dir/err" | tr '\n' ' ')"
      rm -rf "$tmp_dir"; return 1
    fi
  else
    if gh pr comment "$pr_number" --repo "$GITHUB_REPOSITORY" --body-file "$tmp_dir/body.md" >/dev/null 2>"$tmp_dir/err"; then
      echo "publish-failure-log: commented on PR #$pr_number"
    else
      echo "::warning::could not comment on PR #$pr_number: $(head -c 300 "$tmp_dir/err" | tr '\n' ' ')"
      rm -rf "$tmp_dir"; return 1
    fi
  fi

  rm -rf "$tmp_dir"
  return 0
}

pr_published=0
if publish_pr_comment; then pr_published=1; fi

# ---------------------------------------------------------------------------
# 2) Annotations: recognised diagnostics first, otherwise the raw tail
# ---------------------------------------------------------------------------
# Tier 1: real error lines plus the two lines that follow them (the source
# location and the offending code), which is what actually identifies a failure.
# Warning-only lines are deliberately excluded: a previous run annotated ten
# `-->` locations from warnings and hid the single real error.
error_lines=$(
  grep -A2 -E "^error(\[[A-Za-z0-9_:]+\])?:|^error: |^Error: |^Caused by: |Building IDL failed|panicked at|signal: [0-9]+, SIG|Killed|out of memory|failed to parse (manifest|lock file)" \
    "$log_file" 2>/dev/null \
    | grep -v "^--$" \
    | head -n "$max_annotations"
)

if [ -n "$error_lines" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    annotate "$line"
  done <<< "$error_lines"
else
  # Nothing matched the known shapes - publish the raw tail so the failure is
  # still diagnosable without the Actions log endpoint.
  echo "::warning title=${job_name}::no recognised error line in ${log_size} bytes of output, publishing the raw tail"
  emitted=0
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    case "$line" in *"::"*|*"%"*) ;; esac
    annotate "$line"
    emitted=$((emitted + 1))
    [ "$emitted" -ge "$max_annotations" ] && break
  done < <(tail -n 40 "$log_file")
  if [ "$emitted" -eq 0 ]; then
    annotate "build failed and produced no output at all (${log_size} bytes captured)"
  fi
fi

if [ "$pr_published" -eq 0 ]; then
  annotate "full log tail could not be published to a PR comment; see the job log at ${run_url}"
fi

# ---------------------------------------------------------------------------
# 3) Check-run output text (best effort - requires checks: write)
# ---------------------------------------------------------------------------
if command -v gh >/dev/null 2>&1 && command -v jq >/dev/null 2>&1 \
   && [ -n "${GH_TOKEN:-}" ] && [ -n "${GITHUB_RUN_ID:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  tmp_dir=$(mktemp -d)
  tail -c "$tail_bytes" "$log_file" > "$tmp_dir/log_tail.txt"

  job_id=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/jobs" \
    --paginate --jq ".jobs[] | select(.name == \"$job_name\") | .id" 2>/dev/null | head -1)

  if [ -n "$job_id" ]; then
    jq -n \
      --arg title "Build failure log: $job_name" \
      --arg summary "Tail of the captured build output, published because the Actions log endpoint is not reachable from every environment." \
      --rawfile text "$tmp_dir/log_tail.txt" \
      '{output: {title: $title, summary: $summary, text: $text}}' > "$tmp_dir/payload.json"

    if gh api -X PATCH "repos/$GITHUB_REPOSITORY/check-runs/$job_id" \
      --input "$tmp_dir/payload.json" >/dev/null 2>"$tmp_dir/err"; then
      echo "publish-failure-log: published log tail to check-run $job_id output"
    else
      echo "::notice title=${job_name}::check-run output not updated ($(head -c 200 "$tmp_dir/err" | tr '\n' ' '))"
    fi
  else
    echo "::notice title=${job_name}::could not resolve check-run id for '$job_name'"
  fi

  rm -rf "$tmp_dir"
fi

exit 0
