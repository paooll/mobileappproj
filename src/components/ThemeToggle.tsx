import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle({ fixed = false }: { fixed?: boolean }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={`icon-btn ${fixed ? "fixed right-4 top-4 z-50" : ""}`}
      style={
        fixed
          ? { top: "max(env(safe-area-inset-top), 12px)", right: 16 }
          : undefined
      }
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun size={19} weight="duotone" />
      ) : (
        <Moon size={19} weight="duotone" />
      )}
    </button>
  );
}
