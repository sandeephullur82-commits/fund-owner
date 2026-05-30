import React, { useState, useEffect } from "react";
import { useSignIn, useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, AlertCircle, Bug } from "lucide-react";
import AuthLayout from "./AuthLayout";

const DEV = import.meta.env.DEV;

// ─── Clerk error → human-readable message ────────────────────────────────────
function clerkErrorMessage(err: any): string {
  const code  = err?.errors?.[0]?.code        ?? "";
  const long  = err?.errors?.[0]?.longMessage  ?? "";
  const short = err?.errors?.[0]?.message      ?? "";
  const raw   = long || short || code || "Unknown error";

  if (code === "form_password_incorrect")      return "Incorrect password. Please try again.";
  if (code === "form_identifier_not_found")    return "No account found with that email address.";
  if (code === "form_param_format_invalid")    return "Please enter a valid email address.";
  if (code === "too_many_requests")            return "Too many attempts. Please wait a moment and try again.";
  if (code === "session_exists")               return "You are already signed in.";
  if (code === "user_locked")                  return "This account has been locked. Please contact support.";
  if (code === "strategy_for_user_invalid")    return "Password is not set up for this account. Use 'Forgot password' to create one.";
  if (code === "form_identifier_exists")       return "An account with this email already exists.";
  if (code === "verification_expired")         return "Verification code expired. Please request a new one.";
  if (code === "not_allowed_access")           return "Access denied. Your account may be suspended.";
  if (code === "organization_not_found")       return "Your organization could not be found. Contact your administrator.";
  if (code === "form_param_nil")               return "Email and password are required.";
  return `Sign-in failed: ${raw}`;
}

// ─── Dev error panel ──────────────────────────────────────────────────────────
function DevErrorPanel({ err }: { err: any }) {
  if (!err) return null;
  const firstError = err?.errors?.[0] ?? {};
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-mono space-y-1.5">
      <p className="font-bold text-amber-200 flex items-center gap-1.5">
        <Bug className="h-3.5 w-3.5" /> DEV — Raw Clerk Error
      </p>
      <div className="text-amber-300/90">
        <span className="text-amber-500/70">code: </span>
        {firstError.code ?? "—"}
      </div>
      <div className="text-amber-300/90">
        <span className="text-amber-500/70">message: </span>
        {firstError.longMessage ?? firstError.message ?? err?.message ?? "—"}
      </div>
      <div className="text-amber-300/90">
        <span className="text-amber-500/70">meta: </span>
        {firstError.meta ? JSON.stringify(firstError.meta) : "—"}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-amber-400/60 hover:text-amber-300 transition-colors">
          Full errors array ▸
        </summary>
        <pre className="mt-2 overflow-auto max-h-44 text-[10px] text-amber-300/70 whitespace-pre-wrap break-all">
          {JSON.stringify(err?.errors ?? err, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function SignInPage() {
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { isLoaded, signIn, setActive }       = useSignIn();
  const clerk                                  = useClerk();
  const navigate                               = useNavigate();

  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [rawClerkError, setRawClerkError] = useState<any>(null);

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
    setRawClerkError(null);
    setLoading(true);

    const identifier = email.trim().toLowerCase();

    // ════════════════════════════════════════════════
    console.log("════════════════════════════════════════════════");
    console.log("[FC STEP 7] ▶ Sign-in attempt");
    console.log("[FC STEP 7]   identifier :", identifier);
    console.log("[FC STEP 7]   timestamp  :", new Date().toISOString());
    console.log("════════════════════════════════════════════════");

    try {
      if (isSignedIn) {
        console.log("[FC STEP 7] Clearing stale Clerk session before new sign-in…");
        await clerk.signOut();
      }

      console.log("[FC STEP 7] Calling signIn.create({ identifier, password })…");
      const result = await signIn.create({ identifier, password });
      const status = result.status as string;

      console.log("[FC STEP 7] signIn.create() result:");
      console.log("[FC STEP 7]   status           :", status);
      console.log("[FC STEP 7]   createdSessionId :", result.createdSessionId ?? "null");
      console.log("[FC STEP 7]   firstFactorVerification:", (result as any).firstFactorVerification?.status ?? "—");

      if (status === "complete") {
        // ── STEP 8: Session creation ────────────────────────────────────────
        console.log("────────────────────────────────────────────");
        console.log("[FC STEP 8] ▶ Session creation — calling setActive()");
        console.log("[FC STEP 8]   sessionId :", result.createdSessionId ?? "null (already active)");

        if (result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
          console.log("[FC STEP 8] ✓ Session activated — sessionId:", result.createdSessionId);
        } else {
          console.warn("[FC STEP 8] status=complete but sessionId=null — session already active, continuing");
        }

        console.log("[FC STEP 8] → Redirecting to /router (role resolution next)");
        console.log("────────────────────────────────────────────");
        navigate("/router", { replace: true });
        return;
      }

      // ── Unexpected status — attempt recovery with available session ──────
      console.warn("[FC STEP 7] Unexpected status:", status);
      if (result.createdSessionId) {
        console.log("[FC STEP 8] Recovery: activating available session despite status:", status);
        await setActive({ session: result.createdSessionId });
        navigate("/router", { replace: true });
        return;
      }

      try { await clerk.signOut(); } catch { /* ignore */ }
      setError("Sign-in failed. Please check your credentials and try again.");

    } catch (err: any) {
      const code = err?.errors?.[0]?.code ?? "unknown";
      const msg  = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? "unknown";

      console.error("════════════════════════════════════════════════");
      console.error("[FC STEP 7] ✗ signIn.create() threw an exception");
      console.error("[FC STEP 7]   error.code    :", code);
      console.error("[FC STEP 7]   error.message :", msg);
      console.error("[FC STEP 7]   error.errors  :", err?.errors ?? "none");
      console.error("[FC STEP 7]   full error    :", err);
      console.error("════════════════════════════════════════════════");

      setRawClerkError(err);

      if (code === "session_exists") {
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

          {DEV && rawClerkError && <DevErrorPanel err={rawClerkError} />}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/95">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setRawClerkError(null); }}
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
                onChange={e => { setPassword(e.target.value); setRawClerkError(null); }}
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
