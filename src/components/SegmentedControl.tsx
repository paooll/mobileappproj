interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Weight unit". */
  label: string;
  disabled?: boolean;
}

/**
 * One of a few fixed choices, chosen in place. A real radio group would need
 * extra markup to look right on a phone, and this is used everywhere a short
 * row of alternatives belongs: unit, plate increment, rest length, digest day.
 */
export default function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled = false,
}: Props<T>) {
  return (
    <div
      className="flex shrink-0 gap-1 p-1"
      style={{ background: "var(--fill)" }}
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          disabled={disabled}
          // 44px: the smallest target a thumb hits without aiming
          className="tab flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-1 text-[13px] font-semibold transition-colors disabled:opacity-50"
          style={{
            background: value === o.value ? "var(--ink)" : "transparent",
            color: value === o.value ? "var(--bg)" : "var(--ink-2)",
          }}
        >
          <span className="truncate">{o.label}</span>
        </button>
      ))}
    </div>
  );
}