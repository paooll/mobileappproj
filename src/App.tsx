import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuthUser } from "./hooks/useAuthUser";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Today from "./pages/Today";
import ActiveWorkout from "./pages/ActiveWorkout";
import History from "./pages/History";
import Exercises from "./pages/Exercises";
import Profile from "./pages/Profile";
import TabBar from "./components/TabBar";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthUser();
  const location = useLocation();
  if (user === undefined)
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
        <div className="h-9 w-40 animate-pulse rounded-xl bg-[var(--fill)]" />
      </div>
    );
  if (!user)
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-md pb-32">
      {children}
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
        path="/app"
        element={
          <RequireAuth>
            <Today />
          </RequireAuth>
        }
      />
      <Route
        path="/app/workout/:id"
        element={
          <RequireAuth>
            <ActiveWorkout />
          </RequireAuth>
        }
      />
      <Route
        path="/app/history"
        element={
          <RequireAuth>
            <History />
          </RequireAuth>
        }
      />
      <Route
        path="/app/exercises"
        element={
          <RequireAuth>
            <Exercises />
          </RequireAuth>
        }
      />
      <Route
        path="/app/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
