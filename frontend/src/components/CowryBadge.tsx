import React from "react";

type Props = {
  score: number;
  tier: string;
  avgRating: number;
  reviewCount: number;
};

export function CowryBadge({ score, tier, avgRating, reviewCount }: Props) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "#F0E6D8", background: "#fff" }}>
      <div className="text-sm font-semibold">🐚 {tier}</div>
      <div className="text-xs text-slate-600">Cowry Score: {score}/100</div>
      <div className="text-xs text-slate-600">{avgRating.toFixed(1)}★ ({reviewCount} reviews)</div>
    </div>
  );
}
