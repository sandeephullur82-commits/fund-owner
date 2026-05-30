import React, { useState, useEffect } from "react";
import { useSignIn, useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import AuthLayout from "./AuthLayout";

// ─── Clerk error → human-readable message ────────────────────────────────────
function clerkErrorMessage(err: any): string {
  const code  = err?.errors?.[0]?.code        ?? "";
  const long  = err?.errors?.[0]?.longMessage  ?? "";
  const short = err?.errors?.[0]?.message      ?? "";

  console.error("[FC SignIn] Clerk error — code:", code, "| message:", long || short);

  if (code === "form_password_incorrect")      return "Incorrect password. Please try again.";
  if (code === "form_identifier_not_found")    return "No account found with that email address.";
  if (code === "form_param_format_invalid")    return "Please enter a valid email address.";
  if (code === "too_many_requests")            return "Too many attempts. Please wait a moment and try again.";
  if (code === "session_exists")               return "You are already signed in. Redirecting…";
  if (code === "user_locked")                  return "This account has been locked. Please contact support.";
  if (code === "strategy_for_user_invalid")    return "Password is not set up for this account. Use 'Forgot password' to create one.";
  if (code === "form_identifier_exists")       return "An account with this email already exists.";
  if (code === "verification_expired")         return "Verification code expired. Please request a new one.";
  if (code === "not_allowed_access")           return "Access denied. Your account may be suspended.";
  if (code === "organization_not_found")       return "Your organization could not be found. Contact your administrator.";

  const raw = long || short || code || "Unknown Clerk error";
  return `Sign-in failed: ${raw}`;
}

export default function SignInPage() {
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { isLoaded, signIn, setActive }       = useSignIn();
  const clerk                                  = useClerk();
  const navigate                               = useNavigate();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  // Already signed in → skip straight to role router
  useEffect(() => {
    if (userLoaded && isSignedIn) {
      console.log("[FC SignIn] Already signed in — redirecting to /router");
      navigate("/router", { replace: true });
    }
  }, [userLoaded, isSignedIn, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn || !setActive || loading) return;
    setError("");
    setLoading(true);

    const identifier = email.trim().toLowerCase();
    console.log("════════════════════════════════════════════════");
    console.log("[FC SignIn] ▶ Attempting sign-in for:", identifier);
    console.log("════════════════════════════════════════════════");

    try {
      // Sign out any stale session first
      if (isSignedIn) {
        console.log("[FC SignIn] Clearing stale session…");
        await clerk.signOut();
      }

      const result = await signIn.create({ identifier, password });
      const status = result.status as string;

      console.log("[FC SignIn] signIn.create() →");
      console.log("[FC SignIn]   status          :", status);
      console.log("[FC SignIn]   createdSessionId:", result.createdSessionId ?? "null");
      console.log("[FC SignIn]   role + route    : (resolved by /router after setActive)");

      // ── complete ────────────────────────────────────────────────────────
      if (status === "complete") {
        // createdSessionId is null when a prior flow (e.g. invitation acceptance)
        // already activated the session — setActive is not needed in that case.
        if (result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        } else {
          console.warn("[FC SignIn] status=complete, sessionId=null — session already active");
        }
        console.log("[FC SignIn] ✓ Authenticated — redirecting to /router");
        navigate("/router", { replace: true });
        return;
      }

      // ── needs_second_factor (MFA) ────────────────────────────────────────
      if (status === "needs_second_factor") {
        console.warn("[FC SignIn] MFA required — not supported");
        setError(
          "Your account has multi-factor authentication enabled. " +
          "MFA is not currently supported. Ask your administrator to disable it."
        );
        return;
      }

      // ── needs_first_factor ──────────────────────────────────────────────
      if (status === "needs_first_factor") {
        const strategies = result.supportedFirstFactors?.map((f: any) => f.strategy) ?? [];
        console.warn("[FC SignIn] needs_first_factor — strategies:", strategies);
        setError(
          strategies.includes("password")
            ? "Additional verification required. Please try again or use 'Forgot password'."
            : "No password is set on this account. Use 'Forgot password' to create one."
        );
        return;
      }

      // ── needs_new_password ───────────────────────────────────────────────
      if (status === "needs_new_password") {
        setError("Your password has expired. Use 'Forgot password' to set a new one.");
        return;
      }

      // ── needs_identifier ─────────────────────────────────────────────────
      if (status === "needs_identifier") {
        setError("Please enter your email address.");
        return;
      }

      // ── any other status — attempt recovery ──────────────────────────────
      // Do NOT show raw Clerk status strings. Try setActive if we have a session,
      // otherwise ask the user to try again.
      console.warn("[FC SignIn] Unexpected status:", status);
      if (result.createdSessionId) {
        console.log("[FC SignIn] Recovery: activating available session…");
        await setActive({ session: result.createdSessionId });
        navigate("/router", { replace: true });
        return;
      }
      try { await clerk.signOut(); } catch { /* ignore */ }
      setError("Sign-in could not be completed. Please try again.");

    } catch (err: any) {
      console.error("[FC SignIn] Exception:", err);

      if (err?.errors?.[0]?.code === "session_exists") {
        navigate("/router", { replace: true });
        return;
      }

      setError(clerkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="rounded-3xl border border-white/[0.14] bg-white/[0.07] p-8 backdrop-blur-2xl shadow-2xl shadow-black/70 ring-1 ring-inset ring-white/[0.05]">
        <div className="mb-7">
          <h2 className="text-[1.6rem] font-bold text-white leading-tight">Welcome back</h2>
          <p className="mt-1.5 text-sm text-white/85">Sign in to your FundCircle account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/12 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/95">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              autoComplete="email"
              className="w-full rounded-xl border border-white/[0.13] bg-white/[0.07] px-4 py-3 text-sm text-white placeholder-white/50 outline-none transition focus:border-violet-500/70 focus:bg-white/[0.11] focus:ring-2 focus:ring-violet-500/25"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/95">
                Password
              </label>
              <Link to="/auth/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/[0.13] bg-white/[0.07] px-4 py-3 pr-11 text-sm text-white placeholder-white/50 outline-none transition focus:border-violet-500/70 focus:bg-white/[0.11] focus:ring-2 focus:ring-violet-500/25"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/75 transition-colors"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:from-violet-500 hover:to-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>) : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/65">
          Don&apos;t have an account?{" "}
          <Link to="/auth/sign-up" className="font-semibold text-violet-400 hover:text-violet-300 transition-colors">
            Create account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
