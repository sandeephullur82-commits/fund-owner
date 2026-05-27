import React, { useState, useEffect } from "react";
import { useUser, useClerk, useSession } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { toast } from "sonner";
import { 
  User, Mail, Shield, LogOut, Trash2, Camera, Check, 
  Link2, Laptop, Clock, ArrowLeft, RefreshCw, Key, ChevronRight
} from "lucide-react";
import { useLanguage } from "@/lib/languageContext";

export default function UserProfilePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut, client } = useClerk();
  const { session } = useSession();
  const navigate = useNavigate();
  const { language } = useLanguage();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  // Populate first/last name when user loaded
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdating(true);
    try {
      // Update real Clerk server profile
      await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });
      toast.success("Profile saved successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.errors?.[0]?.message || err.message || "Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUpdating(true);
    try {
      // Set profile image on real Clerk account
      await user.setProfileImage({ file });
      toast.success("Profile image updated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.errors?.[0]?.message || "Image file too large or invalid format");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully!");
      navigate("/");
    } catch (err) {
      toast.error("Logout failed");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== "DELETE") {
      return toast.error("Please type DELETE to confirm");
    }
    if (!user) return;

    setIsUpdating(true);
    try {
      // Direct deletion of real account from Clerk database
      await user.delete();
      toast.success("Your profile ledger has been permanently erased.");
      await signOut();
      navigate("/");
    } catch (err: any) {
      console.error(err);
      toast.error(err.errors?.[0]?.message || "Action requires recent sign-in validation. Please relogin and try again");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Syncing Profile...</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 text-center">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-4">
          <Shield className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-800">Authentication Required</h1>
          <p className="text-sm text-slate-500">You must be logged in to access and manage your profile records.</p>
          <Link to="/" className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Back Link */}
        <div id="btn-back-wrapper" className="flex justify-between items-center px-1">
          <Link
            id="profile-back-link"
            to="/router"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </Link>
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Account Ledger Security</div>
        </div>

        {/* PROFILE HEADER CARD */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-md flex flex-col md:flex-row items-center gap-6">
          {/* Avatar Area with Edit hover Overlay */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 shadow-inner bg-slate-100 flex items-center justify-center">
              {user.imageUrl ? (
                <img referrerPolicy="no-referrer" src={user.imageUrl} alt={user.fullName || "User"} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-slate-400" />
              )}
            </div>
            {/* Hover Trigger input */}
            <label className="absolute inset-0 bg-black/40 hover:bg-black/55 text-white flex items-center justify-center rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Camera className="w-5 h-5" />
              <input type="file" accept="image/*" onChange={handleProfileImageChange} className="hidden" />
            </label>
          </div>

          <div className="flex-1 text-center md:text-left space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 font-bold text-[10px] uppercase">
              Trustee Level: Agent
            </div>
            <h1 className="text-2xl font-black text-slate-900 truncate">{user.fullName || "Trustee Account"}</h1>
            <p className="text-sm text-slate-500 truncate flex items-center justify-center md:justify-start gap-1.5">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" /> {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>

        {/* PERSONAL DETAIL SETTING */}
        <div id="personal-detail-card" className="bg-white border border-slate-200/85 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
          <h2 className="text-md font-extrabold text-slate-800 pb-3 border-b border-slate-100">Personal Details</h2>
          <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="pf-fname-input" className="text-xs font-bold text-slate-500 uppercase tracking-wide">First Name</label>
              <input
                id="pf-fname-input"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-11 w-full px-3.5 rounded-xl border border-slate-200 bg-slate-50/20 text-sm whitespace-nowrap focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
              />
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="pf-lname-input" className="text-xs font-bold text-slate-500 uppercase tracking-wide">Last Name</label>
              <input
                id="pf-lname-input"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-11 w-full px-3.5 rounded-xl border border-slate-200 bg-slate-50/20 text-sm whitespace-nowrap focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2 pt-2 text-right">
              <button
                id="profile-save-btn"
                type="submit"
                disabled={isUpdating}
                className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer transition-all active:scale-[0.98] inline-flex items-center gap-1.5"
              >
                {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* CONNECTED ACCOUNTS SECTION */}
        <div id="connected-accounts-card" className="bg-white border border-slate-200/85 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
          <h2 className="text-md font-extrabold text-slate-800 pb-3 border-b border-slate-100">Connected Accounts</h2>
          <div className="space-y-3.5">
            {user.externalAccounts.map((account) => (
              <div key={account.id} className="flex justify-between items-center p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Link2 className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 uppercase">{account.provider}</p>
                    <p className="text-[11px] text-slate-500">{account.emailAddress}</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-150 text-[10px] font-bold text-emerald-600 uppercase">
                  Connected
                </div>
              </div>
            ))}
            {user.externalAccounts.length === 0 && (
              <div className="p-3.5 bg-slate-50/50 text-slate-400 text-xs font-semibold rounded-2xl text-center border border-dashed border-slate-200">
                No external OAuth accounts linked to this profile.
              </div>
            )}
          </div>
        </div>

        {/* SECURITY & ACTIVE SESSIONS SECTION */}
        <div id="active-sessions-card" className="bg-white border border-slate-200/85 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
          <h2 className="text-md font-extrabold text-slate-800 pb-3 border-b border-slate-100">Active Security Sessions</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3.5 bg-blue-50/40 rounded-2xl border border-blue-100/60">
              <div className="flex gap-2.5 items-center">
                <Laptop className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Current Web Session (Chrome/Firefox)</p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold mt-1">
                    <Clock className="w-3.5 h-3.5" /> Activated: May 26, 2026 (At: {new Date(session?.lastActiveAt || Date.now()).toLocaleTimeString()})
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold uppercase rounded-md">Live Action</span>
            </div>
          </div>
        </div>

        {/* RED RISK TRIGGERS (LOGOUT & DELETE ACCOUNT) */}
        <div id="risk-triggers-card" className="bg-white border border-slate-200/85 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
          <h2 className="text-md font-extrabold text-slate-800 pb-3 border-b border-slate-100">Trust Options</h2>
          <div className="space-y-4">
            
            {/* Standard SignOut */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-800">Logout of FundCircle</p>
                <p className="text-[10px] text-slate-500">Sign out of your active browser session on this device safely.</p>
              </div>
              <button
                id="profile-logout-btn"
                onClick={handleLogout}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" /> Logout Account
              </button>
            </div>

            {/* Permanent Account Erase */}
            <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/80 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-rose-900">Erase Ledger Information Permanently</p>
                  <p className="text-[10px] text-rose-500/90">This deletes your credentials, logs, and files completely from Clerk directories.</p>
                </div>
                {!showDeleteConfirm && (
                  <button
                    id="profile-delete-trigger"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="h-9 px-4 border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition-all"
                  >
                    Delete Account
                  </button>
                )}
              </div>

              {showDeleteConfirm && (
                <div className="space-y-3.5 pt-3 border-t border-rose-200/40">
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-150 text-[11px] text-rose-955 font-medium leading-relaxed">
                     **CRITICAL NOTICE:** This operation is irreversible. All of your connected deposit ledgers will remain in the database, but your direct access login will be completely deleted.
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="dl-con-input" className="text-[10px] font-bold text-rose-700 uppercase">Type <span className="underline">DELETE</span> to proceed:</label>
                    <div className="flex gap-2">
                      <input
                        id="dl-con-input"
                        type="text"
                        placeholder="Type DELETE..."
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        className="h-10 px-3.5 rounded-xl border border-rose-250 bg-white text-xs focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 text-rose-900 placeholder-rose-300 flex-1 focus:outline-none"
                      />
                      <button
                        id="profile-delete-final-btn"
                        onClick={handleDeleteAccount}
                        disabled={isUpdating}
                        className="h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                      >
                        <Trash2 className="w-4 h-4" /> Erase Now
                      </button>
                      <button
                        id="profile-delete-cancel-btn"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteInput("");
                        }}
                        className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
