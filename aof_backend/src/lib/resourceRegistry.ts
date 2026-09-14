import { unpackMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import {
  buildCanonicalResourceMints,
  CanonicalResourceMints,
  resourceMintEntries,
} from "./resourceRegistryCore";

export { RESOURCE_MINT_KEYS, type ResourceMintKey } from "./resourceRegistryCore";
export {
  buildCanonicalResourceMints,
  resourceMintEntries,
  type CanonicalResourceMints,
} from "./resourceRegistryCore";

export const RESOURCE_MINT_DECIMALS = 9;

export type ResourceRegistryValidation = {
  mints: CanonicalResourceMints | null;
  errors: string[];
};

/**
 * Validate that every canonical resource address is a live Token Program mint
 * with the decimals expected by the on-chain RESOURCE_UNIT (1e9). The caller
 * may additionally require the core auth PDA to be the mint authority.
 */
export async function validateCanonicalResourceMints(
  connection: Connection,
  mints: CanonicalResourceMints,
  expectedMintAuthority?: PublicKey,
): Promise<ResourceRegistryValidation> {
  const entries = resourceMintEntries(mints);
  let accounts: (AccountInfo<Buffer> | null)[];
  try {
    accounts = await connection.getMultipleAccountsInfo(
      entries.map(([, mint]) => mint),
      "confirmed",
    );
  } catch {
    return { mints: null, errors: ["mint_accounts:canonical_chain_read_failed"] };
  }

  const errors: string[] = [];
  entries.forEach(([key, address], index) => {
    const info = accounts[index];
    if (!info) {
      errors.push(`${key}:mint_account_missing`);
      return;
    }
    if (!info.owner.equals(TOKEN_PROGRAM_ID)) {
      errors.push(`${key}:not_owned_by_spl_token_program`);
      return;
    }
    try {
      const mint = unpackMint(address, info, TOKEN_PROGRAM_ID);
      if (!mint.isInitialized) errors.push(`${key}:mint_not_initialized`);
      if (mint.decimals !== RESOURCE_MINT_DECIMALS) {
        errors.push(`${key}:decimals_${mint.decimals}_expected_${RESOURCE_MINT_DECIMALS}`);
      }
      if (expectedMintAuthority && !mint.mintAuthority?.equals(expectedMintAuthority)) {
        errors.push(`${key}:unexpected_mint_authority`);
      }
    } catch {
      errors.push(`${key}:invalid_spl_mint_data`);
    }
  });

  return errors.length > 0
    ? { mints: null, errors: [...new Set(errors)] }
    : { mints, errors: [] };
}

/**
 * Combine Config and MaterialMints and then validate their on-chain mint
 * accounts. This is intentionally a single fail-closed path for public query
 * endpoints; no DB allow-list or UI fallback can replace it.
 */
export async function validateCanonicalResourceRegistry(
  connection: Connection,
  config: Record<string, unknown> | null | undefined,
  materialMints: Record<string, unknown> | null | undefined,
  expectedMintAuthority?: PublicKey,
): Promise<ResourceRegistryValidation> {
  const shape = buildCanonicalResourceMints(config, materialMints);
  if (!shape.mints) return { mints: null, errors: shape.errors };
  return validateCanonicalResourceMints(connection, shape.mints, expectedMintAuthority);
}
