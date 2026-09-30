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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas">
      <div className="mx-auto flex w-full max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${
                isActive ? "text-ink" : "text-ink-3"
              }`
            }
          >
            <Icon size={22} weight={undefined} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
