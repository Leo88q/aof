/**
 * Two things Watchtower calls "decoder":
 *  1. raw Solana logs → decoded AOF events: re-exported from the backend's
 *     chain-indexer core (single implementation, single IDL set);
 *  2. schema validation of the normalized output against events/schema.json,
 *     so a normalizer regression can never ship malformed events.
 */
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WatchtowerEvent } from "./event-normalizer";
import { watchtowerRoot } from "./paths";

export { EventDecoder, mintDeltas, touchedPrograms } from "../../aof_backend/src/lib/chainIndexerCore";

const schema = JSON.parse(readFileSync(join(watchtowerRoot(), "events", "schema.json"), "utf8"));
const eventTypes = JSON.parse(readFileSync(join(watchtowerRoot(), "events", "event-types.json"), "utf8")) as { types: { name: string; category: string }[] };
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const known = new Map(eventTypes.types.map((t) => [t.name, t.category]));

export function validateEvents(events: WatchtowerEvent[]): { eventId: string; errors: string[] }[] {
  const bad: { eventId: string; errors: string[] }[] = [];
  for (const e of events) {
    const errors: string[] = [];
    if (!validate(e)) errors.push(...(validate.errors ?? []).map((x) => `${x.instancePath} ${x.message}`));
    const cat = known.get(e.type);
    if (!cat) errors.push(`unknown type ${e.type}`);
    else if (cat !== e.category) errors.push(`category ${e.category} != catalog ${cat}`);
    if (errors.length) bad.push({ eventId: e.eventId, errors });
  }
  return bad;
}
