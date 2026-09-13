import { Router } from "express";
import crypto from "crypto";
import { db } from "../lib/db";

const r = Router();

const DAYS_PER_SEASON = 42; // из constants.rs
const SEASONS = ["spring", "summer", "autumn", "winter"];

const WEATHER_TYPES = [
  { type: "sunny", weight: 40, effect: "food_mining_+10pct" },
  { type: "rain", weight: 30, effect: "wood_mining_+10pct" },
  { type: "drought", weight: 20, effect: "all_-15pct_rare_loot_+50pct" },
  { type: "harvest_festival", weight: 10, effect: "all_multiplier" },
];

// Детерминированный тип погоды по дате (одинаков для всех в один день)
function weatherForDate(dateStr: string) {
  const hash = crypto.createHash("sha256").update(`aof-weather:${dateStr}`).digest();
  const roll = hash.readUInt32BE(0) % 100;
  let cumulative = 0;
  for (const w of WEATHER_TYPES) {
    cumulative += w.weight;
    if (roll < cumulative) return w;
  }
  return WEATHER_TYPES[0];
}

// Вычислить сезон из даты
function seasonFromDate(dateStr: string) {
  const epoch = new Date("2024-01-01").getTime();
  const current = new Date(dateStr).getTime();
  const dayId = Math.floor((current - epoch) / 86400000);
  const seasonIndex = Math.floor((dayId / DAYS_PER_SEASON) % 4);
  const dayOfSeason = dayId % DAYS_PER_SEASON;
  const daysUntilNextSeason = DAYS_PER_SEASON - dayOfSeason;
  
  return {
    season: SEASONS[seasonIndex],
    seasonIndex,
    dayOfSeason,
    daysUntilNextSeason,
    dayId,
  };
}

// Текущая погода + сезон
r.get("/current", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    let weather = await db.weather.findUnique({ where: { date: today } });
    if (!weather) {
      const w = weatherForDate(today);
      weather = await db.weather.create({ data: { date: today, type: w.type } });
    }
    const meta = WEATHER_TYPES.find((w) => w.type === weather!.type);
    const seasonData = seasonFromDate(today);
    
    res.json({ 
      date: today, 
      type: weather.type, 
      effect: meta?.effect,
      ...seasonData,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Прогноз на 3 дня вперёд (детерминированный, без хранения)
r.get("/forecast", async (req, res) => {
  try {
    const forecast = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(Date.now() + i * 86400000).toISOString().split("T")[0];
      const w = weatherForDate(d);
      const s = seasonFromDate(d);
      forecast.push({ 
        date: d, 
        type: w.type, 
        effect: w.effect,
        ...s,
      });
    }
    res.json({ forecast });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
