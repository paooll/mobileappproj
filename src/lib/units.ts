import { useCallback, useEffect, useState } from "react";

/** Weights are stored in Firestore as kilograms. Units only affect display + input. */
export type Unit = "kg" | "lb";

const STORAGE_KEY = "reprange.unit";
const EVENT = "reprange:unit-change";
const LB_PER_KG = 2.20462262;

function read(): Unit {
  try {
    return localStorage.getItem(STORAGE_KEY) === "lb" ? "lb" : "kg";
  } catch {
    return "kg";
  }
}

function write(unit: Unit) {
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    /* private mode — keep the in-memory value for this session */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: unit }));
}

/** kg -> the athlete's display unit, rounded to something a person would actually type */
export function toDisplay(kg: number, unit: Unit): number {
  const v = unit === "lb" ? kg * LB_PER_KG : kg;
  return Math.round(v * 10) / 10;
}

/** display unit -> kg */
export function fromDisplay(value: number, unit: Unit): number {
  const kg = unit === "lb" ? value / LB_PER_KG : value;
  return Math.round(kg * 100) / 100;
}

/** Volume in kg, shown as the athlete's display unit, with the unit suffix */
export function formatVolume(kg: number, unit: Unit): { value: string; suffix: string } {
  const v = toDisplay(kg, unit);
  if (v >= 1000) return { value: (v / 1000).toFixed(1), suffix: "t" };
  return { value: String(Math.round(v)), suffix: unit };
}

export function useUnit(): [Unit, (u: Unit) => void] {
  const [unit, setUnitState] = useState<Unit>(read);

  useEffect(() => {
    const sync = (e: Event) => {
      const detail = (e as CustomEvent<Unit>).detail;
      setUnitState(detail === "lb" ? "lb" : "kg");
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setUnitState(e.newValue === "lb" ? "lb" : "kg");
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setUnit = useCallback((u: Unit) => {
    setUnitState(u);
    write(u);
  }, []);

  return [unit, setUnit];
}
