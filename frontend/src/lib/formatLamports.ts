const LAMPORTS_PER_SOL = 1_000_000_000n;

/** Exact integer formatting; never round a wallet quote through Number. */
export function formatLamportsAsSol(value: string, locale = "en"): string {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(value)) return "—";
  const lamports = BigInt(value);
  const whole = lamports / LAMPORTS_PER_SOL;
  const remainder = (lamports % LAMPORTS_PER_SOL).toString().padStart(9, "0").replace(/0+$/, "");
  const decimal = locale.toLowerCase().startsWith("ru") ? "," : ".";
  return `${whole.toString()}${remainder ? `${decimal}${remainder}` : ""} SOL`;
}
