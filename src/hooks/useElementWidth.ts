import { useEffect, useRef, useState } from "react";

/**
 * Measures an element so SVG charts can be drawn at real pixel widths. Scaling a
 * fixed viewBox instead would distort stroke widths on a narrow phone.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measured = el.getBoundingClientRect().width;
    if (measured > 0) setWidth(measured);

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}