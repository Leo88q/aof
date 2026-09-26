import { createWalletProof } from "./wallet";

// Production uses the same-origin reverse-proxy path. A fully qualified URL
// remains available for a separately hosted backend via VITE_API_URL.
const BASE = (import.meta as any).env?.VITE_API_URL || "/api";

type WalletProofRoute = { path: string; subject: string; field: string };

// Keep this allowlist explicit: quote/read-like POSTs and admin endpoints must
// not unexpectedly trigger a wallet popup. Every listed route gets a fresh,
// one-time proof bound to its backend subject before it is sent.
const WALLET_PROOF_ROUTES: WalletProofRoute[] = [
  { path: "/friend/water", subject: "friend_water", field: "waterer" },
  { path: "/neighbors/visit", subject: "neighbors_visit", field: "visitor" },
  { path: "/profile/register", subject: "profile_register", field: "address" },
  { path: "/streaks/check-in", subject: "streak_check_in", field: "user" },
  { path: "/onboarding/step/complete", subject: "onboarding_step", field: "user" },
  { path: "/compendium/mark-seen", subject: "compendium_mark_seen", field: "user" },
  { path: "/lore/node/complete", subject: "lore_node_complete", field: "user" },
  { path: "/rating/submit", subject: "rating_submit", field: "fromUser" },
  { path: "/notifications/device/register", subject: "notifications_device_register", field: "user" },
  { path: "/notifications/device/unregister", subject: "notifications_device_unregister", field: "user" },
  { path: "/comeback/check", subject: "comeback_check", field: "user" },
  { path: "/comeback/claim", subject: "comeback_claim", field: "user" },
  { path: "/inbox/read", subject: "inbox_read", field: "user" },
  { path: "/inbox/claim", subject: "inbox_claim", field: "user" },
  { path: "/inbox/archive", subject: "inbox_archive", field: "user" },
  { path: "/alerts/create", subject: "alerts_create", field: "user" },
  { path: "/alerts/", subject: "alerts_delete", field: "user" },
  { path: "/antifraud/device/register", subject: "antifraud_device_register", field: "user" },
  { path: "/chain/farm/plant", subject: "chain_farm_plant", field: "user" },
  { path: "/chain/farm/harvest", subject: "chain_farm_harvest", field: "user" },
  { path: "/chain/mill/start", subject: "chain_mill_start", field: "user" },
  { path: "/chain/mill/collect", subject: "chain_mill_collect", field: "user" },
  { path: "/chain/oven/start", subject: "chain_oven_start", field: "user" },
  { path: "/chain/oven/collect", subject: "chain_oven_collect", field: "user" },
  { path: "/chain/weather/crank", subject: "chain_weather_crank", field: "cranker" },
  { path: "/chain/well/collect", subject: "chain_well_collect", field: "user" },
  { path: "/chain/recipe/craft", subject: "chain_recipe_craft", field: "user" },
  { path: "/craft-order/create", subject: "craft_order_create", field: "creator" },
  { path: "/craft-order/fulfill", subject: "craft_order_fulfill", field: "fulfiller" },
  { path: "/craft-order/cancel", subject: "craft_order_cancel", field: "creator" },
  { path: "/energy/spend", subject: "energy_spend", field: "user" },
  { path: "/farm/building/place", subject: "farm_building_place", field: "user" },
  { path: "/guild/create", subject: "guild_create", field: "leaderId" },
  { path: "/guild/join", subject: "guild_join", field: "user" },
  { path: "/guild/set-role", subject: "guild_set_role", field: "user" },
  { path: "/guild-wars/capture", subject: "guild_wars_capture", field: "actor" },
  { path: "/lottery/ticket/buy", subject: "lottery_ticket_buy", field: "buyer" },
  { path: "/lottery/claim", subject: "lottery_claim", field: "winner" },
  { path: "/marketplace/list", subject: "marketplace_list", field: "seller" },
  { path: "/marketplace/buy", subject: "marketplace_buy", field: "buyer" },
  { path: "/marketplace/cancel", subject: "marketplace_cancel", field: "seller" },
  { path: "/auction/create", subject: "auction_create", field: "seller" },
  { path: "/auction/bid", subject: "auction_bid", field: "bidder" },
  { path: "/auction/settle", subject: "auction_settle", field: "caller" },
  { path: "/auction/cancel", subject: "auction_cancel", field: "seller" },
  { path: "/hot-market/skip", subject: "hot_market_skip", field: "player" },
  { path: "/offer/create", subject: "offer_create", field: "buyer" },
  { path: "/offer/accept", subject: "offer_accept", field: "seller" },
  { path: "/offer/cancel", subject: "offer_cancel", field: "buyer" },
  { path: "/rental/list", subject: "rental_list", field: "owner" },
  { path: "/rental/start", subject: "rental_start", field: "renter" },
  { path: "/rental/end", subject: "rental_end", field: "caller" },
  { path: "/rental/revoke", subject: "rental_revoke", field: "owner" },
  { path: "/rental/delist", subject: "rental_delist", field: "caller" },
  { path: "/orderbook/buy/place", subject: "orderbook_buy_place", field: "maker" },
  { path: "/orderbook/sell/place", subject: "orderbook_sell_place", field: "maker" },
  { path: "/orderbook/buy/cancel", subject: "orderbook_buy_cancel", field: "maker" },
  { path: "/orderbook/sell/cancel", subject: "orderbook_sell_cancel", field: "maker" },
  { path: "/orderbook/match", subject: "orderbook_match", field: "caller" },
  { path: "/packs/commit", subject: "packs_commit", field: "user" },
  { path: "/packs/reveal", subject: "packs_reveal", field: "user" },
  { path: "/quests/quest/claim", subject: "quests_claim", field: "user" },
  { path: "/quests/achievement/unlock", subject: "quests_achievement", field: "user" },
  { path: "/referral/bind", subject: "referral_bind", field: "referred" },
  { path: "/referral/upgrade", subject: "referral_upgrade", field: "user" },
  { path: "/reroll/fuse", subject: "reroll_fuse", field: "user" },
  { path: "/reroll/random/commit", subject: "reroll_commit", field: "user" },
  { path: "/reroll/random/reveal", subject: "reroll_reveal", field: "user" },
  { path: "/resources/burn", subject: "resources_burn", field: "owner" },
  { path: "/resources/exchange-energy", subject: "resources_exchange_energy", field: "user" },
  { path: "/season/pass/purchase", subject: "season_pass_purchase", field: "user" },
  { path: "/tools/prep-mint", subject: "tools_prep_mint", field: "owner" },
  { path: "/tools/craft", subject: "tools_craft", field: "user" },
  { path: "/tools/repair", subject: "tools_repair", field: "user" },
  { path: "/tools/stake", subject: "tools_stake", field: "user" },
  { path: "/tools/unstake", subject: "tools_unstake", field: "user" },
  { path: "/tools/start-mining", subject: "tools_start_mining", field: "user" },
  { path: "/tools/collect-mining", subject: "tools_collect_mining", field: "user" },
  { path: "/tools/burn", subject: "tools_burn", field: "user" },
  { path: "/trader-rules/create", subject: "trader_rules_create", field: "user" },
  { path: "/trader-rules/toggle", subject: "trader_rules_toggle", field: "user" },
  { path: "/trader-rules/", subject: "trader_rules_delete", field: "user" },
  { path: "/gastank/deposit", subject: "gastank_deposit", field: "user" },
  { path: "/gastank/withdraw", subject: "gastank_withdraw", field: "user" },
  { path: "/liquidity/deposit", subject: "liquidity_deposit", field: "user" },
  { path: "/liquidity/withdraw", subject: "liquidity_withdraw", field: "user" },
  { path: "/forge/commit", subject: "forge_commit", field: "user" },
  { path: "/forge/reveal", subject: "forge_reveal", field: "user" },
  { path: "/forge/bow/commit", subject: "forge_bow_commit", field: "user" },
  { path: "/forge/bow/reveal", subject: "forge_bow_reveal", field: "user" },
  { path: "/drum/commit", subject: "drum_commit", field: "user" },
  { path: "/drum/reveal", subject: "drum_reveal", field: "user" },
  { path: "/exploration/start/commit", subject: "exploration_commit", field: "user" },
  { path: "/exploration/reveal", subject: "exploration_reveal", field: "user" },
  { path: "/exploration/upgrade-tier", subject: "exploration_upgrade_tier", field: "user" },
];

async function parseApiResponse(res: Response): Promise<any> {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let data: any = null;
  if (isJson) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errorText = !isJson ? await res.text().catch(() => "") : "";
    const message =
      data?.error ||
      data?.message ||
      (typeof data === "string" ? data : "") ||
      (errorText && !errorText.includes("<!DOCTYPE") && !errorText.includes("<html") ? errorText.slice(0, 200) : "") ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }

  if (data === null) {
    throw new Error(
      `API endpoint returned non-JSON response (status: ${res.status}, content-type: ${contentType || "none"})`
    );
  }

  return data;
}

async function post(path: string, body: Record<string, any> = {}): Promise<any> {
  const requestBody = { ...body };
  const proofRoute = WALLET_PROOF_ROUTES.find((route) =>
    route.path === path || (route.path.endsWith("/") && path.startsWith(route.path))
  );
  if (proofRoute && !requestBody.walletProof) {
    const wallet = requestBody[proofRoute.field];
    if (typeof wallet === "string" && wallet.length > 0) {
      requestBody.walletProof = await createWalletProof(wallet, proofRoute.subject, requestBody, { method: "POST", target: path });
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(requestBody),
  });
  return parseApiResponse(res);
}

async function del(path: string, body: Record<string, any> = {}): Promise<any> {
  const requestBody = { ...body };
  const proofRoute = WALLET_PROOF_ROUTES.find((route) =>
    route.path === path || (route.path.endsWith("/") && path.startsWith(route.path))
  );
  if (proofRoute && !requestBody.walletProof) {
    const wallet = requestBody[proofRoute.field];
    if (typeof wallet === "string" && wallet.length > 0) {
      requestBody.walletProof = await createWalletProof(wallet, proofRoute.subject, requestBody, { method: "DELETE", target: path });
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(requestBody),
  });
  return parseApiResponse(res);
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  return parseApiResponse(res);
}

export const api = {
  alerts: {
    create: (v: any) => post("/alerts/create", v),
    remove: (id: string, v: any) => del(`/alerts/${encodeURIComponent(id)}`, v),
  },

  traderRules: {
    remove: (id: string, v: any) => del(`/trader-rules/${encodeURIComponent(id)}`, v),
  },

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
    weatherState: () => get("/query/weather-state"),
    wellState: (owner: string) => get(`/query/well-state/${owner}`),
    millState: (owner: string) => get(`/query/mill-state/${owner}`),
    ovenState: (owner: string) => get(`/query/oven-state/${owner}`),
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
  // === [БЛОК L] Модельная экономика ===
  chain: {
    // Лаборатория
    plantSeeds: (v: any) => post("/chain/farm/plant", v),
    harvestWheat: (v: any) => post("/chain/farm/harvest", v),
    // Переработка
    startMilling: (v: any) => post("/chain/mill/start", v),
    collectFlour: (v: any) => post("/chain/mill/collect", v),
    // Тренировка
    startBaking: (v: any) => post("/chain/oven/start", v),
    collectBread: (v: any) => post("/chain/oven/collect", v),
    // Сетевая станция и нагрузка сети
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

  // === Квантовая кузница + скины передатчика ===
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
    cancel: (v: any) => post("/auction/cancel", v),
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
    delist: (v: any) => post("/rental/delist", v),
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

  // === Эпоха ===
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
