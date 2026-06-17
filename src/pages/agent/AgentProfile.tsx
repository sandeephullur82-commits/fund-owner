import { SignOutButton } from "@clerk/clerk-react";
import { useUser, useOrganization } from "@clerk/clerk-react";
import { useCollectionRealtime } from "@/lib/firestore-hooks";
import { useDocumentRealtime } from "@/lib/firestore-hooks";
import { Membership, Collection } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Users, IndianRupee, Building2, Mail, Phone, BadgeCheck } from "lucide-react";
import { startOfDay, startOfMonth } from "date-fns";
import { where } from "firebase/firestore";
import { toDate } from "@/components/agent/CollectDialog";
import { membershipIdFor } from "@/lib/services";

export default function AgentProfile() {
  const { user }         = useUser();
  const { organization } = useOrganization();

  const agentId   = user?.id || "";
  const orgId     = organization?.id || "";

  const { data: assignedCustomers } = useCollectionRealtime<Membership>("organizationMembers", [
    where("role", "==", "CUSTOMER"),
    where("assignedAgentId", "==", agentId || "NONE"),
  ]);
  const { data: collections } = useCollectionRealtime<Collection>("collections", [
    where("agentId", "==", agentId || "NONE"),
  ]);
  const { data: membershipDoc } = useDocumentRealtime<any>(
    "organizationMembers",
    user && organization ? membershipIdFor(organization.id, user.id) : null
  );

  const today      = startOfDay(new Date());
  const thisMonth  = startOfMonth(new Date());

  const todayCollections  = collections.filter((c) => toDate(c.collectedAt || (c as any).timestamp) >= today);
  const monthCollections  = collections.filter((c) => toDate(c.collectedAt || (c as any).timestamp) >= thisMonth);

  const todayTotal  = todayCollections.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const monthTotal  = monthCollections.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const activeCustomers = assignedCustomers.filter((c) => (c as any).status === "ACTIVE");

  const shortId = (id: string) => `FC-${id.slice(-6).toUpperCase()}`;

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      {/* Agent Card */}
      <Card className="shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-6 pt-6 pb-10" />
        <CardContent className="px-6 pb-6 -mt-8">
          <div className="flex items-end gap-4 mb-4">
            <Avatar className="h-16 w-16 ring-4 ring-white shadow-lg">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-2xl font-black">
                {user?.firstName?.charAt(0) || "A"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-1">
              <p className="text-lg font-black text-slate-900 truncate">{user?.fullName || "Agent"}</p>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-600">Verified Collector</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {user?.primaryEmailAddress?.emailAddress && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{user.primaryEmailAddress.emailAddress}</span>
              </div>
            )}
            {(membershipDoc as any)?.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{(membershipDoc as any).phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <BadgeCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-mono text-xs">{shortId(agentId)} · Agent</span>
            </div>
            {organization && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{organization.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-slate-50">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-xl mx-auto mb-2">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{activeCustomers.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Assigned Customers</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center w-10 h-10 bg-emerald-200 rounded-xl mx-auto mb-2">
              <IndianRupee className="w-5 h-5 text-emerald-700" />
            </div>
            <p className="text-2xl font-black text-emerald-800">₹{todayTotal.toLocaleString()}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Today's Collections</p>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50 border-indigo-100">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-xl mx-auto mb-2">
              <IndianRupee className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-indigo-800">₹{monthTotal.toLocaleString()}</p>
            <p className="text-xs text-indigo-600 mt-0.5">This Month</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-50">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center w-10 h-10 bg-slate-200 rounded-xl mx-auto mb-2">
              <IndianRupee className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-2xl font-black text-slate-800">{todayCollections.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Today's Transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Logout */}
      <SignOutButton>
        <Button variant="outline" className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 gap-2 font-semibold">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </SignOutButton>
    </div>
  );
}
