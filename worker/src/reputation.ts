export type CowryTier =
  | "New Trader"
  | "1 Shell"
  | "2 Shells"
  | "3 Shells"
  | "4 Shells"
  | "5 Golden Cowries";

export function cowryTierFor(score: number): CowryTier {
  if (score >= 95) return "5 Golden Cowries";
  if (score >= 80) return "4 Shells";
  if (score >= 60) return "3 Shells";
  if (score >= 40) return "2 Shells";
  if (score >= 20) return "1 Shell";
  return "New Trader";
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function computeCowryScore(input: {
  avgRating: number;
  reviewCount: number;
  responseRate01: number;
  accountAgeDays: number;
}) {
  const starsBase = (clamp(input.avgRating, 0, 5) / 5) * 70;
  const reviewVolumeBonus = Math.min(15, Math.log2(input.reviewCount + 1) * 3.5);
  const responseBonus = clamp(input.responseRate01, 0, 1) * 10;
  const ageBonus = Math.min(5, input.accountAgeDays / 60);

  const score = Math.round(clamp(starsBase + reviewVolumeBonus + responseBonus + ageBonus, 0, 100));
  return {
    score,
    tier: cowryTierFor(score),
  };
}
