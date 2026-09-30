import { Router } from "express";
import { program } from "../provider";
import { weatherStatePda } from "../lib/pda";

const r = Router();
const DAYS_PER_SEASON = 42;
const SEASONS = ["spring", "summer", "autumn", "winter"];
const WEATHER_META: Record<number, { type: string; effect: string }> = {
  0: { type: "drought", effect: "well_water_rate_zero" },
  1: { type: "sunny", effect: "well_water_rate_5_per_hour" },
  2: { type: "rain", effect: "well_water_rate_15_per_hour" },
  3: { type: "harvest_festival", effect: "well_water_rate_20_per_hour" },
};

function seasonFromDayId(dayId: number) {
  const cycleDay = ((dayId % (DAYS_PER_SEASON * 4)) + DAYS_PER_SEASON * 4) % (DAYS_PER_SEASON * 4);
  const seasonIndex = Math.floor(cycleDay / DAYS_PER_SEASON);
  const dayOfSeason = cycleDay % DAYS_PER_SEASON;
  return {
    season: SEASONS[seasonIndex],
    seasonIndex,
    dayOfSeason,
    daysUntilNextSeason: DAYS_PER_SEASON - dayOfSeason,
    dayId,
  };
}

// Current weather must come from the canonical WeatherState PDA. The old
// route generated a different off-chain hash and could disagree with the
// weather_crank instruction used by the program.
r.get("/current", async (_req, res) => {
  try {
    const [address] = weatherStatePda();
    const state: any = await (program.account as any).weatherState.fetchNullable(address);
    if (!state) {
      return res.status(503).json({
        error: "WEATHER_STATE_UNAVAILABLE_FROM_CANONICAL_CHAIN",
      });
    }

    const dayId = Number(state.dayId?.toString?.() ?? state.dayId ?? 0);
    const weather = Number(state.weather ?? 0);
    const meta = WEATHER_META[weather];
    if (!meta) {
      return res.status(503).json({ error: "UNKNOWN_CANONICAL_WEATHER_VALUE" });
    }

    res.json({
      date: new Date(dayId * 86400000).toISOString().slice(0, 10),
      type: meta.type,
      effect: meta.effect,
      ...seasonFromDayId(dayId),
      updatedAt: Number(state.updatedAt?.toString?.() ?? state.updatedAt ?? 0),
      source: "onchain",
    });
  } catch (_e) {
    res.status(503).json({ error: "WEATHER_STATE_UNAVAILABLE_FROM_CANONICAL_CHAIN" });
  }
});

// Future weather is not stored on-chain and must not be presented as a
// forecast until a canonical forecast source exists.
r.get("/forecast", (_req, res) => {
  res.status(503).json({
    error: "WEATHER_FORECAST_UNAVAILABLE_WITHOUT_CANONICAL_SOURCE",
  });
});

export default r;
