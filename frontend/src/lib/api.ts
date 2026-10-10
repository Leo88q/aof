import { humanizeVrfError } from "./vrfErrors";
import { getApiErrorLanguage } from "./apiErrorLanguage";
import { humanizeApiError, isFailClosedCode } from "./availability";
import { formatResourceShortage, sanitizeShortages } from "./resourceShortageMessage";
import { apiErrorCopy } from "../i18n/apiErrorCopy";
import { fetchApi } from "./apiFetch";

// Production uses the same-origin reverse-proxy path. A fully qualified URL
// remains available for a separately hosted backend via VITE_API_URL.
const BASE = (import.meta as any).env?.VITE_API_URL || "/api";

type WalletProofRoute = { path: string; subject: string; field: string };

// Keep this allowlist explicit: quote/read-like POSTs and admin endpoints must
// not unexpectedly trigger a wallet popup. Every listed route gets a fresh,
// one-time proof bound to its backend subject before it is sent.
const WALLET_PROOF_ROUTES: WalletProofRoute[] = [
  { path: "/friend/power", subject: "friend_power", field: "power" },
  { path: "/neighbors/visit", subject: "neighbors_visit", field: "visitor" },
  { path: "/profile/register", subject: "profile_register", field: "address" },
  { path: "/profile/init-player", subject: "player_init", field: "player" },
  { path: "/streaks/check-in", subject: "streak_check_in", field: "user" },
  { path: "/onboarding/step/complete", subject: "onboarding_step", field: "user" },
  { path: "/compendium/mark-seen", subject: "compendium_mark_seen", field: "user" },
  { path: "/lore/node/complete", subject: "lore_node_complete", field: "user" },
  { path: "/rating/submit", subject: "rating_submit", field: "fromUser" },
  { path: "/notifications/device/register", subject: "notifications_device_register", field: "user" },
  { path: "/notifications/device/unregister", subject: "notifications_device_unregister", field: "user" },
  { path: "/comeback/check", subject: "comeback_check", field: "user" },
  { path: "/comeback/claim", subject: "comeback_claim", field: "user" },
  { path: "/inbox/list", subject: "inbox_list", field: "user" },
  { path: "/inbox/read", subject: "inbox_read", field: "user" },
  { path: "/inbox/claim", subject: "inbox_claim", field: "user" },
  { path: "/inbox/claim/confirm", subject: "inbox_claim_confirm", field: "user" },
  { path: "/inbox/archive", subject: "inbox_archive", field: "user" },
  { path: "/alerts/create", subject: "alerts_create", field: "user" },
  { path: "/alerts/", subject: "alerts_delete", field: "user" },
  { path: "/antifraud/device/register", subject: "antifraud_device_register", field: "user" },
  { path: "/chain/lab/plant-neuron", subject: "chain_lab_plant_neuron", field: "user" },
  { path: "/chain/lab/harvest-synapse", subject: "chain_lab_harvest_synapse", field: "user" },
  { path: "/chain/signal/start-processing", subject: "chain_signal_start_processing", field: "user" },
  { path: "/chain/signal/collect", subject: "chain_signal_collect", field: "user" },
  { path: "/chain/model/start-training", subject: "chain_model_start_training", field: "user" },
  { path: "/chain/model/collect", subject: "chain_model_collect", field: "user" },
  { path: "/chain/weather/crank", subject: "chain_weather_crank", field: "cranker" },
  { path: "/chain/grid/collect", subject: "chain_grid_collect", field: "user" },
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
  { path: "/marketplace/buy", subject: "marketplace_buy_bounded", field: "buyer" },
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
  { path: "/rental/start", subject: "rental_start_bounded", field: "renter" },
  { path: "/rental/end", subject: "rental_end", field: "caller" },
  { path: "/rental/revoke", subject: "rental_revoke", field: "owner" },
  { path: "/season/pass/init", subject: "season_pass_init", field: "player" },
  { path: "/rental/delist", subject: "rental_delist", field: "caller" },
  { path: "/orderbook/v2/buy/place", subject: "orderbook_v2_buy_place", field: "maker" },
  { path: "/orderbook/buy/place", subject: "orderbook_buy_place", field: "maker" },
  { path: "/orderbook/v2/sell/place", subject: "orderbook_v2_sell_place", field: "maker" },
  { path: "/orderbook/sell/place", subject: "orderbook_sell_place", field: "maker" },
  { path: "/orderbook/buy/cancel", subject: "orderbook_buy_cancel", field: "maker" },
  { path: "/orderbook/sell/cancel", subject: "orderbook_sell_cancel", field: "maker" },
  { path: "/orderbook/v2/match", subject: "orderbook_v2_match", field: "caller" },
  { path: "/orderbook/match", subject: "orderbook_match", field: "caller" },
  { path: "/packs/commit", subject: "packs_commit", field: "user" },
  { path: "/packs/reveal", subject: "packs_reveal", field: "user" },
  { path: "/quests/quest/claim", subject: "quests_claim", field: "user" },
  { path: "/quests/achievement/unlock", subject: "quests_achievement", field: "user" },
  { path: "/rebirth/do", subject: "rebirth_do", field: "user" },
  { path: "/referral/bind", subject: "referral_bind", field: "referred" },
  { path: "/referral/upgrade", subject: "referral_upgrade", field: "user" },
  { path: "/reroll/fuse", subject: "reroll_fuse", field: "user" },
  { path: "/reroll/random/commit", subject: "reroll_commit", field: "user" },
  { path: "/reroll/random/reveal", subject: "reroll_reveal", field: "user" },
  { path: "/resources/burn", subject: "resources_burn", field: "owner" },
  { path: "/resources/exchange-energy", subject: "resources_exchange_energy", field: "user" },
  { path: "/season/pass/purchase", subject: "season_pass_purchase", field: "user" },
  { path: "/season/reward/claim", subject: "season_reward_claim", field: "owner" },
  { path: "/xp/claims", subject: "season_xp_claim", field: "player" },
  { path: "/xp/claims/", subject: "season_xp_claim", field: "player" },
  { path: "/tools/prep-mint", subject: "tools_prep_mint", field: "owner" },
  { path: "/tools/use-flask", subject: "tools_use_flask", field: "user" },
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
  { path: "/drum/commit", subject: "drum_commit", field: "user" },
  { path: "/drum/reveal", subject: "drum_reveal", field: "user" },
  { path: "/exploration/start/commit", subject: "exploration_commit", field: "user" },
  { path: "/exploration/reveal", subject: "exploration_reveal", field: "user" },
  { path: "/exploration/upgrade-tier", subject: "exploration_upgrade_tier", field: "user" },
];

async function parseApiResponse(res: Response, options?: { allowNull?: boolean }): Promise<any> {
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
    // Known safety/VRF codes retain their specific translations. Unknown server
    // prose is not a trusted locale string (and may contain private diagnostics).
    // Preserve raw on error.code for diagnostics and fail-closed decisions.
    const raw = String(message);
    if (raw === "INSUFFICIENT_RESOURCES") {
      const missing = sanitizeShortages(data?.missing);
      const error = new Error(formatResourceShortage(getApiErrorLanguage(), missing)) as Error & { code?: string; missing?: unknown };
      error.code = raw;
      error.missing = missing;
      throw error;
    }
    const localized = humanizeVrfError(humanizeApiError(raw, getApiErrorLanguage()), getApiErrorLanguage());
    const error = new Error(localized === raw
      ? apiErrorCopy[getApiErrorLanguage()].unexpected(res.status)
      : localized) as Error & { code?: string; failClosed?: boolean };
    error.code = raw;
    error.failClosed = isFailClosedCode(raw);
    throw error;
  }

  if (data === null) {
    // A missing process PDA is valid empty state for the two reads that opt in.
    // Every other 2xx with no usable JSON is still not a successful action.
    if (options?.allowNull) return null;
    const error = new Error(apiErrorCopy[getApiErrorLanguage()].unexpected(res.status)) as Error & { code?: string };
    error.code = `NON_JSON_RESPONSE_${res.status}`;
    throw error;
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
      // Динамический импорт: lib/wallet создаёт Connection(@solana/web3.js)
      // на уровне модуля — шелл игры не должен тянуть его в первый чанк.
      const { createWalletProof } = await import("./wallet");
      requestBody.walletProof = await createWalletProof(wallet, proofRoute.subject, requestBody, { method: "POST", target: path });
    }
  }

  const res = await fetchApi(`${BASE}${path}`, {
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
      const { createWalletProof } = await import("./wallet");
      requestBody.walletProof = await createWalletProof(wallet, proofRoute.subject, requestBody, { method: "DELETE", target: path });
    }
  }

  const res = await fetchApi(`${BASE}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(requestBody),
  });
  return parseApiResponse(res);
}

async function get(path: string, options?: { allowNull?: boolean }): Promise<any> {
  const res = await fetchApi(`${BASE}${path}`);
  return parseApiResponse(res, options);
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
    power: (v: any) => post("/friend/power", v),
  },

  // === Чтение ончейн-состояния ===
  query: {
    balances: (owner: string) => get(`/query/balances/${owner}`),
    config: () => get("/query/config"),
    craftEconomy: () => get("/query/craft-economy"),
    labTiles: (user: string) => get(`/query/lab-tiles/${user}`),
    materialMints: () => get("/query/material-mints"),
    rarityCounter: (idx: number) => get(`/query/rarity-counter/${idx}`),
    packConfig: (type: number) => get(`/query/pack-config/${type}`),
    player: (owner: string) => get(`/query/player/${owner}`),
    gastank: (owner: string) => get(`/query/gastank/${owner}`),
    collector: (mint: string) => get(`/query/collector/${mint}`),
    weatherState: () => get("/query/weather-state"),
    gridState: (owner: string) => get(`/query/grid-state/${owner}`),
    signalState: (owner: string) => get(`/query/signal-state/${owner}`, { allowNull: true }),
    modelState: (owner: string) => get(`/query/model-state/${owner}`, { allowNull: true }),
    tool: (mint: string) => get(`/query/tool/${mint}`),
    myTools: (owner: string) => get(`/query/my-tools/${owner}`),
    friendFarm: (address: string) => get(`/query/friend-farm/${address}`),
    enchantSlots: (toolMint: string) => get(`/query/enchant-slots/${toolMint}`),
    orderbook: (mint: string) => get(`/query/orderbook/${mint}`),
    orderbookV2: (mint: string) => get(`/query/orderbook-v2/${mint}`),
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
    hotMarketInventory: (rarity: number) => get(`/query/hot-market-inventory/${rarity}`),
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
    plantNeuron: (v: any) => post("/chain/lab/plant-neuron", v),
    harvestSynapse: (v: any) => post("/chain/lab/harvest-synapse", v),
    // Переработка
    startSignalProcessing: (v: any) => post("/chain/signal/start-processing", v),
    collectSignal: (v: any) => post("/chain/signal/collect", v),
    // Тренировка
    startModelTraining: (v: any) => post("/chain/model/start-training", v),
    collectModel: (v: any) => post("/chain/model/collect", v),
    // Сетевая станция и нагрузка сети
    collectPower: (v: any) => post("/chain/grid/collect", v),
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
    configs: () => get("/packs/configs"),
    commit: (v: any) => post("/packs/commit", v),
    status: (packCommit: string) => get(`/packs/status/${packCommit}`),
    reveal: (v: any) => post("/packs/reveal", v),
    configInit: (v: any) => post("/packs/config/init", v),
    configSet: (v: any) => post("/packs/config/set", v),
  },

  // === Reroll ===
  reroll: {
    fuse: (v: any) => post("/reroll/fuse", v),
    randomCommit: (v: any) => post("/reroll/random/commit", v),
    randomReveal: (v: any) => post("/reroll/random/reveal", v),
    randomStatus: (rerollCommit: string) => get(`/reroll/random/status/${rerollCommit}`),
    configInit: (v: any) => post("/reroll/config/init", v),
  },

  // === Exploration ===
  exploration: {
    startCommit: (v: any) => post("/exploration/start/commit", v),
    status: (commit: string) => get(`/exploration/status/${commit}`),
    state: (user: string) => get(`/exploration/state/${user}`),
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
    status: (forgeCommit: string) => get(`/forge/status/${forgeCommit}`),
    reveal: (v: any) => post("/forge/reveal", v),
  },

  // === Лотерея ===
  lottery: {
    roundInit: (v: any) => post("/lottery/round/init", v),
    ticketBuy: (v: any) => post("/lottery/ticket/buy", v),
    ticketRefund: (v: any) => post("/lottery/ticket/refund", v),
    round: (roundId: string) => get(`/lottery/round/${roundId}`),
    drawCommit: (v: any) => post("/lottery/draw/commit", v),
    drawReveal: (v: any) => post("/lottery/draw/reveal", v),
    claim: (v: any) => post("/lottery/claim", v),
  },

  // === [F-06] Барабан удачи (Switchboard) ===
  drum: {
    commit: (v: any) => post("/drum/commit", v),
    status: (user: string) => get(`/drum/status/${user}`),
    reveal: (v: any) => post("/drum/reveal", v),
  },

  // === [F-06] Switchboard pool / pending commits ===
  vrf: {
    health: () => get("/vrf/health"),
    pending: (user: string) => get(`/vrf/pending?user=${encodeURIComponent(user)}`),
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
    // v2: цена за ЦЕЛЫЙ ресурс, эскроу округляется вверх в программе.
    placeBuyV2: (v: any) => post("/orderbook/v2/buy/place", v),
    placeSellV2: (v: any) => post("/orderbook/v2/sell/place", v),
    cancelBuyV2: (v: any) => post("/orderbook/v2/buy/cancel", v),
    cancelSellV2: (v: any) => post("/orderbook/v2/sell/cancel", v),
    matchV2: (v: any) => post("/orderbook/v2/match", v),
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
    // [PAYER] Пропуск создаёт сам игрок: его подпись и его rent.
    passInit: (v: any) => post("/season/pass/init", v),
    xpClaims: (player: string, seasonId?: number) => post("/xp/claims", { player, ...(seasonId === undefined ? {} : { seasonId }) }),
    xpClaimTransaction: (player: string, entitlementId: string) =>
      post(`/xp/claims/${encodeURIComponent(entitlementId)}/transaction`, { player }),
    xpClaimConfirm: (player: string, entitlementId: string, signature: string) =>
      post(`/xp/claims/${encodeURIComponent(entitlementId)}/confirm`, { player, signature }),
    rewardClaim: (v: any) => post("/season/reward/claim", v),
    // Роут vipStatus смонтирован на /season и слушает /:user — путь без
    // «vip-status», иначе запрос уходил в 404 и VIP молча не находился.
    current: () => get('/season/current'),
    vipStatus: (user: string, seasonId?: number) =>
      get(`/season/${user}${seasonId === undefined ? '' : `?seasonId=${encodeURIComponent(seasonId)}`}`),
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

  // [§3.4] Перерождение: полный сброс одной транзакцией (aof_core::reset_for_rebirth
  // + aof_rebirth::do_rebirth). Статус читается из сети, ничего не досчитывается.
  rebirth: {
    status: (user: string) => get(`/rebirth/status/${user}`),
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
    list: (user: string) => post("/inbox/list", { user }),
    read: (v: any) => post("/inbox/read", v),
    claim: (v: any) => post("/inbox/claim", v),
    // [PAYER] Claim отправляет кошелёк игрока; доказательство выплаты —
    // on-chain RewardReceipt, поэтому подпись подтверждается отдельно.
    confirmClaim: (v: any) => post("/inbox/claim/confirm", v),
  },

  compendium: {
    get: (user: string) => get(`/compendium/${user}`),
    markSeen: (v: any) => post("/compendium/mark-seen", v),
  },

  profile: {
    get: (user: string) => get(`/profile/${user}`),
    update: (v: any) => post("/profile/update", v),
    initPlayer: (v: any) => post("/profile/init-player", v),
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
