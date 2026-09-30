import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Barbell } from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle";
import { signIn, signUp } from "../lib/data";

export default function Auth() {
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
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      navigate(returnTo, { replace: true });
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code.includes("email-already-in-use"))
        setError("That email already has an account. Sign in instead.");
      else if (code.includes("invalid-email"))
        setError("That email doesn't look right.");
      else if (code.includes("weak-password"))
        setError("Password should be at least 6 characters.");
      else if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
        setError("That email and password don't match.");
      else
        setError(
          mode === "signup"
            ? "Couldn't create the account."
            : "Sign-in failed. Try again."
        );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col px-6 pt-[max(env(safe-area-inset-top),80px)]">
      <ThemeToggle fixed />
      <div className="flex items-center gap-2">
        <Barbell size={20} weight="bold" />
        <span className="text-[16px] font-semibold tracking-tight">Reprange</span>
      </div>

      <h1 className="mt-12 text-[36px] font-bold leading-[1.05] tracking-[-0.03em]">
        {mode === "signin" ? "Welcome back." : "Start training."}
      </h1>
      <p className="mt-2 text-[15px] text-[var(--ink-2)]">
        {mode === "signin"
          ? "Sign in to continue your streak."
          : "Create an account to log your first workout."}
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            className="field"
            type="email"
            required
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="next"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            className="field"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            enterKeyHint="go"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-[13px] font-medium text-[var(--ink)]">{error}</p>}
        <button type="submit" className="btn-solid mt-2 w-full" disabled={busy}>
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="tab mt-6 pb-8 text-center text-[14px] font-medium transition-opacity active:opacity-60"
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
