import React, { useState } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, ArrowLeft, KeyRound, CheckCircle, Mail } from "lucide-react";
import AuthLayout from "./AuthLayout";

export default function ForgotPasswordPage() {
  const { isLoaded, signIn } = useSignIn();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const validateEmail = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn || loading) return;

    const identifier = email.trim().toLowerCase();
    if (!validateEmail(identifier)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier,
      });

      sessionStorage.setItem("fc_reset_email", identifier);
      setSent(true);

      setTimeout(() => {
        navigate("/auth/reset-password", { replace: true });
      }, 1800);
    } catch (err: any) {
      const clerkErr = err?.errors?.[0];
      const code = clerkErr?.code ?? "";

      if (code === "too_many_requests") {
        setError("Too many attempts. Please wait a moment and try again.");
      } else if (["form_identifier_not_found", "form_identifier_invalid", "user_not_found"].includes(code)) {
        setError("No account found with that email address.");
      } else if (code === "strategy_for_user_invalid") {
        setError("Password reset is not available for this account. Try signing in with your original provider.");
      } else if (["form_param_nil", "form_identifier_missing"].includes(code)) {
        setError("Please enter your email address.");
      } else {
        setError(clerkErr?.longMessage || clerkErr?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout hideBackButton>
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 backdrop-blur-2xl shadow-2xl shadow-black/50 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 mx-auto">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-[1.4rem] font-bold text-white leading-tight">Code sent!</h2>
          <p className="mt-2 text-sm text-white/50">
            A 6-digit verification code was sent to
          </p>
          <p className="mt-1 text-sm font-semibold text-white/80 break-all">{email}</p>
          <p className="mt-5 text-xs text-white/35">
            Taking you to verification… Check your spam folder if you don't see it.
          </p>
          <div className="mt-4 flex justify-center">
            <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 backdrop-blur-2xl shadow-2xl shadow-black/50">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-600/25 to-blue-600/25">
            <KeyRound className="h-6 w-6 text-violet-400" />
          </div>
          <h2 className="text-[1.6rem] font-bold text-white leading-tight">Forgot password?</h2>
          <p className="mt-1.5 text-sm text-white/45">
            Enter your email and we'll send you a reset code
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value.toLowerCase()); if (error) setError(""); }}
                placeholder="you@example.com"
                required
                autoFocus
                disabled={loading}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.06] pl-10 pr-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:from-violet-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Sending code…</>
            ) : (
              "Send Reset Code"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/auth/sign-in"
            className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
