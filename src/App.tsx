import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "./convex/_generated/api";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Today from "./pages/Today";
import ActiveWorkout from "./pages/ActiveWorkout";
import History from "./pages/History";
import Exercises from "./pages/Exercises";
import Profile from "./pages/Profile";
import TabBar from "./components/TabBar";
import AppBootstrap from "./components/AppBootstrap";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const userId = useQuery(api.users.loggedInUser);
  const location = useLocation();
  if (userId === undefined)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-ink" />
      </div>
    );
  if (!userId)
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  return (
    <div className="mx-auto min-h-screen w-full max-w-md pb-24">
      <AppBootstrap />
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
