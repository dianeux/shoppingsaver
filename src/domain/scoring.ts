/**
 * Value score (PRD ch.9).
 *   price_score = 1 − percentile of sale price within the same L2
 *   value       = 100 × (w × material + (1 − w) × price_score), w defaults to 0.5
 * Missing material data scores 0 but is labelled on the card (see compositionStatus).
 */
export const DEFAULT_MATERIAL_WEIGHT = 0.5;

/**
 * Mid-rank percentile in [0, 1]: (count below + ½ count equal) / n.
 * Percentiles instead of min-max so one very expensive item can't flatten a category.
 */
export function percentiles(prices: number[]): number[] {
  const n = prices.length;
  if (n === 0) return [];
  if (n === 1) return [0.5];
  const sorted = [...prices].sort((a, b) => a - b);
  const below = (p: number) => {
    let lo = 0, hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < p) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const atOrBelow = (p: number) => {
    let lo = 0, hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] <= p) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return prices.map((p) => {
    const b = below(p);
    const eq = atOrBelow(p) - b;
    return (b + eq / 2) / n;
  });
}

export function priceScore(percentile: number): number {
  return 1 - percentile;
}

export function valueScore(material: number | null, priceScoreValue: number, materialWeight = DEFAULT_MATERIAL_WEIGHT): number {
  const m = material ?? 0;
  return Math.round(100 * (materialWeight * m + (1 - materialWeight) * priceScoreValue));
}
