import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSignUp } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, RefreshCw, Pencil } from "lucide-react";
import AuthLayout from "./AuthLayout";

const OTP_LENGTH = 6;

function markOtpSent() {
  sessionStorage.setItem("fc_otp_sent_at", new Date().toISOString());
  sessionStorage.removeItem("fc_otp_verified_at");
  const count = parseInt(sessionStorage.getItem("fc_otp_request_count") || "0") + 1;
  sessionStorage.setItem("fc_otp_request_count", String(count));
  console.log("[FC OTP] ✉ OTP resent | request_count:", count);
}

export default function VerifyEmailPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const navigate = useNavigate();

  // ── Single string state: "780012" — index access otp[i] gives each digit ──
  const [otp, setOtp]         = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]     = useState("");
  const [countdown, setCountdown] = useState(30);

  const inputRefs   = useRef<(HTMLInputElement | null)[]>([]);
  const verifyingRef = useRef(false);
  const email        = sessionStorage.getItem("fc_signup_email") || "";

  const allFilled = otp.length === OTP_LENGTH && [...otp].every(c => /\d/.test(c));

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Guard: no active signUp session ──────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;

    if (!signUp?.id) {
      console.warn("[FC Verify] No active signUp session — redirecting to /auth/sign-up");
      navigate("/auth/sign-up", { replace: true });
      return;
    }

    const otpCount = parseInt(sessionStorage.getItem("fc_otp_request_count") || "0");
    if (otpCount === 0 && signUp.status === "missing_requirements") {
      console.warn("[FC Verify] OTP not yet sent — redirecting to /auth/sign-up");
      sessionStorage.setItem("fc_verify_error", "Verification code could not be sent. Please try again.");
      navigate("/auth/sign-up", { replace: true });
      return;
    }

    if (signUp.status === "complete") {
      console.log("[FC Verify] signUp already complete on mount — sessionId:", signUp.createdSessionId ?? "null");
      const doComplete = async () => {
        if (signUp.createdSessionId && setActive) {
          await setActive({ session: signUp.createdSessionId });
        }
        sessionStorage.removeItem("fc_signup_email");
        navigate("/auth/callback", { replace: true });
      };
      doComplete();
    }
  }, [isLoaded, signUp?.status, signUp?.id, signUp?.createdSessionId]);

  // ── Pick up error from guard redirect ────────────────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem("fc_verify_error");
    if (stored) {
      sessionStorage.removeItem("fc_verify_error");
      setError(stored);
    }
  }, []);

  // ── Shared completion helper ──────────────────────────────────────────────
  const completeSignUp = useCallback(async (sessionId: string | null, sentAt: string | null) => {
    console.log("[FC Verify] ▶ completeSignUp | sessionId:", sessionId ?? "null");
    const verifiedAt = new Date().toISOString();
    sessionStorage.setItem("fc_otp_verified_at", verifiedAt);
    if (sentAt) {
      const ms = new Date(verifiedAt).getTime() - new Date(sentAt).getTime();
      console.log("[FC OTP] ✓ Verified | delivery_ms:", ms);
    }
    if (sessionId) {
      await setActive({ session: sessionId });
      console.log("[FC Verify] ✓ Session activated");
    } else {
      console.warn("[FC Verify] createdSessionId=null — session already active");
    }
    sessionStorage.removeItem("fc_signup_email");
    navigate("/auth/callback", { replace: true });
  }, [setActive, navigate]);

  // ── Verify ────────────────────────────────────────────────────────────────
  const performVerify = useCallback(async (code: string) => {
    if (!isLoaded || !signUp) return;
    if (verifyingRef.current) {
      console.log("[FC Verify] ⚠ already in-flight — skipped");
      return;
    }

    console.log("════════════════════════════════════════════════");
    console.log("OTP entered:", code);
    console.log("OTP length:", code.length);
    console.log("SignUp status:", signUp.status);
    console.log("SignUp id:", signUp.id ?? "null");
    console.log("SignUp unverifiedFields:", signUp.unverifiedFields ?? []);
    console.log("════════════════════════════════════════════════");

    if (code.length !== OTP_LENGTH) { setError("Please enter all 6 digits."); return; }
    setError("");
    verifyingRef.current = true;
    setLoading(true);

    const sentAt      = sessionStorage.getItem("fc_otp_sent_at");
    const verifyStart = Date.now();

    try {
      console.log("Calling attemptEmailAddressVerification with payload:", { code });
      const result = await signUp.attemptEmailAddressVerification({ code });

      console.log("Verification status:", result.status);
      console.log("Session:", result.createdSessionId ?? "null");
      console.log("[FC Verify] api_took:", `${Date.now() - verifyStart}ms`);

      if (result.status === "complete") {
        await completeSignUp(result.createdSessionId, sentAt);
      } else {
        console.warn("[FC Verify] ✗ Unexpected status:", result.status);
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      const errCode = err?.errors?.[0]?.code ?? "unknown";
      const msg     = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "unknown";
      console.error("════════════════════════════════════════════════");
      console.error("[FC Verify] ✗ error code:", errCode, "| message:", msg);
      console.error(JSON.stringify(err, null, 2));
      console.error("════════════════════════════════════════════════");

      if (errCode === "verification_already_verified") {
        console.log("[FC Verify] already verified — recovering:", signUp.status, signUp.createdSessionId);
        await completeSignUp(signUp.createdSessionId ?? null, sentAt);
        return;
      }

      if (errCode === "too_many_requests")
        setError("Too many attempts. Please wait a moment and try again.");
      else if (errCode === "verification_expired")
        setError("Code expired. Please request a new one.");
      else
        setError(`Verification failed: [${errCode}] ${msg}`);

      setOtp("");
      setTimeout(() => inputRefs.current[0]?.focus(), 0);
    } finally {
      verifyingRef.current = false;
      setLoading(false);
    }
  }, [isLoaded, signUp, completeSignUp]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    performVerify(otp);
  };

  // ── Auto-submit when all 6 digits filled ─────────────────────────────────
  useEffect(() => {
    if (!allFilled || verifyingRef.current || !isLoaded || !signUp) return;
    const t = setTimeout(() => performVerify(otp), 300);
    return () => clearTimeout(t);
  }, [otp, allFilled, isLoaded, signUp, performVerify]);

  // ── OTP string helpers ────────────────────────────────────────────────────
  const setCharAt = (str: string, index: number, char: string): string => {
    const arr = Array.from({ length: OTP_LENGTH }, (_, i) => str[i] ?? "");
    arr[index] = char;
    // Build result: keep all chars, trim only trailing empty slots
    let result = arr.join("");
    while (result.length > 0 && result[result.length - 1] === "") {
      result = result.slice(0, -1);
    }
    return result;
  };

  const clearCharAt = (str: string, index: number): string => {
    const arr = Array.from({ length: OTP_LENGTH }, (_, i) => str[i] ?? "");
    arr[index] = "";
    let result = arr.join("");
    while (result.length > 0 && result[result.length - 1] === "") {
      result = result.slice(0, -1);
    }
    return result;
  };

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault(); // we manage state — don't let browser mutate the input
      if (otp[index]) {
        // Filled box: clear this digit, stay on current box
        setOtp(prev => clearCharAt(prev, index));
      } else if (index > 0) {
        // Empty box: move focus to previous box
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      setOtp(prev => clearCharAt(prev, index));
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (index > 0) inputRefs.current[index - 1]?.focus();
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
      return;
    }
  };

  // ── Change handler ────────────────────────────────────────────────────────
  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw    = e.target.value;
    const digits = raw.replace(/\D/g, "");

    // Empty value: mobile backspace (onKeyDown may not have fired / prevented default)
    if (digits.length === 0) {
      if (otp[index]) {
        setOtp(prev => clearCharAt(prev, index));
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    // Multiple digits: browser autofill injected full code into this box
    if (digits.length > 1) {
      const arr = Array.from({ length: OTP_LENGTH }, (_, i) => otp[i] ?? "");
      [...digits].forEach((d, offset) => {
        if (index + offset < OTP_LENGTH) arr[index + offset] = d;
      });
      setOtp(arr.join("").slice(0, OTP_LENGTH));
      const focusAt = Math.min(index + digits.length, OTP_LENGTH - 1);
      setTimeout(() => inputRefs.current[focusAt]?.focus(), 0);
      return;
    }

    // Single digit: place and advance
    setOtp(prev => setCharAt(prev, index, digits));
    if (index < OTP_LENGTH - 1) {
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
    }
  };

  // ── Paste handler (clipboard paste on the container) ─────────────────────
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!digits) return;
    const arr = Array.from({ length: OTP_LENGTH }, (_, i) => digits[i] ?? "");
    setOtp(arr.join("").slice(0, OTP_LENGTH));
    setTimeout(() => inputRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus(), 0);
  };

  // ── Resend ────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!isLoaded || !signUp || countdown > 0 || resending) return;
    setResending(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      markOtpSent();
      setOtp("");
      setError("");
      setCountdown(30);
      setTimeout(() => inputRefs.current[0]?.focus(), 0);
      toast.success("A new code has been sent to your email.");
    } catch (err: any) {
      const msg  = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? String(err);
      const code = err?.errors?.[0]?.code ?? "resend_failed";
      console.error("[FC Verify] Resend failed | code:", code, "| msg:", msg);
      toast.error("Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // ── Edit email ────────────────────────────────────────────────────────────
  const handleEditEmail = () => {
    sessionStorage.removeItem("fc_otp_request_count");
    sessionStorage.removeItem("fc_otp_sent_at");
    sessionStorage.removeItem("fc_otp_type");
    sessionStorage.removeItem("fc_verify_error");
    navigate("/auth/sign-up", { replace: true, state: { editingEmail: true } });
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const boxBase =
    "h-14 w-12 rounded-xl border-2 bg-white/[0.07] text-center text-2xl font-bold text-white " +
    "outline-none transition-all duration-150 caret-violet-400 select-none " +
    "sm:h-16 sm:w-14 sm:text-3xl";

  const boxIdle    = "border-white/20 hover:border-white/35";
  const boxFilled  = "border-violet-500 bg-white/[0.10] shadow-[0_0_0_3px_rgba(139,92,246,0.18)]";
  const boxFocused = "focus:border-violet-400 focus:bg-white/[0.12] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.25)]";

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
          <p className="mt-2 text-sm text-white/50">We sent a 6-digit code to</p>
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

          {/* OTP boxes */}
          <div
            className="flex items-center justify-center gap-3"
            onPaste={handlePaste}
            role="group"
            aria-label="One-time password input"
          >
            {Array.from({ length: OTP_LENGTH }, (_, i) => {
              const digit = otp[i] ?? "";
              return (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={digit}
                  autoFocus={i === 0}
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                  onFocus={e => e.target.select()}
                  onChange={e => handleChange(i, e)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className={[boxBase, digit ? boxFilled : boxIdle, boxFocused].join(" ")}
                />
              );
            })}
          </div>

          {/* Submit */}
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
            {loading
              ? <><Loader2 className="h-5 w-5 animate-spin" />Verifying…</>
              : "Verify email"
            }
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
