import assert from "node:assert/strict";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { transactionHasPlayerPayerAndAuthoritySignature } from "../src/lib/seasonXpClaimConfirmation";

function signatureStrings(signatures: Array<Uint8Array | null>): string[] {
  return signatures.map((signature) => signature ? Buffer.from(signature).toString("base64") : "");
}

function responseFromLegacy(tx: Transaction, accountKeysAsStrings = false) {
  const message = tx.compileMessage();
  return {
    transaction: {
      message: accountKeysAsStrings
        ? { ...message, accountKeys: message.accountKeys.map((key) => key.toBase58()) }
        : message,
      signatures: signatureStrings(tx.signatures.map(({ signature }) => signature)),
    },
    meta: { err: null, loadedAddresses: { writable: [], readonly: [] } },
  };
}

function legacyTx(args: {
  payer: PublicKey;
  player: Keypair;
  authority: Keypair;
  program: PublicKey;
  signers?: Keypair[];
  extraInstruction?: TransactionInstruction;
}): Transaction {
  const instruction = new TransactionInstruction({
    programId: args.program,
    keys: [
      { pubkey: args.player.publicKey, isSigner: true, isWritable: true },
      { pubkey: args.authority.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([1, 2, 3]),
  });
  const tx = new Transaction({
    feePayer: args.payer,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(instruction);
  if (args.extraInstruction) tx.add(args.extraInstruction);
  tx.partialSign(...(args.signers ?? [args.player, args.authority]));
  return tx;
}

const player = Keypair.generate();
const authority = Keypair.generate();
const stranger = Keypair.generate();
const program = Keypair.generate().publicKey;

const valid = legacyTx({ payer: player.publicKey, player, authority, program });
assert.equal(transactionHasPlayerPayerAndAuthoritySignature(
  responseFromLegacy(valid), player.publicKey, authority.publicKey, program,
), true, "valid legacy RPC response is recognized");
assert.equal(transactionHasPlayerPayerAndAuthoritySignature(
  responseFromLegacy(valid, true), player.publicKey, authority.publicKey, program,
), true, "base58 RPC account key strings are parsed");

const wrongPayer = legacyTx({
  payer: stranger.publicKey, player, authority, program,
  signers: [stranger, player, authority],
});
assert.equal(transactionHasPlayerPayerAndAuthoritySignature(
  responseFromLegacy(wrongPayer), player.publicKey, authority.publicKey, program,
), false, "a different fee payer is rejected");

const missingAuthoritySignature = legacyTx({
  payer: player.publicKey, player, authority, program, signers: [player],
});
assert.equal(transactionHasPlayerPayerAndAuthoritySignature(
  responseFromLegacy(missingAuthoritySignature), player.publicKey, authority.publicKey, program,
), false, "an absent authority signature is rejected");

const extra = legacyTx({
  payer: player.publicKey,
  player,
  authority,
  program,
  extraInstruction: new TransactionInstruction({ programId: program, keys: [], data: Buffer.alloc(0) }),
});
assert.equal(transactionHasPlayerPayerAndAuthoritySignature(
  responseFromLegacy(extra), player.publicKey, authority.publicKey, program,
), false, "an extra top-level instruction is rejected");

assert.equal(transactionHasPlayerPayerAndAuthoritySignature(
  responseFromLegacy(valid), player.publicKey, authority.publicKey, Keypair.generate().publicKey,
), false, "a different program id is rejected");

const v0Message = new TransactionMessage({
  payerKey: player.publicKey,
  recentBlockhash: Keypair.generate().publicKey.toBase58(),
  instructions: [new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: player.publicKey, isSigner: true, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([1, 2, 3]),
  })],
}).compileToV0Message();
const v0 = new VersionedTransaction(v0Message);
v0.sign([player, authority]);
assert.equal(transactionHasPlayerPayerAndAuthoritySignature({
  transaction: {
    message: v0Message,
    signatures: signatureStrings(v0.signatures),
  },
  meta: { err: null, loadedAddresses: { writable: [], readonly: [] } },
}, player.publicKey, authority.publicKey, program), true,
"versioned RPC response with staticAccountKeys/compiledInstructions is recognized");

console.log("season XP claim confirmation self-test passed (legacy/v0 RPC shape, payer, signers, instruction, program)");
