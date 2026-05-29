import React, { useState } from "react";
import { useOrganizationList, useUser } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Users, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/languageContext";
import { activatePendingInvite } from "@/lib/services";
import { BrandMark } from "@/components/BrandLogo";
import BackToHomeButton from "@/components/BackToHomeButton";

export default function OrgInvitation() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isLoaded: isInvitationsLoaded, userInvitations, setActive } = useOrganizationList({ userInvitations: true });
  const navigate = useNavigate();
  const { language } = useLanguage();

  const [isLoading, setIsLoading] = useState(false);

  const pendingInvitations = userInvitations?.data || [];
  const loadingInvitations = !isLoaded || !isInvitationsLoaded || userInvitations?.isLoading;

  const handleAcceptInvitation = async (invitation: any) => {
    setIsLoading(true);
    try {
      await invitation.accept();
      if (setActive) {
        await setActive({ organization: invitation.publicOrganizationData.id });
      }
      if (user?.primaryEmailAddress?.emailAddress) {
        await activatePendingInvite(
          user.primaryEmailAddress.emailAddress,
          invitation.publicOrganizationData.id,
          user.id,
          user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim()
        );
      }
      toast.success("Invitation accepted successfully.");
      navigate("/router");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to accept invitation");
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingInvitations) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-xs text-slate-400 font-semibold animate-pulse">Checking your organization invitations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-between items-center px-1">
          <Link to="/" className="flex items-center gap-1">
            <BrandMark />
          </Link>
          <div className="text-xs font-bold text-slate-400 text-right">Organization Invitations</div>
        </div>
        <div>
          <BackToHomeButton dark={false} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl space-y-6"
        >
          <div className="space-y-1.5 pb-4 border-b border-slate-100/80">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              <Users className="w-3.5 h-3.5" /> Invitation inbox
            </div>
            <h1 className="text-xl font-bold text-slate-800 pt-1">Accept your workspace invite</h1>
            <p className="text-xs text-slate-500">
              Connect your Clerk identity with the organization you were invited to. Once accepted, your account will join the organization and membership data will sync automatically.
            </p>
          </div>

          {pendingInvitations.length > 0 ? (
            <div className="space-y-4">
              {pendingInvitations.map((invite: any) => (
                <div key={invite.id} className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">{invite.publicOrganizationData.name}</p>
                      <p className="mt-2 text-slate-900 font-semibold">Role: {invite.role}</p>
                      <p className="mt-1 text-sm text-slate-500">Organization: {invite.publicOrganizationData.name}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => navigate("/")}
                      disabled={isLoading}
                      className="h-10 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-all"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleAcceptInvitation(invite)}
                      disabled={isLoading}
                      className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      {isLoading ? "Accepting..." : "Accept Invitation"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 text-center py-6">
              <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">No pending organization invitations found.</p>
              <p className="text-xs text-slate-500">If you were expecting an invite, make sure you are signed in with the invited email address.</p>
              <button
                onClick={() => navigate("/router")}
                className="mt-4 h-11 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Continue to your workspace
              </button>
            </div>
          )}
        </motion.div>

        <div className="text-center">
          <Link
            id="invitation-back-link"
            to="/"
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
