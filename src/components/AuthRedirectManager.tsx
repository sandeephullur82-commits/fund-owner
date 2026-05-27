import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";

const authEntryPaths = [
  "/",
  "/sign-in",
  "/sign-up",
  "/organization/signin",
  "/organization/signup",
  "/agent/login",
  "/customer/signin",
];

const isAuthEntryPath = (pathname: string) => {
  return authEntryPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
};

export default function AuthRedirectManager() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const onAuthEntry = isAuthEntryPath(path);

  useEffect(() => {
    if (!isLoaded) {
      setChecking(true);
      return;
    }

    if (!isSignedIn || !user) {
      if (!onAuthEntry && path !== "/organization/invitation") {
        navigate("/sign-in", { replace: true });
      }
      setChecking(false);
      return;
    }

    if (onAuthEntry && path !== "/auth/callback") {
      navigate("/auth/callback", { replace: true });
    }
    setChecking(false);
  }, [isLoaded, isSignedIn, user, navigate, path, onAuthEntry]);

  if (!isLoaded || (onAuthEntry && checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-4" />
          <p className="text-sm text-slate-500">Checking your session…</p>
        </div>
      </div>
    );
  }

  return null;
}
