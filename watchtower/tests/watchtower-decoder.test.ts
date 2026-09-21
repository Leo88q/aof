/** Raw Anchor logs → decoded AOF event → normalized Watchtower event, end to end through the committed IDLs. */
import assert from "node:assert/strict";
import { BorshCoder, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import coreIdl from "../../aof_backend/src/idl/aof_core.json";
import { EventDecoder, validateEvents } from "../src/event-decoder";
import { normalizeChainEvent, hashPlayer } from "../src/event-normalizer";
import { W, M, SALT, CORE } from "./_fixtures";

const coder = new BorshCoder(coreIdl as any);
function encodeEvent(name: string, data: any): string {
  const ev = (coreIdl as any).events.find((e: any) => e.name === name);
  return Buffer.concat([Buffer.from(ev.discriminator), coder.types.encode(name, data)]).toString("base64");
}
const logs = (dataLines: string[]) => [`Program ${CORE} invoke [1]`, ...dataLines.map((d) => `Program data: ${d}`), `Program ${CORE} success`];

const decoder = new EventDecoder([{ programId: CORE, name: "aof_core", idl: coreIdl as any }]);
const decoded = decoder.decode(logs([
  encodeEvent("ResourceIssued", { kind: 26, mint: new PublicKey(M.potato), recipient: new PublicKey(W.bob), gross: new BN("5000000000"), fee: new BN("400000000"), minted_in_epoch: new BN(1), cap_per_epoch: new BN(2), epoch_start_slot: new BN(3), slot: new BN(4) }),
  encodeEvent("ListingSold", { seller: new PublicKey(W.alice), buyer: new PublicKey(W.bob), mint: new PublicKey(M.tool1), price_lamports: new BN(250_000_000) }),
]));
assert.equal(decoded.length, 2);
assert.equal(decoded[0].eventType, "ResourceIssued");
assert.equal((decoded[0].data as any).recipient, W.bob, "decoder yields base58 pubkeys and camelCase keys");
assert.equal((decoded[0].data as any).gross, "5000000000", "u64 as decimal string");

const rows = decoded.map((d) => ({ signature: "5".repeat(87), eventIndex: d.eventIndex, slot: 1n, blockTime: new Date(0), programId: d.programId, eventType: d.eventType, wallet: d.wallet, mint: d.mint, amount: d.amount, success: true, data: d.data }));
const out = rows.flatMap((r) => normalizeChainEvent(r, SALT, { treasury: W.treasury }));
assert.deepEqual(out.map((e) => e.type), ["RewardClaimed", "TokenMinted", "TreasuryDeposited", "PurchaseCompleted", "PaymentSettled", "AssetTransferred"]);
assert.equal(out[0].playerId, hashPlayer(W.bob, SALT));
assert.equal(out[3].amount, "250000000");
assert.deepEqual(validateEvents(out), []);
// Garbage log lines are ignored, not thrown.
assert.equal(decoder.decode(logs(["bm90LWFuLWV2ZW50"])).length, 0);
console.log("watchtower-decoder: IDL wire format → decoded → normalized → schema-valid passed");
