import React, { useState, useEffect } from "react";
import { useSignIn, useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, AlertCircle, ChevronDown, Mail } from "lucide-react";
import AuthLayout from "./AuthLayout";

// ─── Type helpers ────────────────────────────────────────────────────────────
// Clerk's TypeScript types lag behind the runtime API — `needs_client_trust`
// and future status strings are not yet in the SignInStatus union.
type RuntimeSignInStatus =
  | "complete"
  | "needs_identifier"
  | "needs_first_factor"
  | "needs_second_factor"
  | "needs_new_password"
  | "needs_client_trust"   // Client Trust system — new in Clerk's 2025 API
  | (string & {});          // allow unknown future statuses without breaking TypeScript

// ClientTrustState: 'new' | 'known' | 'pending'
type ClientTrustState = string | null | undefined;

// ─── Clerk error → human readable ────────────────────────────────────────────
function clerkErrorMessage(err: any): string {
  const code  = err?.errors?.[0]?.code        ?? "";
  const long  = err?.errors?.[0]?.longMessage  ?? "";
  const short = err?.errors?.[0]?.message      ?? "";

  console.error(
    "[FC SignIn] Clerk exception — code:", code,
    "| long:", long,
    "| short:", short,
    "| full:", JSON.stringify(err?.errors ?? err, null, 2)
  );

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
  if (code.includes("client_trust"))           return "This sign-in requires device verification. Please check your email for a verification link.";

  const raw = long || short || code || "Unknown Clerk error";
  return `Sign-in failed: ${raw}`;
}

// ─── Dev diagnostic panel ─────────────────────────────────────────────────────
function DiagPanel({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  if (!import.meta.env.DEV) return null;
  return (
    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-900/20 text-xs">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-3 py-2 font-mono text-amber-300 hover:bg-amber-500/10"
      >
        <span>[DEV] Clerk diagnostic data</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <pre className="overflow-x-auto px-3 pb-3 text-amber-200/80 leading-relaxed whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Client Trust pending notice ──────────────────────────────────────────────
function ClientTrustNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/25 bg-blue-500/12 px-4 py-3 text-sm text-blue-200">
      <Mail className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
      <div>
        <p className="font-medium text-blue-200">Device verification required</p>
        <p className="mt-0.5 text-blue-300/80 text-xs">
          Clerk sent a verification email to confirm this device.
          Click the link in that email to complete sign-in, then return here.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SignInPage() {
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { isLoaded, signIn, setActive }       = useSignIn();
  const clerk                                  = useClerk();
  const navigate                               = useNavigate();

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [clientTrustPending, setClientTrustPending] = useState(false);
  const [diagData, setDiagData]     = useState<any>(null);

  // Already signed in → skip straight to router
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
    setClientTrustPending(false);
    setDiagData(null);
    setLoading(true);

    const identifier = email.trim().toLowerCase();

    console.log("════════════════════════════════════════════════");
    console.log("[FC SignIn] ▶ Sign-in attempt");
    console.log("[FC SignIn]   identifier        :", identifier);
    console.log("[FC SignIn]   signIn.status (pre):", signIn.status ?? "null");
    console.log("[FC SignIn]   isSignedIn        :", isSignedIn);
    console.log("════════════════════════════════════════════════");

    try {
      // Clear any stale session so Clerk doesn't return session_exists
      if (isSignedIn) {
        console.log("[FC SignIn] Signing out stale session…");
        await clerk.signOut();
      }

      const result = await signIn.create({ identifier, password });

      // ── Extract all relevant fields ────────────────────────────────────────
      const status          = result.status as RuntimeSignInStatus;
      const createdSessionId = result.createdSessionId;
      const clientTrustState: ClientTrustState = (result as any).clientTrustState ?? null;
      const ffVerification  = result.firstFactorVerification;

      const diag = {
        "signIn.status"      : status,
        createdSessionId,
        clientTrustStatus    : clientTrustState,
        "firstFactor.status" : ffVerification?.status,
        "firstFactor.strategy": ffVerification?.strategy,
        "supportedFactors"   : result.supportedFirstFactors?.map((f: any) => f.strategy),
        role                 : "(resolved by /router after session is active)",
        redirectRoute        : "(resolved by /router based on Firestore role)",
      };

      console.log("[FC SignIn] signIn.create() result:");
      console.log("[FC SignIn]   signIn.status    :", status);
      console.log("[FC SignIn]   createdSessionId :", createdSessionId ?? "null");
      console.log("[FC SignIn]   clientTrustStatus:", clientTrustState ?? "null");
      console.log("[FC SignIn]   role             : (resolved by /router)");
      console.log("[FC SignIn]   redirectRoute    : (resolved by /router)");
      setDiagData(diag);

      // ── COMPLETE ──────────────────────────────────────────────────────────
      if (status === "complete") {
        if (clientTrustState === "pending") {
          // Trust is async — device verification is happening in the background.
          // The session is still valid; Clerk will upgrade the trust level once verified.
          console.warn("[FC SignIn] status=complete but clientTrustState=pending");
          console.warn("[FC SignIn] Proceeding — device trust upgrade happens asynchronously");
        }
        if (createdSessionId) {
          console.log("[FC SignIn] ✓ Activating session:", createdSessionId);
          await setActive({ session: createdSessionId });
          console.log("[FC SignIn] setActive() done");
        } else {
          // Session was already activated by a prior flow (e.g. invitation acceptance)
          console.warn("[FC SignIn] status=complete with null sessionId — session already active from prior flow");
        }
        console.log("[FC SignIn] → Redirecting to /router");
        navigate("/router", { replace: true });
        return;
      }

      // ── NEEDS_CLIENT_TRUST (Clerk Client Trust system, 2025+) ─────────────
      // Clerk's backend can return this status when signing in from an
      // unrecognized device/browser. clientTrustState will be 'new' or 'pending'.
      // The TypeScript type doesn't include it yet, so we compare as a string.
      if (status === "needs_client_trust") {
        console.warn("[FC SignIn] ⚠ needs_client_trust detected:");
        console.warn("[FC SignIn]   clientTrustState:", clientTrustState);
        console.warn("[FC SignIn]   createdSessionId:", createdSessionId);

        if (createdSessionId) {
          // Clerk gave us a session — activate it and proceed.
          // The trust verification may happen asynchronously via email.
          console.log("[FC SignIn]   createdSessionId present — activating session and proceeding");
          await setActive({ session: createdSessionId });
          navigate("/router", { replace: true });
          return;
        }

        // No session ID — Clerk sent a device-verification email.
        // We can't proceed without the user clicking that email link.
        console.warn("[FC SignIn]   No sessionId — Clerk sent a device-verification email");
        setClientTrustPending(true);
        return;
      }

      // ── NEEDS_SECOND_FACTOR (MFA) ─────────────────────────────────────────
      if (status === "needs_second_factor") {
        console.warn("[FC SignIn] MFA required — strategies:", result.supportedSecondFactors?.map((f: any) => f.strategy));
        setError(
          "Your account has multi-factor authentication enabled. " +
          "MFA is not currently supported. Ask your administrator to disable it."
        );
        return;
      }

      // ── NEEDS_FIRST_FACTOR ────────────────────────────────────────────────
      if (status === "needs_first_factor") {
        const strategies = result.supportedFirstFactors?.map((f: any) => f.strategy) ?? [];
        console.warn("[FC SignIn] needs_first_factor — available strategies:", strategies);
        if (!strategies.includes("password")) {
          setError(
            "No password is set on this account. " +
            "Use 'Forgot password' to create one, or sign in with your email link."
          );
        } else {
          setError("Additional verification required. Please try again or use 'Forgot password'.");
        }
        return;
      }

      // ── NEEDS_NEW_PASSWORD ────────────────────────────────────────────────
      if (status === "needs_new_password") {
        console.warn("[FC SignIn] needs_new_password");
        setError("Your password has expired and must be changed. Use 'Forgot password' to set a new one.");
        return;
      }

      // ── NEEDS_IDENTIFIER ──────────────────────────────────────────────────
      if (status === "needs_identifier") {
        console.warn("[FC SignIn] needs_identifier");
        setError("Please enter your email address.");
        return;
      }

      // ── UNKNOWN FUTURE STATUS — attempt graceful recovery ─────────────────
      // Never show raw status strings to the user. Try to recover if possible.
      console.error("[FC SignIn] ⚠ Unhandled status:", status, "| clientTrustState:", clientTrustState);
      console.error("[FC SignIn] Full result:", JSON.stringify(result, null, 2));

      if (createdSessionId) {
        // We have a session — try to activate it despite the unexpected status
        console.warn("[FC SignIn] Attempting recovery: activating available session:", createdSessionId);
        try {
          await setActive({ session: createdSessionId });
          navigate("/router", { replace: true });
          return;
        } catch (activateErr) {
          console.error("[FC SignIn] Recovery failed — setActive threw:", activateErr);
        }
      }

      // Hard failure — sign out and show actionable message
      try { await clerk.signOut(); } catch { /* ignore */ }
      setError(
        "Sign-in could not be completed. Please try again. " +
        "If the problem persists, clear your browser cookies and try in a private window."
      );

    } catch (err: any) {
      console.error("[FC SignIn] Exception in signIn.create():", err);
      console.error("[FC SignIn] Raw error:", JSON.stringify(err, null, 2));
      setDiagData({ exception: err?.errors ?? err });

      if (err?.errors?.[0]?.code === "session_exists") {
        console.log("[FC SignIn] session_exists error — redirecting to /router");
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
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/12 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Client Trust pending notice */}
          {clientTrustPending && <ClientTrustNotice />}

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

          {/* Try again after trust email */}
          {clientTrustPending ? (
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-blue-500 hover:to-violet-500 active:scale-[0.98] disabled:opacity-55"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Checking…</> : "I've verified — Try again"}
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:from-violet-500 hover:to-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? (<><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>) : "Sign in"}
            </button>
          )}
        </form>

        {/* Dev diagnostic panel */}
        {diagData && <DiagPanel data={diagData} />}

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
