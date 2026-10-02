import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuthUser } from "./hooks/useAuthUser";
import { loadProfile, type UserProfile } from "./lib/profile";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Today from "./pages/Today";
import ActiveWorkout from "./pages/ActiveWorkout";
import History from "./pages/History";
import Progress from "./pages/Progress";
import Exercises from "./pages/Exercises";
import Profile from "./pages/Profile";
import TabBar from "./components/TabBar";

function Splash() {
  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <div className="h-9 w-40 animate-pulse rounded-xl bg-[var(--fill)]" />
    </div>
  );
}

/** Caches the profile per uid so the guard does not re-read on every route change. */
let cachedUid: string | null = null;
let cachedProfile: UserProfile | null = null;

/** Auth only — used by onboarding, which must stay reachable before a profile exists. */
function RequireUser({ children }: { children: React.ReactNode }) {
  const user = useAuthUser();
  const location = useLocation();
  if (user === undefined) return <Splash />;
  if (!user)
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

function RequireAuth({
  children,
}: {
  children: (profile: UserProfile) => React.ReactNode;
}) {
  const user = useAuthUser();
  const location = useLocation();
  const [profile, setProfile] = useState<UserProfile | null | undefined>(() =>
    cachedUid ? cachedProfile : undefined
  );

  useEffect(() => {
    if (!user) {
      cachedUid = null;
      cachedProfile = null;
      return;
    }
    if (cachedUid === user.uid) {
      setProfile(cachedProfile);
      return;
    }
    let cancelled = false;
    loadProfile(user.uid)
      .then((p) => {
        if (cancelled) return;
        cachedUid = user.uid;
        cachedProfile = p;
        setProfile(p);
      })
      .catch(() => {
        // A failed read must not trap the user out of the app. Treat as onboarded.
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (user === undefined || profile === undefined) return <Splash />;
  if (!user)
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`} replace />;

  // Cold start: brand new accounts go through setup before the app.
  if (!profile) return <Navigate to="/onboarding" replace />;

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-md pb-32">
      {children(profile)}
      <TabBar />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/onboarding"
        element={
          <RequireUser>
            <Onboarding />
          </RequireUser>
        }
      />
      <Route
        path="/app"
        element={
          <RequireAuth>
            {(profile) => <Today profile={profile} />}
          </RequireAuth>
        }
      />
      <Route
        path="/app/workout/:id"
        element={
          <RequireAuth>
            {(profile) => <ActiveWorkout profile={profile} />}
          </RequireAuth>
        }
      />
      <Route
        path="/app/history"
        element={
          <RequireAuth>
            {() => <History />}
          </RequireAuth>
        }
      />
      <Route
        path="/app/progress"
        element={
          <RequireAuth>
            {() => <Progress />}
          </RequireAuth>
        }
      />
      <Route
        path="/app/exercises"
        element={
          <RequireAuth>
            {() => <Exercises />}
          </RequireAuth>
        }
      />
      <Route
        path="/app/profile"
        element={
          <RequireAuth>
            {(profile) => <Profile profile={profile} />}
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
