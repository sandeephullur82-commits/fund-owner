import React, { useState, useEffect, useRef } from "react";
import { useSignIn, useSignUp, useClerk } from "@clerk/clerk-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "@/lib/languageContext";
import { toast } from "sonner";
import { 
  Building2, Users, Wallet, ArrowRight, Pencil, Eye, EyeOff, 
  HelpCircle, RefreshCw, KeyRound, ShieldAlert, ArrowLeft, Mail,
  Check, Info, UserCheck, AlertCircle, Sparkles
} from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CustomAuthProps {
  initialMode: "signin" | "signup";
  role: "organization" | "agent" | "customer";
}

export default function CustomClerkAuth({ initialMode, role }: CustomAuthProps) {
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const { client } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();

  // Navigation Steps
  // signin views: "email", "password"
  // signup views: "details", "verify"
  // forgot password views: "forgot-email", "forgot-otp", "reset-password"
  // helper views: "help"
  const [step, setStep] = useState<
    "email" | "password" | "details" | "verify" | "forgot-email" | "forgot-otp" | "reset-password" | "help"
  >(initialMode === "signin" ? "email" : "details");

  // Form states and state preservation
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  
  // UI helper states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  // Focus ref for OTP items
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer run for Resend Code OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  // Color theme generator based on user role
  const getRoleTheme = () => {
    switch (role) {
      case "agent":
        return {
          primary: "bg-emerald-600 hover:bg-emerald-700 text-white",
          text: "text-emerald-600",
          bgLight: "bg-emerald-50",
          border: "border-emerald-200",
          shadowGlow: "shadow-emerald-100",
          gradient: "from-emerald-50 via-emerald-100/30 to-white",
          focusRing: "focus:ring-emerald-500/10 focus:border-emerald-500"
        };
      case "customer":
        return {
          primary: "bg-purple-600 hover:bg-purple-700 text-white",
          text: "text-purple-600",
          bgLight: "bg-purple-50",
          border: "border-purple-200",
          shadowGlow: "shadow-purple-100",
          gradient: "from-purple-50 via-purple-100/30 to-white",
          focusRing: "focus:ring-purple-500/10 focus:border-purple-500"
        };
      default: // organization / operator
        return {
          primary: "bg-blue-600 hover:bg-blue-700 text-white",
          text: "text-blue-600",
          bgLight: "bg-blue-50",
          border: "border-blue-200",
          shadowGlow: "shadow-blue-100",
          gradient: "from-blue-50 via-blue-100/30 to-white",
          focusRing: "focus:ring-blue-500/10 focus:border-blue-500"
        };
    }
  };

  const theme = getRoleTheme();
  const query = new URLSearchParams(location.search);
  const inviteToken = query.get("ticket") || query.get("organization_invitation") || query.get("invitation_token") || query.get("token");
  const isInviteFlow = !!inviteToken;
  const canRegisterPublicly = role === "organization";

  const isAlreadyVerified = (err: any) => {
    if (!err) return false;
    const errString = String(err.message || err.toString() || "");
    const firstError = err?.errors?.[0];
    const firstErrorMsg = firstError?.message || firstError?.longMessage || "";
    
    const isVerifiedCode = firstError?.code === "already_verified" || 
                           firstError?.code?.includes("already_verified");
    
    const isVerifiedMsg = errString.toLowerCase().includes("already been verified") ||
                           errString.toLowerCase().includes("already_verified") ||
                           firstErrorMsg.toLowerCase().includes("already been verified") ||
                           firstErrorMsg.toLowerCase().includes("already_verified") ||
                           JSON.stringify(err).toLowerCase().includes("already_verified") ||
                           JSON.stringify(err).toLowerCase().includes("already been verified");
                           
    return !!(isVerifiedCode || isVerifiedMsg);
  };

  const isSessionExistsError = (err: any) => {
    if (!err) return false;
    const errString = String(err.message || err.toString() || "").toLowerCase();
    const firstError = err?.errors?.[0];
    return (
      firstError?.code === "session_exists" ||
      errString.includes("session already exists") ||
      errString.includes("session_exists")
    );
  };

  const ensureUserDoc = async (clerkUserId: string, emailStr: string, fNameStr: string, lNameStr: string, role?: string) => {
    try {
      const userRef = doc(db, "users", clerkUserId);
      const userSnap = await getDoc(userRef);
      const existing = userSnap.exists() ? (userSnap.data() as any) : null;
      await setDoc(userRef, {
        clerkUserId,
        id: clerkUserId,
        firstName: fNameStr || "",
        lastName: lNameStr || "",
        name: `${fNameStr} ${lNameStr}`.trim() || "User",
        email: emailStr || "",
        profileCompleted: true,
        ...(role ? { role } : {}),
        createdAt: existing?.createdAt || serverTimestamp(),
      }, { merge: true });

      if (!userSnap.exists()) {
        console.log("CustomClerkAuth: created user doc for", clerkUserId);
      }
    } catch (dbErr: any) {
      console.error("Firestore user creation error:", dbErr);
      throw dbErr;
    }
  };

  const getFormEmail = () => email || signUp?.emailAddress || "";
  const getFormFirstName = () => firstName || signUp?.firstName || "";
  const getFormLastName = () => lastName || signUp?.lastName || "";
  const getNormalizedRole = () => {
    if (isInviteFlow) return undefined;
    return role === "organization" ? "organization_owner" : role;
  };

  const activateSignInSession = async (sessionId?: string | null) => {
    if (!sessionId) return;
    try {
      await setSignInActive({ session: sessionId });
    } catch (err: any) {
      if (!String(err?.message || "").includes("session_exists")) {
        console.error("Sign-in session activation failed:", err);
      }
    }
  };

  const activateSignUpSession = async (sessionId?: string | null) => {
    if (!sessionId) return;
    try {
      await setSignUpActive({ session: sessionId });
    } catch (err: any) {
      if (!String(err?.message || "").includes("session_exists")) {
        console.error("Sign-up session activation failed:", err);
      }
    }
  };

  const isInviteOnlySignin = initialMode === "signin" && role !== "organization";

  const finalizeSignUp = async (sessionId?: string | null, userId?: string | null, userRole?: string) => {
    if (sessionId) {
      await activateSignUpSession(sessionId);
    }
    if (userId) {
      await ensureUserDoc(userId, getFormEmail(), getFormFirstName(), getFormLastName(), userRole);
    }
    navigate("/router");
  };

  const finalizeSignIn = async (sessionId?: string | null) => {
    if (sessionId) {
      await activateSignInSession(sessionId);
    }
    navigate("/router");
  };

  // Social SSO Action with custom visual state
  const handleSocialConnect = async () => {
    if (initialMode === "signup") {
      toast.error(language === "kn"
        ? "ಸೋಷಿಯಲ್ ಸೈನ್ ಅಪ್ ಈ ეტაპದಲ್ಲಿ ಸಕ್ರಿಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಇಮೇಲ್ ಬಳಸಿ ರೆಜಿಸ್ಟರ್ ಮಾಡಿ."
        : "Social signup is disabled for organization owners. Please register with email.");
      return;
    }

    if (!isSignInLoaded && !isSignUpLoaded) return;
    setIsLoading(true);
    try {
      const activeFlow = initialMode === "signin" ? signIn : signUp;
      if (activeFlow) {
        await activeFlow.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/router",
          redirectUrlComplete: "/router"
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to start Google transaction");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Submit email to check first factor
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email) return toast.error(language === "kn" ? "ದಯವಿಟ್ಟು ಇಮೇಲ್ ನಮೂದಿಸಿ" : "Please enter your email");
    
    setIsLoading(true);
    try {
      if (!signIn) return;
      const result = await signIn.create({
        identifier: email,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setSignInActive({ session: result.createdSessionId });
        toast.success(language === "kn" ? "ಲಾಗಿನ್ ಯಶಸ್ವಿಯಾಗಿದೆ!" : "Secure login complete!");
        navigate("/router");
        return;
      }

      setStep("password");
    } catch (err: any) {
      console.error(err);
      if (isSessionExistsError(err)) {
        setAuthError(null);
        toast.success(language === "kn" ? "ನೀವು ಈಗಾಗಲೇ ಲಾಗ್ ಇನ್ ಆಗಿದ್ದೀರಿ" : "Session already active. Continuing to your dashboard.");
        navigate("/router");
        return;
      }

      const isIncorrect = err.errors?.[0]?.message?.toLowerCase().includes("incorrect") || 
                          err.errors?.[0]?.longMessage?.toLowerCase().includes("incorrect") ||
                          err.message?.toLowerCase().includes("incorrect") ||
                          err.errors?.[0]?.code === "form_password_incorrect" ||
                          err.errors?.[0]?.code === "form_identifier_not_found";
      
      const errMsg = isIncorrect
        ? (language === "kn"
          ? "ಇಮೇಲ್ ಅಥವಾ ಗುಪ್ತಪದ ತಪ್ಪಾಗಿದೆ. ಸರಿಯಾದ ವಿವರಗಳನ್ನು ಬಳಸಿ ಅಥವಾ ಹೊಸ ಖಾತೆ ರಚಿಸಿ."
          : "Incorrect password or email address. Try again, or use another method.")
        : (err.errors?.[0]?.message || err.message || "Registration key incorrect or missing context");
      setAuthError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Submit Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!password) return toast.error(language === "kn" ? "ಗುಪ್ತಪದ ನಮೂದಿಸಿ" : "Please enter password");

    setIsLoading(true);
    try {
      if (!signIn) return;
      
      const result = await signIn.attemptFirstFactor({
        strategy: "password",
        password: password,
      });

      if (result.status === "complete") {
        await finalizeSignIn(result.createdSessionId);
        toast.success(language === "kn" ? "ಲಾಗಿನ್ ಯಶಸ್ವಿಯಾಗಿದೆ!" : "Secure login complete!");
      } else {
        toast.error("Please complete additional challenge verify");
      }
    } catch (err: any) {
      console.error(err);
      const isIncorrect = err.errors?.[0]?.message?.toLowerCase().includes("incorrect") || 
                          err.errors?.[0]?.longMessage?.toLowerCase().includes("incorrect") ||
                          err.message?.toLowerCase().includes("incorrect") ||
                          err.errors?.[0]?.code === "form_password_incorrect" ||
                          err.errors?.[0]?.code === "form_identifier_not_found";

      if (isSessionExistsError(err)) {
        setAuthError(null);
        toast.success(language === "kn" ? "ನೀವು ಈಗಾಗಲೇ ಲಾಗ್ ಇನ್ ಆಗಿದ್ದೀರಿ" : "Session already active. Continuing to your dashboard.");
        navigate("/router");
        return;
      }

      const errMsg = isIncorrect
        ? (language === "kn"
          ? "ಇಮೇಲ್ ಅಥವಾ ಗುಪ್ತಪದ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಸರಿಯಾದ ವಿವರಗಳನ್ನು ಬಳಸಿ ಅಥವಾ ಹೊಸ ಖಾತೆ ರಚಿಸಿ."
          : "Incorrect password or email address. Try again, or use another method.")
        : (err.errors?.[0]?.longMessage || 
           err.errors?.[0]?.message || 
           (language === "kn" ? "ತಪ್ಪು ಗುಪ್ತಪದ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ." : "Wrong Password. Please try again."));
      setAuthError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Sign Up Details Creator
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!canRegisterPublicly && !isInviteFlow) {
      toast.error(language === "kn"
        ? "ಇದನ್ನು ರಚಿಸಲು ಅನುಮತಿಯಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಂಸ್ಥೆಯ ಮಾಲೀಕರನ್ನು ಸಂಪರ್ಕಿಸಿ."
        : "Public registration is disabled for this role. Please contact your organization owner.");
      return;
    }
    if (!firstName || !lastName || !email || !password) {
      return toast.error(language === "kn" ? "ಎಲ್ಲಾ ಕ್ಷೇತ್ರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ" : "Please enter all fields");
    }
    if (!termsAccepted) {
      return toast.error(language === "kn" ? "ಸೇವಾ ನಿಯಮಗಳನ್ನು ಒಪ್ಪಿಕೊಳ್ಳಿ" : "Please accept terms of service");
    }

    setIsLoading(true);
    try {
      if (!signUp) return;

      const normalizedRole = getNormalizedRole();
      const createArgs: any = {
        firstName,
        lastName,
        emailAddress: email,
        password,
      };

      if (normalizedRole) {
        createArgs.publicMetadata = { role: normalizedRole };
      }

      const result = await signUp.create(createArgs);

      if (result.status === "complete") {
        await finalizeSignUp(result.createdSessionId, result.createdUserId, normalizedRole);
        toast.success(language === "kn" ? "ಖಾತೆ ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ!" : "Your account has been created successfully!");
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setResendTimer(60);
      setStep("verify");
      toast.success(language === "kn" ? "ಪರಿಶೀಲನಾ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಿದೆ!" : "OTP verification code sent!");
      return;
    } catch (err: any) {
      console.error(err);
      if (isAlreadyVerified(err) && signUp?.status === "complete" && signUp.createdSessionId) {
        await finalizeSignUp(signUp.createdSessionId, signUp.createdUserId, getNormalizedRole());
        return;
      }

      const isAlreadyRegistered = err?.errors?.[0]?.code === "form_identifier_in_use" ||
        String(err?.message || "").toLowerCase().includes("already exists");

      if (isAlreadyRegistered) {
        setAuthError(language === "kn"
          ? "ಈ ಇಮೇಲ್ ಈಗಾಗಲೇ ಬಳಕೆ ಮಾಡಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಲಾಗಿನ್ ಮಾಡಿ."
          : "This email is already registered. Please sign in instead.");
        setStep("email");
        return;
      }

      const errMsg = err.errors?.[0]?.message || err.message || "Sign up initialization failed";
      setAuthError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: OTP Verification Attempt
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent double clicking
    const finalOtp = otpCode.join("");
    if (finalOtp.length !== 6) {
      return toast.error(language === "kn" ? "6 ಸಂಖ್ಯೆಯ ಕೋಡ್ ನಮೂದಿಸಿ" : "Please input a valid 6-digit verification code");
    }

    setIsLoading(true);
    try {
      const liveSignUp = client?.signUp || signUp;
      if (!liveSignUp) {
        setAuthError(language === "kn" ? "ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ" : "Please try again.");
        return;
      }

      const result = await liveSignUp.attemptEmailAddressVerification({
        code: finalOtp,
      });

      if (result.status === "complete") {
        await finalizeSignUp(result.createdSessionId || liveSignUp.createdSessionId, result.createdUserId || liveSignUp.createdUserId, getNormalizedRole());
        toast.success(language === "kn" ? "ಖಾತೆ ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ!" : "Your secure profile has been verified!");
        return;
      }

      if (result.createdSessionId) {
        await finalizeSignUp(result.createdSessionId, result.createdUserId || liveSignUp.createdUserId, getNormalizedRole());
        toast.success(language === "kn" ? "ಖಾತೆ ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ!" : "Your secure profile has been verified!");
        return;
      }

      console.error("Unknown verification state detail", result);
      toast.error(language === "kn" ? "ಅಮಾನ್ಯ ಸಂರಕ್ಷಣಾ ಕೋಡ್" : "Invalid verification code");
    } catch (err: any) {
      const liveSignUp = client?.signUp || signUp;
      const isVerified = isAlreadyVerified(err);
      const isSessionExists = err?.errors?.[0]?.code === "session_exists" || String(err?.message || "").includes("session_exists");

      if ((isVerified || isSessionExists) && liveSignUp) {
        await finalizeSignUp(liveSignUp.createdSessionId, liveSignUp.createdUserId, getNormalizedRole());
        toast.success(language === "kn" ? "ಖಾತೆ ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ!" : "Your secure profile has been verified!");
        return;
      }

      console.error("OTP Verification Error:", err);
      const errMsg = err.errors?.[0]?.message || err.message || "Invalid validation code";
      setAuthError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend code callback
  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    try {
      if (step === "verify" && signUp) {
        if (signUp.verifications?.emailAddress?.status === "verified") {
          if (signUp.status === "complete" && signUp.createdSessionId) {
            await finalizeSignUp(signUp.createdSessionId, signUp.createdUserId, getNormalizedRole());
            toast.success(language === "kn" ? "ಖಾತೆ ಯಶಸ್ವಿಯಾಗಿ ಪರಿಶೀಲಿಸಲ್ಪಟ್ಟಿದೆ" : "Account already verified");
            return;
          }

          toast.warning(language === "kn" ? "ಈಗಾಗಲೇ ಪರಿಶೀಲಿಸಲಾಗಿದೆ" : "Already verified.");
          return;
        }

        try {
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          toast.success(language === "kn" ? "ಹೊಸ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಿದೆ" : "New OTP code sent successfully");
          setResendTimer(60);
        } catch (resendErr: any) {
          if (isAlreadyVerified(resendErr)) {
            if (signUp.status === "complete" && signUp.createdSessionId) {
              await finalizeSignUp(signUp.createdSessionId, signUp.createdUserId, getNormalizedRole());
              toast.success(language === "kn" ? "ಖಾತೆ ಯಶಸ್ವಿಯಾಗಿಯೇ ಪರಿಶೀಲಿಸಲಾಗಿದೆ" : "Account already verified");
              return;
            }
            toast.warning(language === "kn" ? "ಈಗಾಗಲೇ ಪರಿಶೀಲಿಸಲಾಗಿದೆ" : "Already verified.");
          } else {
            throw resendErr;
          }
        }
      } else if (step === "forgot-otp" && signIn) {
        const factor = (signIn as any).supportedFirstFactors?.find((f: any) => f.strategy === "email_code") as any;
        await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor?.emailAddressId || "" } as any);
        toast.success(language === "kn" ? "ಹೊಸ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಿದೆ" : "New OTP code sent successfully");
        setResendTimer(60);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.errors?.[0]?.message || err.message || "Code send failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 5: Forgot email recovery
  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Please enter email address");

    setIsLoading(true);
    try {
      if (!signIn) return;
      const res = await signIn.create({
        strategy: "reset_password_email_code" as any,
        identifier: email,
      });

      // Prepare email OTP code reset
      const factor = (res as any).supportedFirstFactors?.find((f: any) => f.strategy === "email_code") as any;
      await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor?.emailAddressId || "" } as any);
      setResendTimer(60);
      setStep("forgot-otp");
      toast.success("Verification factor dispatched");
    } catch (err: any) {
      console.error(err);
      toast.error(err.errors?.[0]?.message || err.message || "Unable to find recovery email");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 6: Forgot Password OTP Validator
  const handleForgotOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalOtp = otpCode.join("");
    if (finalOtp.length !== 6) return toast.error("Please enter complete OTP");

    setIsLoading(true);
    try {
      if (!signIn) return;
      const res = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code: finalOtp,
      });

      setStep("reset-password");
      toast.success("Identity checks match");
    } catch (err: any) {
      console.error(err);
      toast.error(err.errors?.[0]?.message || "Identity validation mismatches or code expired");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 7: Create Custom New Password
  const handleCreateNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");

    setIsLoading(true);
    try {
      if (!signIn) return;
      const res = await signIn.resetPassword({
        password: password,
        signOutOfOtherSessions: true,
      });

      if (res.status === "complete") {
        await setSignInActive({ session: res.createdSessionId });
        toast.success("Secure password resets matching!");
        navigate("/router");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.errors?.[0]?.message || "Failed to set new credentials");
    } finally {
      setIsLoading(false);
    }
  };

  // Handles smooth typing transitions inside 6 OTP boxes
  const handleOtpChange = (index: number, val: string) => {
    const onlyNum = val.replace(/[^0-9]/g, "");
    if (!onlyNum && val !== "") return; // Allow backspace

    const newCode = [...otpCode];
    newCode[index] = onlyNum.substring(onlyNum.length - 1);
    setOtpCode(newCode);

    // Auto-focus next input box if typed
    if (onlyNum && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Drop to previous index on Backspace if empty space
    if (e.key === "Backspace") {
      if (!otpCode[index] && index > 0) {
        const newCode = [...otpCode];
        newCode[index - 1] = "";
        setOtpCode(newCode);
        otpInputs.current[index - 1]?.focus();
      } else {
        const newCode = [...otpCode];
        newCode[index] = "";
        setOtpCode(newCode);
      }
    }
  };

  // Password structural strength score generator
  const getPasswordStrength = () => {
    if (!password) return { percent: 0, text: "", color: "bg-slate-200" };
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    if (/[^A-Za-z0-9]/.test(password)) score += 25;

    if (score <= 25) return { percent: score, text: language === "kn" ? "ದುರ್ಬಲ" : "Weak", color: "bg-rose-500" };
    if (score <= 50) return { percent: score, text: language === "kn" ? "ಮಧ್ಯಮ" : "Medium", color: "bg-amber-500" };
    if (score <= 75) return { percent: score, text: language === "kn" ? "ಬಲವಾದ" : "Strong", color: "bg-indigo-500" };
    return { percent: score, text: language === "kn" ? "ಅತ್ಯಂತ ಸುರಕ್ಷಿತ" : "Very Secure", color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength();

  if (!isSignInLoaded || !isSignUpLoaded) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 space-y-4 px-4">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-slate-400 text-sm font-semibold animate-pulse uppercase tracking-wider">
          Initiating Clerk Ledgers...
        </p>
      </div>
    );
  }

  return (
    <div id="fc-auth-card-parent" className="relative w-full max-w-lg mx-auto px-4 sm:px-0">
      {/* Dynamic Background Layout with Ambient Glow Card */}
      <div className={`overflow-hidden bg-white/95 border border-slate-200/80 rounded-3xl shadow-xl transition-all duration-300`}>
        
        {/* Dynamic header status bar */}
        <div className={`h-1.5 w-full ${role === 'agent' ? 'bg-emerald-400' : role === 'customer' ? 'bg-purple-400' : 'bg-blue-400'}`} />
        
        <div className="p-5 md:p-8 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* VIEW 1: SIGN IN EMAIL PAGE */}
            {step === "email" && (
              <motion.div
                key="email-view"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Brand slogan */}
                <div className="space-y-1">
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    {language === "kn" ? "ಲಾಗಿನ್ ಮಾಡಿ" : "Sign In"}
                  </h1>
                  <p className="text-base text-slate-500">
                    {language === "kn" ? "ನಿಮ್ಮ ದಿನನಿತ್ಯದ ಉಳಿತಾಯ ಪುಸ್ತಕಕ್ಕೆ ಸುಲಭ ಪ್ರವೇಶ ಭದ್ರತೆ" : "Sign in to join FundCircle Digital Savings Ledger"}
                  </p>
                </div>

                {/* Google SSO */}
                <button
                  id="sso-google-button"
                  type="button"
                  disabled={isLoading}
                  onClick={handleSocialConnect}
                  className="w-full h-14 rounded-2xl border border-slate-200 bg-white hover:bg-blue-50 text-slate-700 font-semibold text-base transition transform duration-200 ease-out focus:outline-none focus:ring-4 focus:ring-blue-100 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <g transform="matrix(1, 0, 0, 1, 0, 0)">
                      <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48c0,-0.32 -0.03,-0.64 -0.08,-0.9z" fill="#4285F4" />
                      <path d="M12,20.5c2.3,0 4.23,-0.76 5.64,-2.08l-3.3,-2.58c-0.91,0.61 -2.08,0.98 -3.34,0.98c-2.57,0 -4.75,-1.74 -5.53,-4.07H2.1v2.66c1.5,2.98 4.59,4.96 8.16,4.96L12,20.5z" fill="#34A853" />
                      <path d="M6.47,12.75a5.1,5.1,0,0,1,0,-3.5V6.59H2.1a8.96,8.96,0,0,0,0,8.82l4.37,-2.66z" fill="#FBBC05" />
                      <path d="M12,4.42c1.25,0 2.37,0.43 3.25,1.27l2.44,-2.44C16.23,1.84 14.3,1 12,1C8.43,1 5.34,2.98 3.84,5.96l4.37,3.5c0.78,-2.33 2.96,-4.04 5.53,-4.04z" fill="#EA4335" />
                    </g>
                  </svg>
                  <span>{language === "kn" ? "ಗೂಗಲ್ ಪ್ಲಸ್ ಬಳಸಿ ಮುಂದುವರಿಯಿರಿ" : "Continue with Google"}</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px bg-slate-100 flex-1" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === "kn" ? "ಅಥವಾ" : "OR"}</span>
                  <div className="h-px bg-slate-100 flex-1" />
                </div>

                {/* Email Form */}
                {authError && (
                  <div className="flex gap-2.5 p-3.5 bg-rose-50 border border-rose-150 text-rose-900 text-sm rounded-2xl items-start shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">{language === "kn" ? "ದೋಷ ಉಂಟಾಗಿದೆ" : "Login Issue"}</p>
                      <p className="leading-relaxed font-medium text-rose-850">{authError}</p>
                      <p className="text-[10px] text-rose-600/85 leading-relaxed font-semibold">
                        {authError.toLowerCase().includes("session already exists") || authError.toLowerCase().includes("session_exists")
                          ? (language === "kn"
                            ? "ನೀವು ಈಗಾಗಲೇ ಲಾಗಿನ್ ಆಗಿದ್ದೀರಿ. ಮುಂದುವರಿಸಲು ನಿಮ್ಮ ಡ್ಯಾಶ್ಬೋರ್ಡ್‌ಗೆ ಹೋಗಿ."
                            : "You already have an active session. Proceed to your dashboard.")
                          : isInviteOnlySignin
                            ? (language === "kn"
                              ? "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಆಹ್ವಾನದ ಇಮೇಲ್ ಬಳಸಿ ಲಾಗಿನ್ ಮಾಡಿ ಅಥವಾ ಸಂಸ್ಥಾ ಮಾಲೀಕನನ್ನು ಸಂಪರ್ಕಿಸಿ."
                              : "Please sign in with your invited email, or contact your organization owner.")
                            : (language === "kn"
                              ? "ಹೊಸಬರೇ? ಲಾಗಿನ್ ಆಗುವ ಮೊದಲು ದಯವಿಟ್ಟು ಕೆಳಗೆ 'ಇಲ್ಲಿ ಖಾತೆ ತೆರೆಯಿರಿ' ಕ್ಲಿಕ್ ಮಾಡಿ ನೋಂದಾಯಿಸಿ."
                              : "New to FundCircle? Please register first by clicking 'Create Account / ಖಾತೆ ತೆರೆಯಿರಿ' below.")}
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {language === "kn" ? "ಇಮೇಲ್ ವಿಳಾಸ" : "Email Address"}
                    </label>
                    <div className="relative">
                      <Mail className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400 shrink-0" />
                      <input
                        id="signin-email-input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setAuthError(null);
                        }}
                        placeholder="yourname@fundcircle.com"
                        className={`h-14 w-full pl-12 pr-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:bg-white text-base transition-all duration-200 ease-out focus:outline-none ${theme.focusRing}`}
                      />
                    </div>
                  </div>

                  <button
                    id="signin-continue-button"
                    type="submit"
                    disabled={isLoading}
                    className={`w-full h-14 rounded-2xl font-bold text-lg shadow-sm transition transform duration-200 ease-out flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer ${theme.primary}`}
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{language === "kn" ? "ಮುಂದುವರಿಯಿರಿ" : "Continue"}</span>
                        <ArrowRight className="w-6 h-6" />
                      </>
                    )}
                  </button>
                </form>

                {!isInviteOnlySignin && (
                  <div className="text-center pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      {language === "kn" ? "ಹೊಸಬರೇ?" : "New to FundCircle?"}{" "}
                      <button
                        id="link-to-register-btn"
                        onClick={() => {
                          setStep("details");
                        }}
                        className={`font-extrabold ${theme.text} hover:underline focus:outline-none`}
                      >
                        {language === "kn" ? "ಇಲ್ಲಿ ಖಾತೆ ತೆರೆಯಿರಿ" : "Create Account / ಖಾತೆ ತೆರೆಯಿರಿ"}
                      </button>
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* VIEW 2: PASSWORD PAGE with Dynamic Pencil Edit */}
            {step === "password" && (
              <motion.div
                key="password-view"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {language === "kn" ? "ಗುಪ್ತಪದ ನಮೂದಿಸಿ" : "Enter Password"}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {language === "kn" ? "ಲಾಗಿನ್ ಪೂರ್ಣಗೊಳಿಸಲು ಗುಪ್ತಪದ ಹಾಕಿ" : "Enter password for secure login session integration"}
                  </p>
                </div>

                {/* Email Display with interactive Pencil Icon (PRESERVING DATA WITHOUT RELOAD) */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-700 truncate">{email}</span>
                  </div>
                  <button
                    id="pencil-edit-email-btn"
                    type="button"
                    onClick={() => {
                      setStep("email"); // Simply returns back securely, maintaining Clerk flow state and typed visual!
                    }}
                    className={`p-2 rounded-lg hover:bg-slate-200/60 ${theme.text} transition-colors focus:outline-none`}
                    title="Edit Email Address"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                {authError && (
                  <div className="flex gap-2.5 p-3.5 bg-rose-50 border border-rose-150 text-rose-900 text-sm rounded-2xl items-start shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">{language === "kn" ? "ದೋಷ ಉಂಟಾಗಿದೆ" : "Login Issue"}</p>
                      <p className="leading-relaxed font-medium text-rose-850">{authError}</p>
                      <p className="text-[10px] text-rose-600/85 leading-relaxed font-semibold">
                        {language === "kn" 
                          ? "ನಿಮ್ಮ ಗುಪ್ತಪದ ಮರೆತಿರಾ? ಮರುಹೊಂದಿಸಲು ದಯವಿಟ್ಟು ಮೇಲಿನ 'ಗುಪ್ತಪದ ಮರೆತಿರಾ?' ಕ್ಲಿಕ್ ಮಾಡಿ."
                          : "Forgot your credentials? You can tap 'Forgot Password?' above to securely reset your password."}
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {language === "kn" ? "ಗುಪ್ತಪದ" : "Password"}
                      </label>
                      <button
                        id="forgot-password-link"
                        type="button"
                        onClick={() => setStep("forgot-email")}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 focus:outline-none"
                      >
                        {language === "kn" ? "ಗುಪ್ತಪದ ಮರೆತಿರಾ?" : "Forgot Password?"}
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400 shrink-0" />
                      <input
                        id="signin-password-input"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setAuthError(null);
                        }}
                        placeholder="••••••••"
                        className={`h-14 w-full pl-12 pr-12 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:bg-white text-base transition-all duration-200 ease-out focus:outline-none ${theme.focusRing}`}
                      />
                      <button
                        id="password-visibility-btn"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 p-0.5 text-slate-450 hover:text-slate-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    id="password-continue-btn"
                    type="submit"
                    disabled={isLoading}
                    className={`w-full h-14 rounded-2xl font-bold text-lg shadow-sm transition transform duration-200 ease-out flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer ${theme.primary}`}
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{language === "kn" ? "ಲಾಗಿನ್ ಮಾಡಿ" : "Sign In"}</span>
                        <UserCheck className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Switch Method Block */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 text-center">
                  <button
                    id="switch-to-email-view-btn"
                    onClick={() => setStep("email")}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 focus:outline-none flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {language === "kn" ? "ಬೇರೆ ಲಾಗಿನ್ ವಿಧಾನ ಬಳಸಿ" : "Use Another Method"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW 3: SIGN UP DETAILS PAGE */}
            {step === "details" && (
              <motion.div
                key="signup-details-view"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {language === "kn" ? "ಖಾತೆ ರಚಿಸಿ" : "Create Account"}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {language === "kn" ? "ದೈನಂದಿನ ಶೇಖರಣಾ ಪುಸ್ತಕ ನಿರ್ವಹಿಸಲು ನೋಂದಾಯಿಸಿ" : "Get started with custom biometric and card pigmy deposit book"}
                  </p>
                </div>

                {/* Google SSO */}
                {initialMode !== "signup" && (
                  <button
                    id="signup-sso-google"
                    type="button"
                    disabled={isLoading}
                    onClick={handleSocialConnect}
                    className="w-full h-14 rounded-2xl border border-slate-200 bg-white hover:bg-blue-50 text-slate-700 font-semibold text-base transition transform duration-200 ease-out focus:outline-none focus:ring-4 focus:ring-blue-100 flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48c0,-0.32 -0.03,-0.64 -0.08,-0.9z" fill="#4285F4" />
                    <path d="M12,20.5c2.3,0 4.23,-0.76 5.64,-2.08l-3.3,-2.58c-0.91,0.61 -2.08,0.98 -3.34,0.98c-2.57,0 -4.75,-1.74 -5.53,-4.07H2.1v2.66c1.5,2.98 4.59,4.96 8.16,4.96L12,20.5z" fill="#34A853" />
                    <path d="M6.47,12.75a5.1,5.1,0,0,1,0,-3.5V6.59H2.1a8.96,8.96,0,0,0,0,8.82l4.37,-2.66z" fill="#FBBC05" />
                    <path d="M12,4.42c1.25,0 2.37,0.43 3.25,1.27l2.44,-2.44C16.23,1.84 14.3,1 12,1C8.43,1 5.34,2.98 3.84,5.96l4.37,3.5c0.78,-2.33 2.96,-4.04 5.53,-4.04z" fill="#EA4335" />
                  </svg>
                  <span>{language === "kn" ? "ಗೂಗಲ್ ಪ್ಲಸ್ ಬಳಸಿ ನೋಂದಾಯಿಸಿ" : "Sign Up with Google"}</span>
                </button>
                )}

                <div className="flex items-center gap-3">
                  <div className="h-px bg-slate-100 flex-1" />
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider">OR</span>
                  <div className="h-px bg-slate-100 flex-1" />
                </div>

                <form onSubmit={handleDetailsSubmit} className="space-y-4">
                  {/* Name group */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        {language === "kn" ? "ಮೊದಲ ಹೆಸರು" : "First Name"}
                      </label>
                      <input
                        id="signup-firstname-input"
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Vijay"
                        className={`h-14 w-full px-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 text-base transition-all duration-200 ease-out focus:outline-none ${theme.focusRing}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        {language === "kn" ? "ಕೊನೆಯ ಹೆಸರು" : "Last Name"}
                      </label>
                      <input
                        id="signup-lastname-input"
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Kumar"
                        className={`h-14 w-full px-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 text-base transition-all duration-200 ease-out focus:outline-none ${theme.focusRing}`}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      {language === "kn" ? "ಇಮೇಲ್ ವಿಳಾಸ" : "Email Address"}
                    </label>
                    <input
                      id="signup-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vijay.kumar@gmail.com"
                      className={`h-14 w-full px-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 text-base transition-all duration-200 ease-out focus:outline-none ${theme.focusRing}`}
                    />
                  </div>

                  {/* Password + strength bar */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      {language === "kn" ? "ಗುಪ್ತಪದ ರಚಿಸಿ" : "Password"}
                    </label>
                    <div className="relative">
                      <input
                        id="signup-password-input"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className={`h-14 w-full pl-4 pr-12 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 text-base transition-all duration-200 ease-out focus:outline-none ${theme.focusRing}`}
                      />
                      <button
                        id="signup-password-toggle"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 p-0.5 text-slate-450 hover:text-slate-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>

                    {/* Progress representation */}
                    {password && (
                      <div className="space-y-1 pt-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-450 font-medium">{language === "kn" ? "ಪಾಸ್‌ವರ್ಡ್ ಸುರಕ್ಷತೆ ಬಲ:" : "Password Strength:"}</span>
                          <span className="font-bold text-slate-700">{strength.text}</span>
                        </div>
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: `${strength.percent}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Terms toggle */}
                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      id="signup-terms-checkbox"
                      type="checkbox"
                      required
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 w-4 h-4 text-blue-600 border-slate-200 rounded focus:ring-blue-500/10 transition-all cursor-pointer"
                    />
                    <label htmlFor="signup-terms-checkbox" className="text-[11px] text-slate-550 leading-relaxed cursor-pointer select-none">
                      {language === "kn" ? "ನಾನು ಸೌಲಭ್ಯ ಒದಗಿಸುವ ಸೇವಾ ನಿಯಮಗಳು ಮತ್ತು ಡೇಟಾ ಭದ್ರತಾ ನೀತಿಯನ್ನು ಒಪ್ಪಿಕೊಳ್ಳುತ್ತೇನೆ." : "I accept the simple terms of daily savings service and database audit guidelines."}
                    </label>
                  </div>

                  <button
                    id="signup-details-continue-btn"
                    type="submit"
                    disabled={isLoading}
                    className={`w-full h-14 rounded-2xl font-bold text-lg shadow-sm transition transform duration-200 ease-out flex items-center justify-center gap-3 cursor-pointer ${theme.primary}`}
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                    ) : (
                      <>
                        <span>{language === "kn" ? "ಖಾತೆ ರಚಿಸಿ ಮುಂದುವರಿಯಿರಿ" : "Agree & Register"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 font-medium">
                    {language === "kn" ? "ಈಗಾಗಲೇ ಖಾತೆ ಹೊಂದಿದ್ದೀರಾ?" : "Already registered?"}{" "}
                    <button
                      id="link-to-signin-btn"
                      onClick={() => {
                        setStep("email");
                      }}
                      className={`font-extrabold ${theme.text} hover:underline focus:outline-none`}
                    >
                      {language === "kn" ? "ಲಾಗಿನ್ ಮಾಡಿ" : "Sign In / ಲಾಗಿನ್"}
                    </button>
                  </p>
                </div>
              </motion.div>
            )}

            {/* VIEW 4: EMAIL VERIFICATION OTP PAGE */}
            {step === "verify" && (
              <motion.div
                key="verification-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {language === "kn" ? "ಇಮೇಲ್ ಪರಿಶೀಲನೆ" : "Verify Email"}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {language === "kn" ? "ನಿಮ್ಮ ನೋಂದಾಯಿತ ಇಮೇಲ್ ಕಳುಹಿಸಲಾದ 6-ಅಂಕಿಯ ಪರಿಶೀಲನಾ ಕೋಡ್ ನಮೂದಿಸಿ" : "We just sent a security verification code to your profile"}
                  </p>
                </div>

                {/* Email with pencil */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="flex items-center gap-2 max-w-[80%]">
                    <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-700 truncate">{email}</span>
                  </div>
                  <button
                    id="otp-pencil-edit-email"
                    type="button"
                    onClick={() => setStep("details")}
                    className={`p-1.5 rounded-lg hover:bg-slate-200/50 ${theme.text} transition-colors focus:outline-none`}
                    title="Change email"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  {/* Auto-focused 6-digit individual input fields */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block text-center">
                      {language === "kn" ? "6-ಅಂಕಿಯ ಕೋಡ್" : "6-Digit Secure OTP"}
                    </label>
                    <div className="flex gap-2 justify-between">
                      {otpCode.map((digit, index) => (
                        <input
                          key={`otp-${index}`}
                          id={`otp-input-field-${index}`}
                          ref={(el) => (otpInputs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          required
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className={`w-14 h-14 text-center text-2xl font-bold rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-300 focus:bg-white focus:outline-none transition transform duration-150 ${theme.focusRing}`}
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    id="otp-continue-submit-btn"
                    type="submit"
                    disabled={isLoading}
                    className={`w-full h-14 rounded-2xl font-bold text-lg shadow-sm transition transform duration-200 ease-out flex items-center justify-center gap-3 cursor-pointer ${theme.primary}`}
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{language === "kn" ? "ಪರಿಶೀಲಿಸಿ" : "Submit OTP Verification"}</span>
                        <Check className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Resend actions block */}
                <div className="flex flex-col items-center justify-center gap-2 pt-2 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-500">
                    {language === "kn" ? "ಕೋಡ್ ಬಂದಿಲ್ಲವೇ?" : "Didn't receive your code?"}{" "}
                    {resendTimer > 0 ? (
                      <span className="font-bold text-slate-700">Resend in {resendTimer}s</span>
                    ) : (
                      <button
                        id="otp-resend-button"
                        type="button"
                        onClick={handleResendCode}
                        className={`font-extrabold ${theme.text} hover:underline focus:outline-none`}
                      >
                        {language === "kn" ? "ಕೋಡ್ ಮರುಕಳುಹಿಸಿ" : "Resend Code"}
                      </button>
                    )}
                  </p>
                  <button
                    id="otp-get-help-button"
                    type="button"
                    onClick={() => setStep("help")}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-semibold focus:outline-none"
                  >
                    <HelpCircle className="w-4.5 h-4.5" />
                    {language === "kn" ? "ಸಹಾಯ ಬೇಕೇ?" : "Need help with verification?"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW 5: FORGOT PASSWORD EMAIL REQUEST VIEW */}
            {step === "forgot-email" && (
              <motion.div
                key="forgot-email-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {language === "kn" ? "ಗುಪ್ತಪದ ಮರುಹೊಂದಿಸಿ" : "Reset Password"}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {language === "kn" ? "ಸುರಕ್ಷಿತ ಕೋಡ್ ಪಡೆಯಲು ನಿಮ್ಮ ಇಮೇಲ್ ಹಾಕಿ" : "Enter email and we will dispatch a reset code"}
                  </p>
                </div>

                <form onSubmit={handleForgotEmailSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {language === "kn" ? "ನೋಂದಾಯಿತ ಇಮೇಲ್ ವಿಳಾಸ" : "Registered Email"}
                    </label>
                    <input
                      id="forgot-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@fundcircle.com"
                      className={`h-14 w-full px-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:bg-white text-base transition-all duration-200 ease-out focus:outline-none ${theme.focusRing}`}
                    />
                  </div>

                  <button
                    id="forgot-email-submit-btn"
                    type="submit"
                    disabled={isLoading}
                    className={`w-full h-14 rounded-2xl font-bold text-lg shadow-sm transition transform duration-200 ease-out flex items-center justify-center gap-3 cursor-pointer ${theme.primary}`}
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{language === "kn" ? "ಮರುಹೊಂದಿಸುವ ಕೋಡ್ ಕಳುಹಿಸಿ" : "Dispatched Reset Code"}</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center pt-2">
                  <button
                    id="forgot-email-back-btn"
                    type="button"
                    onClick={() => setStep("password")}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 focus:outline-none flex items-center justify-center gap-1 mx-auto"
                  >
                    <ArrowLeft className="w-4 h-4" /> Go Back
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW 6: RESET PASSWORD OTP CODE VIEW */}
            {step === "forgot-otp" && (
              <motion.div
                key="forgot-otp-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {language === "kn" ? "ಕೋಡ್ ದೃಢೀಕರಿಸಿ" : "Confirm Code"}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {language === "kn" ? "ಪಾಸ್ವರ್ಡ್ ರಿಸೆಟ್ ಮಾಡಲು ಕಳುಹಿಸಲಾದ ಕೋಡ್ ಹಾಕಿ" : "Input the verification key we shared in the recovery email"}
                  </p>
                </div>

                {/* Email Display with Pencil */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="flex items-center gap-2 max-w-[80%]">
                    <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-700 truncate">{email}</span>
                  </div>
                  <button
                    id="forgot-otp-pencil-edit"
                    type="button"
                    onClick={() => setStep("forgot-email")}
                    className={`p-1.5 rounded-lg hover:bg-slate-200/50 ${theme.text} transition-colors focus:outline-none`}
                    title="Change Recovery Email"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleForgotOtpSubmit} className="space-y-6">
                  {/* Auto-focused 6-digit individual input fields */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block text-center">
                      {language === "kn" ? "ಪರಿಶೀಲನಾ ಕೋಡ್ ನಮೂದಿಸಿ" : "Reset OTP Key"}
                    </label>
                    <div className="flex gap-2 justify-between">
                      {otpCode.map((digit, index) => (
                        <input
                          key={`forgot-otp-${index}`}
                          id={`forgot-otp-input-${index}`}
                          ref={(el) => (otpInputs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          required
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className={`w-14 h-14 text-center text-2xl font-bold rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-300 focus:bg-white focus:outline-none transition transform duration-150 ${theme.focusRing}`}
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    id="forgot-otp-continue-btn"
                    type="submit"
                    disabled={isLoading}
                    className={`w-full h-14 rounded-2xl font-bold text-lg shadow-sm transition transform duration-200 ease-out flex items-center justify-center gap-3 cursor-pointer ${theme.primary}`}
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{language === "kn" ? "ಕೋಡ್ ಪರಿಶೀಲಿಸಿ" : "Continue"}</span>
                        <Check className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Resend actions block */}
                <div className="text-center pt-2">
                  {resendTimer > 0 ? (
                    <span className="text-xs text-slate-400 font-semibold">Resend OTP in {resendTimer}s</span>
                  ) : (
                    <button
                      id="forgot-otp-resend-btn"
                      type="button"
                      onClick={handleResendCode}
                      className={`text-xs font-extrabold ${theme.text} hover:underline focus:outline-none`}
                    >
                      Resend Code
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* VIEW 7: CREATE NEW PASSWORD VIEW */}
            {step === "reset-password" && (
              <motion.div
                key="reset-password-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {language === "kn" ? "ಹೊಸ ಐಡಿಯಾ ಗುಪ್ತಪದ" : "Set New Password"}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {language === "kn" ? "ನಿಮ್ಮ ಸುರಕ್ಷತೆಗಾಗಿ ಹೊಸ ಕಠಿಣ ಪಾಸ್ವರ್ಡ್ ಇಟ್ಟುಕೊಳ್ಳಿ" : "Establish your secure entry phrase credential ledgers"}
                  </p>
                </div>

                <form onSubmit={handleCreateNewPassword} className="space-y-4">
                  {/* Pass 1 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {language === "kn" ? "ಹೊಸ ಗುಪ್ತಪದ" : "New Password"}
                    </label>
                    <div className="relative">
                      <input
                        id="new-password-input-1"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className={`h-14 w-full px-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:bg-white text-base transition-all duration-200 ease-out focus:outline-none ${theme.focusRing}`}
                      />
                      <button
                        id="new-password-toggle-1"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 p-0.5 text-slate-450 hover:text-slate-650 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Pass 2 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {language === "kn" ? "ಮತ್ತೊಮ್ಮೆ ನಮೂದಿಸಿ" : "Confirm Password"}
                    </label>
                    <input
                      id="new-password-input-2"
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className={`h-14 w-full px-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:bg-white text-base transition-all duration-200 ease-out focus:outline-none ${theme.focusRing}`}
                    />
                  </div>

                  <button
                    id="new-password-submit-btn"
                    type="submit"
                    disabled={isLoading}
                    className={`w-full h-14 rounded-2xl font-bold text-lg shadow-sm transition transform duration-200 ease-out flex items-center justify-center gap-3 cursor-pointer ${theme.primary}`}
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{language === "kn" ? "ಗುಪ್ತಪದ ಬದಲಾಯಿಸಿ" : "Save Credentials"}</span>
                        <Check className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* VIEW 8: GET HELP / CUSTOM SUPPORT EXPORTER VIEW */}
            {step === "help" && (
              <motion.div
                key="help-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 text-center py-4"
              >
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto border border-blue-100 shadow-sm">
                  <HelpCircle className="w-8 h-8" />
                </div>
                
                <div className="space-y-2 max-w-sm mx-auto">
                  <h1 className="text-xl font-black text-slate-900">
                    {language === "kn" ? "ಗ್ರಾಹಕ ಬೆಂಬಲ ಮತ್ತು ಸಹಾಯ" : "FundCircle Verification Help"}
                  </h1>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {language === "kn" ? "ಒಟಿಪಿ ಕೋಡ್ ಸ್ವೀಕರಿಸಲು ತೊಂದರೆ ಆದಲ್ಲಿ ದಯವಿಟ್ಟು ನಮ್ಮ ಅಧಿಕೃತ ಸಿಬ್ಬಂದಿ ಸಹಾಯ ಪಡೆದುಕೊಳ್ಳಿ." : "If you are using a protected rural mobile device, please check if DND filters are blocking standard transaction dispatches."}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl text-left border border-slate-100">
                  <p className="text-xs font-bold text-slate-755 uppercase tracking-wide mb-1">Direct Operator Support</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-3">Your local branch coordinator has primary administrative override.</p>
                  <a
                    id="support-email-btn"
                    href="mailto:support@fundcircle.com?subject=Pigmy verification problem"
                    className={`w-full h-14 rounded-2xl font-bold text-base shadow-none border-0 transition transform duration-200 ease-out flex items-center justify-center gap-2 cursor-pointer ${theme.primary}`}
                  >
                    <Mail className="w-5 h-5" />
                    <span>Email Support Desk</span>
                  </a>
                </div>

                <button
                  id="help-dismiss-btn"
                  type="button"
                  onClick={() => setStep("verify")}
                  className="text-sm font-bold text-slate-550 hover:text-slate-800 transition-colors focus:outline-none flex items-center justify-center gap-2 mx-auto"
                >
                  <ArrowLeft className="w-5 h-5" /> Dismiss & Return
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
