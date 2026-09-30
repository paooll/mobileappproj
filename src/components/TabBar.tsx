import { NavLink } from "react-router-dom";
import {
  Barbell,
  ClockCounterClockwise,
  Archive,
  User,
} from "@phosphor-icons/react";

const tabs = [
  { to: "/app", label: "Today", icon: Barbell, end: true },
  { to: "/app/history", label: "History", icon: ClockCounterClockwise, end: false },
  { to: "/app/exercises", label: "Library", icon: Archive, end: false },
  { to: "/app/profile", label: "Profile", icon: User, end: false },
];

export default function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
      <div className="mx-auto flex w-full max-w-md items-stretch justify-around rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `tab flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-colors ${
                isActive
                  ? "bg-[var(--fill)] text-[var(--ink)]"
                  : "text-[var(--ink-3)]"
              }`
            }
          >
            <Icon size={21} weight={undefined} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
