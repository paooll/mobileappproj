import { NavLink } from "react-router-dom";
import {
  Barbell,
  ClockCounterClockwise,
  Archive,
  User,
  UsersThree,
} from "@phosphor-icons/react";

const tabs = [
  { to: "/app", label: "Today", icon: Barbell, end: true },
  { to: "/app/history", label: "History", icon: ClockCounterClockwise, end: false },
  { to: "/app/feed", label: "Feed", icon: UsersThree, end: false },
  { to: "/app/exercises", label: "Library", icon: Archive, end: false },
  { to: "/app/profile", label: "Profile", icon: User, end: false },
];

export default function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
      <div className="glass mx-auto flex w-full max-w-md items-stretch justify-around rounded-2xl p-1 shadow-[var(--shadow-float)]">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `tab flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-colors ${
                isActive
                  ? "bg-[var(--fill)] text-[var(--ink)]"
                  : "text-[var(--ink-3)]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* The glyph itself carries the active state, so the tab reads
                    as selected even at a glance or to a screen reader */}
                <Icon size={22} weight={isActive ? "fill" : "regular"} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
