import { useCallback, useEffect, useState } from "react";
import type { Unit } from "./units";

/**
 * Food is weighed on its own scale, deliberately separate from the lifting
 * weights in `./units`. An athlete who lifts in pounds and thinks about food in
 * grams is an ordinary person, not an edge case, so the two never share a
 * preference.
 *
 * Grams are what gets stored. This module is display and input only, and never
 * writes anything: switching the unit changes what an athlete reads, never
 * what is already in Firestore.
 */
export type FoodUnit = "g" | "oz";

const STORAGE_KEY = "reprange.foodUnit";
const EVENT = "reprange:foodUnit-change";
const OZ_PER_G_VALUE = 1 / 28.349523125;

export const OZ_PER_G = OZ_PER_G_VALUE;

function read(fallback: FoodUnit): FoodUnit {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "g" || stored === "oz") return stored;
  } catch {
    /* private mode — fall back to the lifting unit for this session */
  }
  return fallback;
}

function write(unit: FoodUnit) {
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    /* private mode — keep the in-memory value for this session */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: unit }));
}

/**
 * The food unit that goes with a lifting unit, used before the athlete has
 * ever expressed a preference: kilograms think in grams, pounds in ounces.
 */
export function foodUnitFor(weightUnit: Unit): FoodUnit {
  return weightUnit === "lb" ? "oz" : "g";
}

/** Grams -> the athlete's food unit, at the precision a person would type. */
export function foodToDisplay(grams: number, unit: FoodUnit): number {
  const v = unit === "oz" ? grams * OZ_PER_G_VALUE : grams;
  return Math.round(v * 10) / 10;
}

/** The athlete's food unit -> grams. */
export function foodFromDisplay(value: number, unit: FoodUnit): number {
  const grams = unit === "oz" ? value / OZ_PER_G_VALUE : value;
  return Math.round(grams * 100) / 100;
}

/**
 * A portion or a macro, with its unit. Past 100 g the decimal is noise and a
 * portion reads better whole, but below that the decimal is the number: 12.5 g
 * of protein and 13 g of protein are not the same number to someone tracking
 * it, and macros land in that range constantly.
 */
export function formatFood(grams: number, unit: FoodUnit): string {
  const v = foodToDisplay(grams, unit);
  const shown = unit === "g" && v >= 100 ? String(Math.round(v)) : String(v);
  return `${shown} ${unit}`;
}

/**
 * The athlete's food unit, live across every screen that asks for it. Defaults
 * from the lifting unit so a first run never shows a preference nobody chose.
 */
export function useFoodUnit(): [FoodUnit, (u: FoodUnit) => void] {
  const [unit, setUnitState] = useState<FoodUnit>(() => read(foodUnitFor("kg")));

  useEffect(() => {
    const sync = (e: Event) => {
      const detail = (e as CustomEvent<FoodUnit>).detail;
      setUnitState(detail === "g" ? "g" : "oz");
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setUnitState(e.newValue === "oz" ? "oz" : "g");
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setUnit = useCallback((u: FoodUnit) => {
    setUnitState(u);
    write(u);
  }, []);

  return [unit, setUnit];
}