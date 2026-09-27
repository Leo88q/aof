/**
 * [SECURITY_CHECKLIST #27] Compute units that aof-core instructions actually
 * consume, measured on the local validator.
 *
 * Runs after tests/aof_core.ts and tests/aof_extended.ts and reads this
 * validator's transaction history, so the other suites need no changes. The
 * consumption of every top-level aof-core invocation is attributed to its
 * instruction through Anchor's "Instruction: X" log line. The test fails when
 * an instruction comes close to the 200 000 CU a transaction gets per
 * instruction without a ComputeBudget instruction: past that point the
 * clients that build it must set a compute budget explicitly.
 *
 * The table is written to target/cu-report.md; CI publishes it as the
 * check-run output of the "Anchor test (local validator)" job.
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, type ConfirmedSignatureInfo } from "@solana/web3.js";
import { expect } from "chai";
import fs from "fs";
import path from "path";

/** Compute limit per instruction of a transaction without a ComputeBudget instruction. */
const DEFAULT_INSTRUCTION_LIMIT = 200_000;
/** 75% of it: an instruction above this needs an explicit compute budget in every client. */
const HEADROOM_LIMIT = 150_000;

/** [instruction name, consumed CU] for every top-level invocation of `programId`. */
export function topLevelUsage(logs: string[], programId: string): Array<[string, number]> {
  const usage: Array<[string, number]> = [];
  const stack: string[] = [];
  let current: string | null = null;
  for (const line of logs) {
    const invoke = /^Program (\S+) invoke \[(\d+)\]$/.exec(line);
    if (invoke) {
      stack.push(invoke[1]);
      if (stack.length === 1 && invoke[1] === programId) current = "(unnamed)";
      continue;
    }
    const name = /^Program log: Instruction: (\w+)$/.exec(line);
    if (name && stack.length === 1 && stack[0] === programId && current === "(unnamed)") {
      current = name[1];
      continue;
    }
    const consumed = /^Program (\S+) consumed (\d+) of (\d+) compute units$/.exec(line);
    if (consumed && stack.length === 1 && consumed[1] === programId && current) {
      usage.push([current, Number(consumed[2])]);
      continue;
    }
    if (/^Program \S+ (success|failed: .*)$/.test(line)) {
      const done = stack.pop();
      if (stack.length === 0 && done === programId) current = null;
    }
  }
  return usage;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

describe("aof-core: compute units per instruction (SECURITY_CHECKLIST #27)", () => {
  const provider = anchor.AnchorProvider.env();
  const idl = JSON.parse(fs.readFileSync(process.cwd() + "/target/idl/aof_core.json", "utf8"));
  const programId = new PublicKey(idl.address ?? "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq");

  it("every instruction the suites exercised stays well inside the default compute limit", async () => {
    const connection = provider.connection;
    const signatures: ConfirmedSignatureInfo[] = [];
    for (let before: string | undefined; ;) {
      const page = await connection.getSignaturesForAddress(programId, { before, limit: 1000 }, "confirmed");
      signatures.push(...page);
      if (page.length < 1000) break;
      before = page[page.length - 1].signature;
    }
    // Failed transactions stop early, so their consumption says nothing about the instruction.
    const succeeded = signatures.filter((s) => !s.err).map((s) => s.signature);
    const usage = new Map<string, number[]>();
    let transactions = 0;
    let unattributed = 0;
    for (let i = 0; i < succeeded.length; i += 25) {
      const batch = await Promise.all(succeeded.slice(i, i + 25).map((signature) =>
        connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 })));
      for (const tx of batch) {
        const logs = tx?.meta?.logMessages;
        if (!logs) continue;
        transactions += 1;
        const calls = topLevelUsage(logs, programId.toBase58());
        if (!calls.length) unattributed += 1; // e.g. truncated logs
        for (const [name, units] of calls) {
          if (!usage.has(name)) usage.set(name, []);
          usage.get(name)!.push(units);
        }
      }
    }

    const rows = [...usage.entries()]
      .map(([name, values]) => ({ name, calls: values.length, max: Math.max(...values), median: median(values) }))
      .sort((a, b) => b.max - a.max);
    const idlInstructions = (idl.instructions as any[]).length;
    const table = [
      `# aof-core: compute units on the local validator`,
      ``,
      `${rows.length} of ${idlInstructions} IDL instructions exercised by tests/aof_core.ts and tests/aof_extended.ts, ` +
        `${transactions} successful transactions (${unattributed} without attributable logs). ` +
        `Limit without a ComputeBudget instruction: ${DEFAULT_INSTRUCTION_LIMIT.toLocaleString("en-US")} CU per instruction; ` +
        `test threshold ${HEADROOM_LIMIT.toLocaleString("en-US")} CU.`,
      ``,
      `| Instruction | Calls | Max CU | Median CU | Max, % of 200k |`,
      `|---|---:|---:|---:|---:|`,
      ...rows.map((r) => `| ${r.name} | ${r.calls} | ${r.max} | ${r.median} | ${(100 * r.max / DEFAULT_INSTRUCTION_LIMIT).toFixed(1)}% |`),
      ``,
    ].join("\n");
    fs.mkdirSync(path.join(process.cwd(), "target"), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), "target", "cu-report.md"), table);
    console.log(table);

    expect(rows.length, "the suites exercise dozens of aof-core instructions").to.be.greaterThan(25);
    const heavy = rows.filter((r) => r.max > HEADROOM_LIMIT);
    expect(heavy.map((r) => `${r.name}: ${r.max} CU`), "instructions above the headroom threshold").to.deep.equal([]);
  });
});
