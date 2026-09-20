/** No floats/coercion/exponents/unsafe JS numbers in signed financial amounts. */
export function parsePurchaseBounds(body: any, now = Math.floor(Date.now() / 1000)) {
  const maximum = body?.maxPriceLamports;
  const deadline = body?.expiresAt;
  if (typeof maximum !== "string" || !/^[1-9][0-9]{0,19}$/.test(maximum) || BigInt(maximum) > 0xffffffffffffffffn) {
    throw new Error("maxPriceLamports must be a positive u64 decimal string");
  }
  if (typeof deadline !== "string" || !/^[1-9][0-9]{0,15}$/.test(deadline) ||
      !Number.isSafeInteger(Number(deadline)) || Number(deadline) <= now || Number(deadline) - now > 300) {
    throw new Error("expiresAt must be a Unix-second decimal string within 300 seconds");
  }
  return { maxPriceLamports: maximum, expiresAt: deadline };
}
