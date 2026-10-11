/** Temporary on-screen record of the raw wallet or RPC exception.
 * The card replaces unrecognized errors with one sentence, so the next
 * attempt must keep the stage and original message visible. */

function redact(value: string): string {
  return value.replace(/api-key=[^&\s]+/gi, "api-key=REDACTED");
}

export function showTxTrap(stage: string, error: unknown): void {
  if (typeof document === "undefined") return;
  const err = error as { name?: string; message?: string; signature?: string; logs?: unknown; causeMessage?: unknown };
  const logs = Array.isArray(err?.logs) ? err.logs.map((line) => redact(String(line))).slice(0, 20) : [];
  const lines = [
    "AOF_TRAP",
    `stage=${stage}`,
    `name=${redact(String(err?.name ?? typeof error))}`,
    `message=${redact(String(err?.message ?? error)).slice(0, 1200)}`,
  ];
  if (typeof err?.causeMessage === "string" && err.causeMessage && err.causeMessage !== err.message) {
    lines.push(`cause=${redact(err.causeMessage).slice(0, 1200)}`);
  }
  if (typeof err?.signature === "string") lines.push(`signature=${err.signature}`);
  if (logs.length) lines.push(`logs:\n${logs.join("\n")}`);
  let el = document.getElementById("aof-trap");
  if (!el) {
    el = document.createElement("pre");
    el.id = "aof-trap";
    el.setAttribute("style", "position:fixed;left:8px;right:8px;bottom:72px;z-index:99999;max-height:42vh;overflow:auto;background:#140808;color:#ffb4a8;border:1px solid #ff6b5a;padding:12px;font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap");
    document.body.appendChild(el);
  }
  const block = lines.join("\n");
  el.textContent = el.textContent ? `${el.textContent}\n---\n${block}` : block;
}
