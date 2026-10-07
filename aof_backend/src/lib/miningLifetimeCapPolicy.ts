/**
 * Read-only Devnet mining preflight policy for cumulative resource issuance.
 *
 * The on-chain sentinel remains u64::MAX when the operator intentionally
 * chooses uncapped lifetime issuance. This helper does not change chain state;
 * callers must first verify the Devnet genesis and pass the operator's explicit
 * acknowledgement. Finite caps continue to require unused headroom.
 */
export const UNLIMITED_LIFETIME_CAP = (1n << 64n) - 1n;

export type LifetimeCapAssessment =
  | {
      ok: true;
      mode: "finite";
      remainingLifetimeAtoms: string;
    }
  | {
      ok: true;
      mode: "unlimited-devnet-accepted";
      remainingLifetimeAtoms: "unlimited";
    }
  | {
      ok: false;
      mode: "unlimited-unacknowledged";
      blocker: "unlimited_lifetime_cap_requires_explicit_devnet_ack";
      remainingLifetimeAtoms: "unlimited";
    }
  | {
      ok: false;
      mode: "finite-no-headroom";
      blocker: "finite_lifetime_cap_has_no_headroom";
      remainingLifetimeAtoms: "0";
    };

/**
 * Evaluate one cumulative cap after the caller has verified the RPC is Devnet.
 * `allowUnlimitedDevnet` is an explicit release-policy acknowledgement, not a
 * cap setter: it never submits a transaction or changes MaterialMints.
 */
export function assessLifetimeCap(
  cap: bigint,
  lifetimeMinted: bigint,
  allowUnlimitedDevnet: boolean,
): LifetimeCapAssessment {
  if (cap === UNLIMITED_LIFETIME_CAP) {
    return allowUnlimitedDevnet
      ? {
          ok: true,
          mode: "unlimited-devnet-accepted",
          remainingLifetimeAtoms: "unlimited",
        }
      : {
          ok: false,
          mode: "unlimited-unacknowledged",
          blocker: "unlimited_lifetime_cap_requires_explicit_devnet_ack",
          remainingLifetimeAtoms: "unlimited",
        };
  }

  if (cap <= lifetimeMinted) {
    return {
      ok: false,
      mode: "finite-no-headroom",
      blocker: "finite_lifetime_cap_has_no_headroom",
      remainingLifetimeAtoms: "0",
    };
  }

  return {
    ok: true,
    mode: "finite",
    remainingLifetimeAtoms: (cap - lifetimeMinted).toString(),
  };
}
