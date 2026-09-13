const BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";

async function post(path: string, body: Record<string, any> = {}): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  friend: {
    water: (v: any) => post("/friend/water", v),
  },

  // === Чтение ончейн-состояния ===
  query: {
    balances: (owner: string) => get(`/query/balances/${owner}`),
    config: () => get("/query/config"),
    craftEconomy: () => get("/query/craft-economy"),
    farmTiles: (user: string) => get(`/query/farm-tiles/${user}`),
    materialMints: () => get("/query/material-mints"),
    rarityCounter: (idx: number) => get(`/query/rarity-counter/${idx}`),
    packConfig: (type: number) => get(`/query/pack-config/${type}`),
    player: (owner: string) => get(`/query/player/${owner}`),
    gastank: (owner: string) => get(`/query/gastank/${owner}`),
    tool: (mint: string) => get(`/query/tool/${mint}`),
    myTools: (owner: string) => get(`/query/my-tools/${owner}`),
    friendFarm: (address: string) => get(`/query/friend-farm/${address}`),
    enchantSlots: (toolMint: string) => get(`/query/enchant-slots/${toolMint}`),
    orderbook: (mint: string) => get(`/query/orderbook/${mint}`),
    auctions: (mint?: string) => get(`/query/auctions${mint ? `?mint=${mint}` : ""}`),
    auction: (mint: string) => get(`/query/auction/${mint}`),
    listings: () => get("/query/listings"),
    offers: (mint: string) => get(`/query/offers/${mint}`),
    rentals: () => get("/query/rentals"),
    rental: (mint: string) => get(`/query/rental/${mint}`),
    lotteryRound: (roundId: string) => get(`/query/lottery/${roundId}`),
    myTickets: (roundId: string, buyer: string) => get(`/query/lottery/${roundId}/my-tickets/${buyer}`),
    craftOrders: () => get("/query/craft-orders"),
    seasonPass: (owner: string, seasonId: string) => get(`/query/season-pass/${owner}/${seasonId}`),
    // [ФИКС Группы 1] Очередь хот-маркета: голова для покупки вместо хардкода
    hotMarketQueue: (rarity: number) => get(`/query/hot-market-queue/${rarity}`),
    hotMarketPool: (rarity: number) => get(`/query/hot-market-pool/${rarity}`),
  },

  // === Админ ===
  admin: {
    auditLogs: (limit = 100) => get(`/admin/audit/logs?limit=${limit}`),
    auditStats: () => get("/admin/audit/stats"),
    initialize: (v: any) => post("/admin/initialize", v),
    setFees: (v: any) => post("/admin/set-fees", v),
    setPaused: (v: any) => post("/admin/set-paused", v),
    setResourceMints: (v: any) => post("/admin/set-resource-mints", v),
    craftEconomyInit: (v: any) => post("/admin/craft-economy/init", v),
    craftEconomySet: (v: any) => post("/admin/craft-economy/set", v),
    economySnapshots: (limit = 50) => get(`/admin/economy/snapshots?limit=${limit}`),
    economyAlerts: (limit = 50) => get(`/admin/economy/alerts?limit=${limit}`),
    economySnapshot: () => post("/admin/economy/snapshot", {}),
    economyAlertResolve: (id: string) => post(`/admin/economy/alerts/${id}/resolve`, {}),

    rarityCounterInit: (v: any) => post("/admin/rarity-counter/init", v),
    migrateTool: (v: any) => post("/admin/migrate-tool", v),
  },

  // === Газ-бак ===
  gastank: {
    deposit: (v: any) => post("/gastank/deposit", v),
    withdraw: (v: any) => post("/gastank/withdraw", v),
    sweep: (v: any) => post("/gastank/sweep", v),
  },

  // === Ресурсы ===
  resources: {
    mint: (v: any) => post("/resources/mint", v),
    burn: (v: any) => post("/resources/burn", v),
    exchangeEnergy: (v: any) => post("/resources/exchange-energy", v),
  },

  // === Инструменты ===
  tools: {
    mint: (v: any) => post("/tools/mint", v),
    prepMint: (v: any) => post("/tools/prep-mint", v),
    craft: (v: any) => post("/tools/craft", v),
    useFlask: (v: any) => post("/tools/use-flask", v),
    repair: (v: any) => post("/tools/repair", v),
    repairQuote: (v: any) => post("/tools/repair-quote", v),
    craftQuote: (v: any) => post("/tools/craft-quote", v),
    stake: (v: any) => post("/tools/stake", v),
    unstake: (v: any) => post("/tools/unstake", v),
    startMining: (v: any) => post("/tools/start-mining", v),
    collectMining: (v: any) => post("/tools/collect-mining", v),
    burn: (v: any) => post("/tools/burn", v),
    payOut: (v: any) => post("/tools/pay-out", v),
  },

  // === Коллекционеры ===
  // === [БЛОК L] Хлебная экономика ===
  chain: {
    // Ферма
    plantSeeds: (v: any) => post("/chain/farm/plant", v),
    harvestWheat: (v: any) => post("/chain/farm/harvest", v),
    // Мельница
    startMilling: (v: any) => post("/chain/mill/start", v),
    collectFlour: (v: any) => post("/chain/mill/collect", v),
    // Печь
    startBaking: (v: any) => post("/chain/oven/start", v),
    collectBread: (v: any) => post("/chain/oven/collect", v),
    // Колодец и погода
    collectWellWater: (v: any) => post("/chain/well/collect", v),
    weatherCrank: (v: any) => post("/chain/weather/crank", v),
    // Мгновенный крафт (гемы/баночки)
    craftRecipe: (v: any) => post("/chain/recipe/craft", v),
  },

  collectors: {
    stake: (v: any) => post("/collectors/stake", v),
    unstake: (v: any) => post("/collectors/unstake", v),
    adjustCapacity: (v: any) => post("/collectors/adjust-capacity", v),
  },

  // === Паки ===
  packs: {
    commit: (v: any) => post("/packs/commit", v),
    reveal: (v: any) => post("/packs/reveal", v),
    configInit: (v: any) => post("/packs/config/init", v),
    configSet: (v: any) => post("/packs/config/set", v),
  },

  // === Reroll ===
  reroll: {
    fuse: (v: any) => post("/reroll/fuse", v),
    randomCommit: (v: any) => post("/reroll/random/commit", v),
    randomReveal: (v: any) => post("/reroll/random/reveal", v),
    configInit: (v: any) => post("/reroll/config/init", v),
  },

  // === Exploration ===
  exploration: {
    startCommit: (v: any) => post("/exploration/start/commit", v),
    reveal: (v: any) => post("/exploration/reveal", v),
    upgradeTier: (v: any) => post("/exploration/upgrade-tier", v),
  },

  // === Рефералы ===
  referral: {
    bind: (v: any) => post("/referral/bind", v),
    upgrade: (v: any) => post("/referral/upgrade", v),
    payOut: (v: any) => post("/referral/pay-out", v),
  },

  // === Кузница риска + скины лука ===
  forge: {
    commit: (v: any) => post("/forge/commit", v),
    reveal: (v: any) => post("/forge/reveal", v),
    bowCommit: (v: any) => post("/forge/bow/commit", v),
    bowReveal: (v: any) => post("/forge/bow/reveal", v),
  },

  // === Лотерея ===
  lottery: {
    roundInit: (v: any) => post("/lottery/round/init", v),
    ticketBuy: (v: any) => post("/lottery/ticket/buy", v),
    drawCommit: (v: any) => post("/lottery/draw/commit", v),
    drawReveal: (v: any) => post("/lottery/draw/reveal", v),
    claim: (v: any) => post("/lottery/claim", v),
  },

  // === Маркетплейс ===
  marketplace: {
    list: (v: any) => post("/marketplace/list", v),
    buy: (v: any) => post("/marketplace/buy", v),
    cancel: (v: any) => post("/marketplace/cancel", v),
  },

  // === Аукцион ===
  auction: {
    create: (v: any) => post("/auction/create", v),
    bid: (v: any) => post("/auction/bid", v),
    settle: (v: any) => post("/auction/settle", v),
  },

  // === Офферы ===
  offer: {
    create: (v: any) => post("/offer/create", v),
    accept: (v: any) => post("/offer/accept", v),
    cancel: (v: any) => post("/offer/cancel", v),
  },

  // === Аренда ===
  rental: {
    list: (v: any) => post("/rental/list", v),
    start: (v: any) => post("/rental/start", v),
    end: (v: any) => post("/rental/end", v),
    revoke: (v: any) => post("/rental/revoke", v),
  },

  // === Ордербук ресурсов ===
  orderbook: {
    placeBuy: (v: any) => post("/orderbook/buy/place", v),
    placeSell: (v: any) => post("/orderbook/sell/place", v),
    cancelBuy: (v: any) => post("/orderbook/buy/cancel", v),
    cancelSell: (v: any) => post("/orderbook/sell/cancel", v),
    match: (v: any) => post("/orderbook/match", v),
  },

  // === Крафт под заказ ===
  craftOrder: {
    create: (v: any) => post("/craft-order/create", v),
    fulfill: (v: any) => post("/craft-order/fulfill", v),
    cancel: (v: any) => post("/craft-order/cancel", v),
  },

  // === Сезон ===
  season: {
    init: (v: any) => post("/season/init", v),
    passPurchase: (v: any) => post("/season/pass/purchase", v),
    xpGrant: (v: any) => post("/season/xp/grant", v),
    rewardClaim: (v: any) => post("/season/reward/claim", v),
    vipStatus: (user: string) => get(`/season/vip-status/${user}`),
  },

  // === Безопасность ===
  security: {
    mints: () => get("/security/mints"),
    circuit: () => get("/security/circuit"),
    audit: (limit = 50) => get(`/security/audit?limit=${limit}`),
    auditByWallet: (wallet: string) => get(`/security/audit/${wallet}`),
  },

  // === Игровые механики (БД-слой) ===
  weather: {
    current: () => get("/weather/current"),
    forecast: () => get("/weather/forecast"),
  },

  energy: {
    balance: (user: string) => get(`/energy/balance/${user}`),
    spend: (v: any) => post("/energy/spend", v),
  },

  streaks: {
    get: (user: string) => get(`/streaks/${user}`),
    checkIn: (v: any) => post("/streaks/check-in", v),
  },
  quests: {
    daily: (user: string) => get(`/quests/daily/${user}`),
    list: (user: string) => get(`/quests/list/${user}`),
    claim: (v: any) => post("/quests/quest/claim", v),
    achievements: (user: string) => get(`/quests/achievements/${user}`),
  },

  marketData: {
    price: (rarity: number) => get(`/market-data/price/${rarity}`),
    candles: (rarity: number, tf: string, limit = 100) =>
      get(`/market-data/candles/${rarity}?tf=${tf}&limit=${limit}`),
    trades: (rarity: number, limit = 20) =>
      get(`/market-data/trades/${rarity}?limit=${limit}`),
  },

  hotMarket: {
    buy: (v: any) => post("/hot-market/buy", v),
    sell: (v: any) => post("/hot-market/sell", v),
    skip: (v: any) => post("/hot-market/skip", v),
    crank: (v: any) => post("/hot-market/crank", v),
  },

  // [ФИКС Группы 1] Ребёрт (контракт: цена + кулдаун — Группа 3)
  rebirth: {
    do: (v: any) => post("/rebirth/do", v),
  },

  sandbox: {
    run: (params: any) => post("/sandbox/run", params),
    runV2: (params: any) => post("/sandbox/run-v2", params),
    compare: (params: any) => post("/sandbox/compare", params),
  },
  npc: {
    stats: () => get("/npc/stats"),
    run: () => post("/npc/run", {}),
  },
  daily: {
    status: (user: string) => get(`/daily/status/${user}`),
    claim: (data: any) => post("/daily/claim", data),
  },
  portfolio: {
    get: (user: string) => get(`/portfolio/${user}`),
  },

  inbox: {
    list: (user: string) => get(`/inbox/${user}`),
    read: (v: any) => post("/inbox/read", v),
    claim: (v: any) => post("/inbox/claim", v),
  },

  compendium: {
    get: (user: string) => get(`/compendium/${user}`),
    markSeen: (v: any) => post("/compendium/mark-seen", v),
  },

  profile: {
    get: (user: string) => get(`/profile/${user}`),
    update: (v: any) => post("/profile/update", v),
  },

  rating: {
    submit: (data: any) => post("/rating/submit", data),
    player: (user: string) => get(`/rating/player/${user}`),
    leaderboard: (limit = 100) => get(`/rating/leaderboard?limit=${limit}`),
  },
  trust: {
    get: (user: string) => get(`/trust/${user}`),
  },

  privileges: {
    status: (user: string) => get(`/privileges/${user}`),
  },
  comeback: {
    check: (v: any) => post("/comeback/check", v),
    list: (user: string) => get(`/comeback/${user}`),
    claim: (v: any) => post("/comeback/claim", v),
  },
  drum: {
    commit: (v: any) => post("/drum/commit", v),
    reveal: (v: any) => post("/drum/reveal", v),
  },

  neighbors: {
    list: (user: string) => get(`/neighbors/list/${user}`),
    visit: (v: any) => post("/neighbors/visit", v),
  },

  farm: {
    plot: (user: string) => get(`/farm/plot/${user}`),
    placeBuilding: (v: any) => post("/farm/building/place", v),
    expand: (v: any) => post("/farm/plot/expand", v),
  },
};
