import { useState } from "react";
import type { ZoneActivity, MuscleZone } from "../lib/muscleHeatmap";

interface Props {
  data: Record<MuscleZone, ZoneActivity>;
}

export default function MuscleHeatmap({ data }: Props) {
  const [view, setView] = useState<"front" | "back">("front");
  const [selectedZone, setSelectedZone] = useState<MuscleZone | null>("Chest");

  const active = selectedZone ? data[selectedZone] : null;

  const getColor = (zone: MuscleZone) => {
    const d = data[zone];
    if (!d || d.sets === 0) return "var(--fill)";
    return d.color;
  };

  const getStroke = (zone: MuscleZone) => {
    return selectedZone === zone ? "var(--ink)" : "var(--line)";
  };

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[17px] font-bold">7-Day Muscle Heatmap</h3>
          <p className="text-[13px] text-[var(--ink-2)] mt-0.5">
            Active training volume across muscle groups
          </p>
        </div>
        <div className="flex rounded-xl bg-[var(--fill)] p-1">
          <button
            type="button"
            onClick={() => setView("front")}
            className={`min-h-[32px] rounded-lg px-3 text-[12px] font-semibold transition-colors ${
              view === "front" ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-3)]"
            }`}
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => setView("back")}
            className={`min-h-[32px] rounded-lg px-3 text-[12px] font-semibold transition-colors ${
              view === "back" ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-3)]"
            }`}
          >
            Back
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-around gap-6">
        {/* SVG Anatomy Silhouette */}
        <div className="relative w-48 h-72 flex items-center justify-center">
          <svg
            viewBox="0 0 160 240"
            className="w-full h-full drop-shadow-sm transition-all"
            aria-label="Muscle heatmap silhouette"
          >
            {/* Head */}
            <circle cx="80" cy="22" r="14" fill="var(--fill)" stroke="var(--line)" strokeWidth="2" />

            {view === "front" ? (
              <g id="anterior">
                {/* Shoulders */}
                <path
                  d="M 48 42 C 40 46 36 56 36 62 C 44 62 52 56 56 46 Z"
                  fill={getColor("Shoulders")}
                  stroke={getStroke("Shoulders")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Shoulders")}
                />
                <path
                  d="M 112 42 C 120 46 124 56 124 62 C 116 62 108 56 104 46 Z"
                  fill={getColor("Shoulders")}
                  stroke={getStroke("Shoulders")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Shoulders")}
                />

                {/* Chest */}
                <path
                  d="M 58 46 C 70 42 90 42 102 46 C 104 62 90 74 80 75 C 70 74 56 62 58 46 Z"
                  fill={getColor("Chest")}
                  stroke={getStroke("Chest")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Chest")}
                />

                {/* Arms (Biceps / Forearms) */}
                <path
                  d="M 35 66 C 30 76 28 92 26 106 C 31 108 36 98 40 86 C 42 78 40 68 35 66 Z"
                  fill={getColor("Arms")}
                  stroke={getStroke("Arms")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Arms")}
                />
                <path
                  d="M 125 66 C 130 76 132 92 134 106 C 129 108 124 98 120 86 C 118 78 120 68 125 66 Z"
                  fill={getColor("Arms")}
                  stroke={getStroke("Arms")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Arms")}
                />

                {/* Abs */}
                <path
                  d="M 64 78 C 72 77 88 77 96 78 C 94 102 90 120 80 122 C 70 120 66 102 64 78 Z"
                  fill={getColor("Abs")}
                  stroke={getStroke("Abs")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Abs")}
                />

                {/* Legs (Quads) */}
                <path
                  d="M 54 128 C 50 150 48 180 52 208 C 60 210 68 190 72 170 C 76 150 74 134 68 128 Z"
                  fill={getColor("Legs")}
                  stroke={getStroke("Legs")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Legs")}
                />
                <path
                  d="M 106 128 C 110 150 112 180 108 208 C 100 210 92 190 88 170 C 84 150 86 134 92 128 Z"
                  fill={getColor("Legs")}
                  stroke={getStroke("Legs")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Legs")}
                />
              </g>
            ) : (
              <g id="posterior">
                {/* Back (Traps & Lats) */}
                <path
                  d="M 58 44 C 70 38 90 38 102 44 C 106 68 96 90 80 94 C 64 90 54 68 58 44 Z"
                  fill={getColor("Back")}
                  stroke={getStroke("Back")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Back")}
                />

                {/* Shoulders Back */}
                <path
                  d="M 48 42 C 40 46 36 56 36 62 C 44 62 52 56 56 46 Z"
                  fill={getColor("Shoulders")}
                  stroke={getStroke("Shoulders")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Shoulders")}
                />
                <path
                  d="M 112 42 C 120 46 124 56 124 62 C 116 62 108 56 104 46 Z"
                  fill={getColor("Shoulders")}
                  stroke={getStroke("Shoulders")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Shoulders")}
                />

                {/* Triceps / Arms Back */}
                <path
                  d="M 35 66 C 30 76 28 92 26 106 C 31 108 36 98 40 86 C 42 78 40 68 35 66 Z"
                  fill={getColor("Arms")}
                  stroke={getStroke("Arms")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Arms")}
                />
                <path
                  d="M 125 66 C 130 76 132 92 134 106 C 129 108 124 98 120 86 C 118 78 120 68 125 66 Z"
                  fill={getColor("Arms")}
                  stroke={getStroke("Arms")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Arms")}
                />

                {/* Hamstrings / Glutes */}
                <path
                  d="M 54 116 C 50 145 48 180 52 208 C 60 210 68 190 72 170 C 76 150 74 126 68 116 Z"
                  fill={getColor("Legs")}
                  stroke={getStroke("Legs")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Legs")}
                />
                <path
                  d="M 106 116 C 110 145 112 180 108 208 C 100 210 92 190 88 170 C 84 150 86 126 92 116 Z"
                  fill={getColor("Legs")}
                  stroke={getStroke("Legs")}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedZone("Legs")}
                />
              </g>
            )}
          </svg>
        </div>

        {/* Selected Zone Detail Card */}
        <div className="w-full sm:w-60 flex flex-col justify-center">
          {active ? (
            <div className="rounded-2xl bg-[var(--fill)] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                Selected Muscle
              </div>
              <div className="text-[20px] font-bold text-[var(--ink)] mt-0.5">{active.zone}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="num text-[28px] font-bold leading-none">{active.sets}</span>
                <span className="text-[13px] text-[var(--ink-2)] font-medium">
                  {active.sets === 1 ? "set" : "sets"} this week
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: active.color }}
                />
                <span className="text-[12px] font-semibold capitalize text-[var(--ink-2)]">
                  {active.level === "untrained"
                    ? "Untrained / Rested"
                    : `${active.level} volume`}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center text-[13px] text-[var(--ink-3)]">
              Tap any muscle group on the silhouette to inspect volume.
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-[var(--ink-3)] px-1">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--line)]" /> 0 sets
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#0ea5e9]" /> 1-4
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#eab308]" /> 5-9
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#f97316]" /> 10+
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
