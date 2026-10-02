interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  /** Stands in for the first chip when it is an "everything" option. */
  label: string;
}

/** Horizontal scroll-snap row of filter chips, matching the app's quiet-button style. */
export default function ChipRow({ options, value, onChange, label }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className="btn-quiet shrink-0"
          style={value === o ? { background: "var(--ink)", color: "var(--bg)" } : undefined}
        >
          {o === "All" ? label : o}
        </button>
      ))}
    </div>
  );
}