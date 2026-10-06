import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  PublicKey,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AUTHORITY } from "../src/config";
import { connection, program } from "../src/provider";
import { sanitizeRpcError } from "../src/lib/bootstrapPreflight";
import {
  authPda,
  configPda,
  craftEconomyPda,
  rarityCounterPda,
  issuanceCapPda,
  materialMintsPda,
  resourceEscrowAta,
  toolMetadataRegistryPda,
  TOKEN_METADATA_PROGRAM_ID,
} from "../src/lib/pda";
import {
  SWITCHBOARD,
  rewardEscrowAddress,
  switchboardCluster,
  vrfAuthorityPda,
} from "../src/lib/vrf";
import { authorityOnly } from "../src/lib/tx";

const BATCH_SIZE = 20; // keep each ExtendProgram instruction comfortably packet-sized
const MAX_LOOKUP_TABLE_ADDRESSES = 256;
const SLOT_WAIT_MS = 400;
const SLOT_WAIT_DEADLINE_MS = 15_000;

type LookupTableResponse = Awaited<ReturnType<typeof connection.getAddressLookupTable>>;

function fail(message: string): never {
  throw new Error(message);
}

function uniqueAddresses(addresses: PublicKey[]): PublicKey[] {
  const seen = new Set<string>();
  return addresses.filter((address) => {
    const key = address.toBase58();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function explorationAddresses(): Promise<PublicKey[]> {
  const [configKey] = configPda();
  const [materialMintsKey] = materialMintsPda();
  const [config, mints, poolRows] = await Promise.all([
    (program.account as any).config.fetch(configKey),
    (program.account as any).materialMints.fetch(materialMintsKey),
    (program.account as any).vrfSlot.all() as Promise<Array<{ publicKey: PublicKey; account: any }>>,
  ]);
  const switchboard = SWITCHBOARD[switchboardCluster()];
  const addresses = [
    // Stable program/account keys shared by exploration commit and settlement.
    program.programId,
    configKey,
    toolMetadataRegistryPda()[0],
    TOKEN_METADATA_PROGRAM_ID,
    materialMintsKey,
    authPda()[0],
    craftEconomyPda()[0],
    ...Array.from({ length: 5 }, (_, rarity) => rarityCounterPda(rarity)[0]),
    config.dataMint as PublicKey,
    config.circuitMint as PublicKey,
    config.siliconMint as PublicKey,
    config.neuronMint as PublicKey,
    config.powerMint as PublicKey,
    config.mindMint as PublicKey,
    mints.dataset as PublicKey,
    resourceEscrowAta(config.dataMint),
    resourceEscrowAta(config.circuitMint),
    resourceEscrowAta(config.siliconMint),
    resourceEscrowAta(mints.dataset),
    issuanceCapPda("circuit")[0],
    issuanceCapPda("silicon")[0],
    vrfAuthorityPda(program.programId),
    switchboard.queue,
    switchboard.state,
    switchboard.programId,
    SYSVAR_SLOT_HASHES_PUBKEY,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    SystemProgram.programId,
    ComputeBudgetProgram.programId,
    NATIVE_MINT,
    // Pool accounts are created by vrf_pool_add and are stable per slot. Add
    // the whole pool so a later reveal/refund can resolve any assigned slot.
    ...poolRows.flatMap(({ publicKey, account }) => [
      publicKey,
      account.randomness as PublicKey,
      rewardEscrowAddress(account.randomness as PublicKey),
    ]),
  ];
  return uniqueAddresses(addresses);
}

async function readTable(address: PublicKey): Promise<AddressLookupTableAccount | null> {
  const response: LookupTableResponse = await connection.getAddressLookupTable(address, { commitment: "confirmed" });
  return response.value;
}

async function waitUntilActive(address: PublicKey): Promise<AddressLookupTableAccount> {
  const deadline = Date.now() + SLOT_WAIT_DEADLINE_MS;
  while (Date.now() < deadline) {
    const table = await readTable(address);
    if (!table) fail("Address lookup table disappeared during read-back");
    const currentSlot = BigInt(await connection.getSlot("confirmed"));
    if (currentSlot > BigInt(table.state.lastExtendedSlot)) return table;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, SLOT_WAIT_MS));
  }
  fail("Lookup table entries have not activated after 15 seconds; retry after the next confirmed slot");
}

function persistTableAddress(address: PublicKey): void {
  const envPath = resolve(__dirname, "../.env");
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const line = `VRF_ADDRESS_LOOKUP_TABLE=${address.toBase58()}`;
  const assignment = /^\s*VRF_ADDRESS_LOOKUP_TABLE\s*=.*$/m;
  const next = assignment.test(existing)
    ? existing.replace(assignment, line)
    : `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}${line}\n`;
  writeFileSync(envPath, next, { mode: 0o600 });
}

async function main(): Promise<void> {
  const authority = AUTHORITY;
  if (!authority) fail("AUTHORITY_MODE=read-only: VRF lookup table provisioning needs the backend authority");
  const genesis = await connection.getGenesisHash();
  const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
  if (genesis !== DEVNET_GENESIS_HASH || switchboardCluster() !== "devnet") {
    fail("Refusing to provision the exploration lookup table outside the devnet program/RPC cluster");
  }

  const desired = await explorationAddresses();
  if (desired.length > MAX_LOOKUP_TABLE_ADDRESSES) fail(`Need ${desired.length} addresses; ALT capacity is ${MAX_LOOKUP_TABLE_ADDRESSES}`);

  let tableAddress: PublicKey;
  let table: AddressLookupTableAccount | null;
  const configured = (process.env.VRF_ADDRESS_LOOKUP_TABLE || "").trim();
  if (configured) {
    try {
      tableAddress = new PublicKey(configured);
    } catch {
      fail("VRF_ADDRESS_LOOKUP_TABLE is not a valid public key");
    }
    table = await readTable(tableAddress);
    if (!table) fail("VRF_ADDRESS_LOOKUP_TABLE is configured but the table does not exist on devnet");
  } else {
    const recentSlot = await connection.getSlot("confirmed");
    const [createIx, createdAddress] = AddressLookupTableProgram.createLookupTable({
      authority: authority.publicKey,
      payer: authority.publicKey,
      recentSlot,
    });
    await authorityOnly([createIx]);
    tableAddress = createdAddress;
    table = await readTable(tableAddress);
    if (!table) fail("Created address lookup table was not readable after confirmation");
    // Save the stable public address immediately so a later failed extend can
    // resume on this same authority-controlled table instead of orphaning it.
    persistTableAddress(tableAddress);
  }

  if (table.state.deactivationSlot !== (1n << 64n) - 1n) {
    fail("Configured VRF address lookup table is deactivated; choose a live table");
  }
  const tableAuthority = table.state.authority;
  const existing = new Set(table.state.addresses.map((address) => address.toBase58()));
  const missing = desired.filter((address) => !existing.has(address.toBase58()));
  if (missing.length && (!tableAuthority || !tableAuthority.equals(authority.publicKey))) {
    fail("Configured VRF address lookup table is missing required addresses and is not authority-controlled by this backend");
  }
  if (table.state.addresses.length + missing.length > MAX_LOOKUP_TABLE_ADDRESSES) {
    fail(`Configured lookup table would exceed ${MAX_LOOKUP_TABLE_ADDRESSES} addresses`);
  }

  for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
    const batch = missing.slice(offset, offset + BATCH_SIZE);
    const extendIx = AddressLookupTableProgram.extendLookupTable({
      payer: authority.publicKey,
      authority: authority.publicKey,
      lookupTable: tableAddress,
      addresses: batch,
    });
    await authorityOnly([extendIx]);
  }

  table = await waitUntilActive(tableAddress);
  const actual = new Set(table.state.addresses.map((address) => address.toBase58()));
  const absent = desired.filter((address) => !actual.has(address.toBase58()));
  if (absent.length) fail(`Lookup-table read-back is incomplete: ${absent.length} required addresses are absent`);
  persistTableAddress(tableAddress);

  console.log(JSON.stringify({
    status: "READY",
    cluster: "devnet",
    address: tableAddress.toBase58(),
    addressCount: table.state.addresses.length,
    requiredExplorationAddresses: desired.length,
    poolSlotsIncluded: (await (program.account as any).vrfSlot.all()).length,
    activeAfterSlot: Number(table.state.lastExtendedSlot),
    envUpdated: "aof_backend/.env",
  }, null, 2));
}

main().catch((error) => {
  console.error("VRF address lookup table provisioning failed:", sanitizeRpcError(error));
  process.exitCode = 1;
});
