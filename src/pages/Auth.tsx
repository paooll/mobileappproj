import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Barbell } from "@phosphor-icons/react";

export default function Auth() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") || "/app";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn("password", {
        email,
        password,
        flow: mode === "signup" ? "signUp" : "signIn",
      });
      navigate(returnTo, { replace: true });
    } catch {
      setError(
        mode === "signup"
          ? "Couldn't create the account. Try a longer password."
          : "That email and password don't match."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col px-6 pt-24">
      <div className="flex items-center gap-2">
        <Barbell size={20} weight="bold" />
        <span className="text-[16px] font-semibold tracking-tight">Reprange</span>
      </div>

      <h1 className="mt-12 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em]">
        {mode === "signin" ? "Welcome back." : "Start training."}
      </h1>
      <p className="mt-2 text-[15px] text-ink-2">
        {mode === "signin"
          ? "Sign in to continue your streak."
          : "Create an account to log your first workout."}
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="meta">
            Email
          </label>
          <input
            id="email"
            className="field"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="meta">
            Password
          </label>
          <input
            id="password"
            className="field"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>
        {error && (
          <p className="rounded-lg bg-pale-red px-3 py-2 text-[13px] font-medium text-pale-redtext">
            {error}
          </p>
        )}
        <button type="submit" className="btn-solid mt-2 w-full" disabled={busy}>
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="mt-6 text-center text-[14px] font-medium text-spot"
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
