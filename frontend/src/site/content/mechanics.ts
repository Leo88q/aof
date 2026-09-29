// Stable links from historic mechanism IDs to the reviewed seven-language guides.
// Editorial step text lives in src/i18n/siteIntro.ts and siteEditorial.ts.
// This route map does not imply that any instruction is enabled on-chain.
export const mechanicRoutes: Record<string, string> = {
  forge: 'craft', drum: 'lottery', exploration: 'mine', marketplace: 'trade',
  orderbook: 'trade', auction: 'trade', hot_market: 'trade', collectors: 'quests',
  social: 'quests', gas: 'start', milling: 'farm', weather: 'weather',
  seasons: 'seasons', rebirth: 'seasons', trust: 'trust', npc: 'market',
  liquidity: 'trade', rental: 'tools', quests: 'quests',
};
