import type { Unit } from "./units";

export interface PlateResult {
  barWeight: number;
  perSideWeight: number;
  plates: { weight: number; count: number }[];
  remainder: number;
}

export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
export const STANDARD_PLATES_LB = [45, 35, 25, 10, 5, 2.5];

export const DEFAULT_BAR_KG = 20;
export const DEFAULT_BAR_LB = 45;

/**
 * Computes plates needed on each side of the barbell.
 */
export function calculatePlates(
  targetWeight: number,
  unit: Unit,
  barWeight: number = unit === "lb" ? DEFAULT_BAR_LB : DEFAULT_BAR_KG
): PlateResult {
  if (targetWeight <= barWeight) {
    return {
      barWeight,
      perSideWeight: 0,
      plates: [],
      remainder: 0,
    };
  }

  const availablePlates = unit === "lb" ? STANDARD_PLATES_LB : STANDARD_PLATES_KG;
  let remainingPerSide = (targetWeight - barWeight) / 2;
  const perSideWeight = remainingPerSide;
  const plates: { weight: number; count: number }[] = [];

  for (const plate of availablePlates) {
    if (remainingPerSide >= plate) {
      const count = Math.floor(remainingPerSide / plate);
      if (count > 0) {
        plates.push({ weight: plate, count });
        remainingPerSide = Number((remainingPerSide - count * plate).toFixed(2));
      }
    }
  }

  return {
    barWeight,
    perSideWeight,
    plates,
    remainder: Number((remainingPerSide * 2).toFixed(2)),
  };
}
