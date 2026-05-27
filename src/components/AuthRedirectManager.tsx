import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";

const signedInRedirectPaths = [
  "/sign-in",
  "/sign-up",
  "/organization/signin",
  "/organization/signup",
  "/agent/login",
  "/customer/signin",
];

const publicPaths = [
  "/",
  "/workspace-selection",
  "/organization/invitation",
];

const isSignedInRedirectPath = (pathname: string) =>
  signedInRedirectPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const isPublicPath = (pathname: string) =>
  publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const isProtectedPath = (pathname: string) =>
  !isPublicPath(pathname) &&
  !isSignedInRedirectPath(pathname) &&
  pathname !== "/auth/callback";

export default function AuthRedirectManager() {
  const { isLoaded, isSignedIn, user } = useUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user && isSignedInRedirectPath(pathname)) {
      navigate("/auth/callback", { replace: true });
      return;
    }

    if (!isSignedIn && isProtectedPath(pathname)) {
      navigate("/sign-in", { replace: true });
    }
  }, [isLoaded, isSignedIn, user, navigate, pathname]);

  if (!isLoaded && isProtectedPath(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto mb-4" />
          <p className="text-sm text-slate-500">Checking your session…</p>
        </div>
      </div>
    );
  }

  return null;
}
