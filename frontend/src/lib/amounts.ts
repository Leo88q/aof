const U64_MAX = (1n << 64n) - 1n;

export function positiveU64(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,19}$/.test(value) || BigInt(value) > U64_MAX) {
    throw new Error("Сумма должна быть точной положительной строкой u64");
  }
  return value;
}

/** Decimal SOL -> atomic lamports; never parseFloat/round/Number on money. */
export function solToLamports(input: string): string {
  const value = input.trim();
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,9})?$/.test(value)) throw new Error("SOL: не более 9 знаков после точки");
  const [whole, fraction = ""] = value.split(".");
  return positiveU64((BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"))).toString());
}

/** Display the exact amount the local purchase intent signs, without rounding. */
export function lamportsToSol(value: string): string {
  const amount = value === "0" ? 0n : BigInt(positiveU64(value));
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${amount / 1_000_000_000n}${fraction ? `.${fraction}` : ""}`;
}
