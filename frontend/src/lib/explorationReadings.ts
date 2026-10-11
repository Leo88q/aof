/** Must match the exploration tables in `aof-core/src/constants.rs`. */
export const EXPLORATION_SUCCESS_BPS = [3000, 4000, 5000, 5500, 6000, 6000, 6500, 7000, 7500, 8000] as const;
export const EXPLORATION_COOLDOWN_HOURS = [24, 22, 20, 18, 16, 14, 12, 10, 9, 8] as const;
export const EXPLORATION_TRIPS_PER_DAY = [1, 1, 1, 1, 1, 2, 2, 2, 2, 3] as const;
export const EXPLORATION_REWARD_MIN = [2, 2, 3, 3, 4, 4, 4, 5, 5, 6] as const;
export const EXPLORATION_REWARD_MAX = [3, 3, 4, 5, 5, 5, 6, 6, 7, 8] as const;
export const EXPLORATION_UPGRADE_WHOLE = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000] as const;

export type ExplorationTierRule = {
  tier: number;
  successBps: number;
  cooldownHours: number;
  tripsPerDay: number;
  rewardMin: number;
  rewardMax: number;
  upgradeWhole: number | null;
};

/** Tier is 1-based. A missing account is not tier 1 until the program records it. */
export function explorationTierRule(tier: number): ExplorationTierRule | null {
  if (!Number.isInteger(tier) || tier < 1 || tier > 10) return null;
  const index = tier - 1;
  return {
    tier,
    successBps: EXPLORATION_SUCCESS_BPS[index],
    cooldownHours: EXPLORATION_COOLDOWN_HOURS[index],
    tripsPerDay: EXPLORATION_TRIPS_PER_DAY[index],
    rewardMin: EXPLORATION_REWARD_MIN[index],
    rewardMax: EXPLORATION_REWARD_MAX[index],
    upgradeWhole: tier < 10 ? EXPLORATION_UPGRADE_WHOLE[index] : null,
  };
}
