import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Barbell, GoogleLogo } from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle";
import {
  signIn,
  signUp,
  signInWithGoogle,
  friendlyAuthError,
} from "../lib/data";
import { useToast } from "../components/Toast";

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") || "/app";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const { toast } = useToast();

  const go = () => navigate(returnTo, { replace: true });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Client-side validation before touching the network
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), password);
        toast("Account created — welcome to Reprange!", "success");
      } else {
        await signIn(email.trim(), password);
        toast("Signed in. Welcome back!", "success");
      }
      go();
    } catch (err) {
      const msg = friendlyAuthError(err, mode);
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setGoogleBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      toast("Signed in with Google!", "success");
      go();
    } catch (err) {
      const msg = friendlyAuthError(err, "google");
      // Silent cancel — no need to alarm the user
      if (!(err as { code?: string }).code?.includes("popup-closed-by-user"))
        toast(msg, "error");
    } finally {
      setGoogleBusy(false);
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
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={!!error}
            aria-describedby={error ? "auth-error" : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
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
            aria-invalid={!!error}
            aria-describedby={error ? "auth-error" : undefined}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>
        {error && (
          <p
            id="auth-error"
            role="alert"
            className="rounded-xl px-3 py-2.5 text-[13px] font-medium"
            style={{ background: "var(--fill)", color: "var(--danger)" }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn-solid mt-2 w-full"
          disabled={busy || googleBusy}
          style={busy || googleBusy ? { opacity: 0.6 } : undefined}
        >
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span className="label">or</span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <button
        onClick={google}
        disabled={busy || googleBusy}
        className="btn-line w-full"
        style={busy || googleBusy ? { opacity: 0.6 } : undefined}
      >
        <GoogleLogo size={17} weight="bold" />
        {googleBusy ? "Opening Google…" : "Continue with Google"}
      </button>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="tab mt-6 min-h-[44px] w-full pb-8 text-center text-[14px] font-medium transition-opacity active:opacity-60"
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
