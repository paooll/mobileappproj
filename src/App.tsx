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
import Feed from "./pages/Feed";
import Progress from "./pages/Progress";
import Brain from "./pages/Brain";
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

/**
 * A read that failed is not the same as a read that came back empty. Treating
 * them alike is what sent a finished setup back to the first question: the
 * profile was saved, the follow-up read blipped on a weak connection, and the
 * guard decided the athlete had never onboarded.
 */
function ReadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="label">Can’t reach your account</p>
      <p className="max-w-[32ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
        Your training is safe. The connection dropped while loading it.
      </p>
      <button onClick={onRetry} className="btn-solid px-6">
        Try again
      </button>
    </div>
  );
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
  // Separate from profile, because null means "no profile" and only that should
  // send someone to onboarding.
  const [readFailed, setReadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

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
    setReadFailed(false);
    loadProfile(user.uid)
      .then((p) => {
        if (cancelled) return;
        cachedUid = user.uid;
        cachedProfile = p;
        setProfile(p);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(undefined);
        setReadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, attempt]);

  if (user === undefined) return <Splash />;
  if (!user)
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`} replace />;

  if (readFailed)
    return <ReadFailed onRetry={() => setAttempt((n) => n + 1)} />;
  if (profile === undefined) return <Splash />;

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
        path="/app/brain"
        element={
          <RequireAuth>
            {(profile) => <Brain profile={profile} />}
          </RequireAuth>
        }
      />
      <Route
        path="/app/feed"
        element={
          <RequireAuth>
            {(profile) => <Feed profile={profile} />}
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
