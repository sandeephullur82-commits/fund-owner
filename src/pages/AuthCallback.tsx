import { useEffect, useState } from "react";
import { useUser, useOrganization, useOrganizationList } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { resolveUserRedirectTarget } from "@/lib/auth/redirect-user";

export default function AuthCallbackPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { organization } = useOrganization();
  const { isLoaded: orgListLoaded, setActive, userMemberships, userInvitations } = useOrganizationList({ userMemberships: true, userInvitations: true });
  const navigate = useNavigate();
  const [status, setStatus] = useState("Checking your session…");

  useEffect(() => {
    if (!isLoaded || !orgListLoaded) return;

    const performRedirect = async () => {
      if (!isSignedIn || !user) {
        navigate("/sign-in", { replace: true });
        return;
      }

      setStatus("Preparing your workspace…");

      try {
        if (!organization?.id && userMemberships?.data?.length && setActive) {
          await setActive({ organization: userMemberships.data[0].organization.id });
        }

        const activeOrgId = organization?.id || userMemberships?.data?.[0]?.organization?.id || null;
        const redirect = await resolveUserRedirectTarget(user, activeOrgId);

        if (!redirect.membership) {
          if (userInvitations?.data?.length) {
            navigate("/organization/invitation", { replace: true });
            return;
          }
          navigate("/onboarding", { replace: true });
          return;
        }

        if (redirect.organizationId && setActive && organization?.id !== redirect.organizationId) {
          try {
            await setActive({ organization: redirect.organizationId });
          } catch {
            // ignore; still navigate
          }
        }

        navigate(redirect.path, { replace: true });
      } catch (error: any) {
        console.error("Auth callback failed:", error);
        toast.error(error?.message || "Unable to finish authentication.");
        navigate("/sign-in", { replace: true });
      }
    };

    performRedirect();
  }, [isLoaded, isSignedIn, user, orgListLoaded, organization?.id, setActive, userMemberships?.data, userInvitations?.data, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-sm w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
        <div className="mb-5 flex justify-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 text-white font-bold text-lg shadow-lg shadow-sky-300/40">
            FC
          </div>
        </div>
        <div className="mb-4 flex justify-center">
          <div className="w-8 h-8 rounded-full border-[3px] border-sky-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-500">{status}</p>
      </div>
    </div>
  );
}
