/** Locate the watchtower/ root from either src/ (ts-node) or dist/watchtower/src/ (compiled). */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

export function watchtowerRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "integration-manifest.json")) && existsSync(join(dir, "events", "schema.json"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("watchtower root (integration-manifest.json + events/) not found above " + __dirname);
}
