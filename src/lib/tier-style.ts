import type { Tier } from "./schedule";

/** Badge colours for the day's difficulty. */
export const TIER_STYLE: Record<Tier, string> = {
  medium: "bg-mustard text-ink",
  hard: "bg-brick text-paper",
  expert: "bg-ink text-paper",
};
