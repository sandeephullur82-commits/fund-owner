import React, { useState, useRef, useEffect } from "react";
import { useSignUp } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, RefreshCw, Pencil } from "lucide-react";
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
      const status          = result.status as string;
      const createdSessionId = result.createdSessionId;
      const clientTrustState = (result as any).clientTrustState ?? null;
      console.log("[FC VerifyEmail] attemptEmailAddressVerification result:");
      console.log("[FC VerifyEmail]   status          :", status);
      console.log("[FC VerifyEmail]   createdSessionId:", createdSessionId ?? "null");
      console.log("[FC VerifyEmail]   clientTrustState:", clientTrustState ?? "null");
      if (status === "complete") {
        console.log("[FC VerifyEmail] Verification success — activating session");
        if (createdSessionId) {
          await setActive({ session: createdSessionId });
        } else {
          console.warn("[FC VerifyEmail] status=complete but createdSessionId is null — session already active");
        }
        sessionStorage.removeItem("fc_signup_email");
        console.log("[FC VerifyEmail] → /auth/callback");
        navigate("/auth/callback", { replace: true });
      } else if (status === "needs_client_trust") {
        console.warn("[FC VerifyEmail] needs_client_trust — clientTrustState:", clientTrustState);
        if (createdSessionId) {
          await setActive({ session: createdSessionId });
          navigate("/auth/callback", { replace: true });
        } else {
          setError("Device verification required. Please check your email for a verification link, then try again.");
        }
      } else {
        console.warn("[FC VerifyEmail] Unexpected status:", status);
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

  const handleEditEmail = () => {
    navigate("/auth/sign-up", { replace: true });
  };

  const allFilled = otp.join("").length === 6;

  return (
    <AuthLayout hideBackButton>
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-8 backdrop-blur-2xl shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/30 to-blue-600/30 shadow-lg shadow-violet-900/20">
            <Mail className="h-7 w-7 text-violet-300" />
          </div>
          <h2 className="text-[1.75rem] font-bold text-white leading-tight tracking-tight">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-white/50">
            We sent a 6-digit code to
          </p>

          {/* Editable email */}
          <button
            type="button"
            onClick={handleEditEmail}
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 transition hover:bg-white/[0.10] hover:border-violet-500/40 group"
            aria-label="Change email address"
          >
            <span className="text-sm font-semibold text-white">{email || "your email"}</span>
            <Pencil className="h-3.5 w-3.5 text-white/40 group-hover:text-violet-400 transition-colors" />
          </button>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 text-center">
              {error}
            </div>
          )}

          {/* OTP inputs */}
          <div
            className="flex items-center justify-center gap-3"
            onPaste={handlePaste}
            role="group"
            aria-label="One-time password input"
          >
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                autoFocus={i === 0}
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1} of 6`}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={[
                  "h-14 w-12 rounded-xl text-center text-2xl font-bold text-white outline-none transition-all duration-150 caret-violet-400 selection:bg-violet-500/30",
                  "border-2 bg-white/[0.07]",
                  digit
                    ? "border-violet-500 bg-white/[0.10] shadow-[0_0_0_3px_rgba(139,92,246,0.18)]"
                    : "border-white/20 hover:border-white/35",
                  "focus:border-violet-400 focus:bg-white/[0.12] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.25)]",
                  "sm:h-16 sm:w-14 sm:text-3xl",
                ].join(" ")}
              />
            ))}
          </div>

          {/* Verify button */}
          <button
            type="submit"
            disabled={loading || !allFilled}
            className={[
              "flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-4 text-base font-semibold text-white shadow-lg transition-all duration-150",
              allFilled && !loading
                ? "bg-gradient-to-r from-violet-600 to-blue-600 shadow-violet-900/40 hover:from-violet-500 hover:to-blue-500 hover:shadow-violet-800/50 hover:scale-[1.01] active:scale-[0.99]"
                : "bg-white/10 cursor-not-allowed opacity-50 shadow-none",
            ].join(" ")}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Verifying…
              </>
            ) : (
              "Verify email"
            )}
          </button>

          {/* Resend */}
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-white/35">
                Resend code in <span className="font-medium text-white/55">{countdown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
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
