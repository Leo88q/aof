import { createHash } from "crypto";

/**
 * Canonical JSON used by both the browser proof signer and the API verifier.
 * Object keys are sorted recursively; undefined object properties are omitted
 * exactly as JSON.stringify would omit them. This module has no Prisma or
 * Express dependency so the wire-format can be regression-tested in isolation.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  return encoded === undefined ? "null" : encoded;
}

/** SHA-256 of the request body with the proof itself removed. */
export function walletProofDigest(body: unknown): string {
  const source = body && typeof body === "object"
    ? { ...(body as Record<string, unknown>) }
    : {};
  delete source.walletProof;
  return createHash("sha256")
    .update(canonicalJson(source), "utf8")
    .digest("hex");
}
