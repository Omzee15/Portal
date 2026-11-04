import type { Tier } from "./schedule";

/** Badge colours for the day's difficulty. */
export const TIER_STYLE: Record<Tier, string> = {
  medium: "bg-mustard text-ink",
  // light text on brick is too faint (3.3:1); dark text on terracotta reads clearly
  hard: "bg-terracotta text-ink",
  expert: "bg-ink text-paper",
};
