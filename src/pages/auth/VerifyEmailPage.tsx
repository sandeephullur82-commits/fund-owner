import React, { useState, useRef, useEffect } from "react";
import { useSignUp } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import AuthLayout from "./AuthLayout";

export default function VerifyEmailPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const email = sessionStorage.getItem("fc_signup_email") || "";

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  useEffect(() => {
    if (!isLoaded) return;
    if (signUp?.status === "complete" && signUp.createdSessionId && setActive) {
      console.log("[FC VerifyEmail] Already complete — activating session");
      setActive({ session: signUp.createdSessionId }).then(() => {
        console.log("[FC VerifyEmail] Session active — redirecting to /auth/callback");
        navigate("/auth/callback", { replace: true });
      });
    }
    if (!signUp || (signUp.status !== "missing_requirements" && signUp.status !== null)) {
      if (isLoaded && !signUp?.id) {
        navigate("/auth/sign-up", { replace: true });
      }
    }
  }, [isLoaded, signUp?.status, signUp?.createdSessionId]);

  const handleChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    const updated = [...otp];
    updated[index] = value.slice(-1);
    setOtp(updated);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (digits.length > 0) {
      const filled = [...otp];
      digits.split("").forEach((d, i) => {
        if (i < 6) filled[i] = d;
      });
      setOtp(filled);
      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp || loading) return;
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      console.log("[FC VerifyEmail] Attempting verification…");
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        console.log("[FC VerifyEmail] Verification success — activating session");
        await setActive({ session: result.createdSessionId });
        sessionStorage.removeItem("fc_signup_email");
        console.log("[FC VerifyEmail] Session active — redirecting to /auth/callback");
        // Navigate to /auth/callback which properly resolves the role and redirects
        // (avoids blank-screen flash from <SignedIn> race condition on /router)
        navigate("/auth/callback", { replace: true });
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        "Invalid or expired code. Please try again.";
      setError(msg);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!isLoaded || !signUp || countdown > 0 || resending) return;
    setResending(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setOtp(["", "", "", "", "", ""]);
      setError("");
      setCountdown(60);
      inputRefs.current[0]?.focus();
      toast.success("A new code has been sent to your email.");
    } catch {
      toast.error("Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 backdrop-blur-2xl shadow-2xl shadow-black/50">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-600/25 to-blue-600/25">
            <Mail className="h-6 w-6 text-violet-400" />
          </div>
          <h2 className="text-[1.6rem] font-bold text-white leading-tight">Check your email</h2>
          <p className="mt-1.5 text-sm text-white/45">
            We sent a 6-digit verification code to{" "}
            {email && (
              <span className="font-semibold text-white/70">{email}</span>
            )}
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 text-center">
              {error}
            </div>
          )}

          <div className="flex items-center justify-center gap-2.5" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                autoFocus={i === 0}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-12 w-11 rounded-xl border border-white/[0.12] bg-white/[0.07] text-center text-xl font-bold text-white outline-none transition focus:border-violet-500/70 focus:bg-white/[0.11] focus:ring-2 focus:ring-violet-500/25 caret-violet-400 selection:bg-violet-500/30"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join("").length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:from-violet-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              "Verify email"
            )}
          </button>

          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-white/30">Resend code in {countdown}s</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                {resending ? "Sending…" : "Resend code"}
              </button>
            )}
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
