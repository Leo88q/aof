/** Audit logs are not a credential store, including nested JSON and query data. */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 16) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key, /secret|private|password|token|authorization|cookie|walletproof|signature|apikey|api_key/i.test(key)
      ? "[REDACTED]" : redactSensitive(item, depth + 1),
  ]));
}
