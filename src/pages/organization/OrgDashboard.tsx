import { useOrganization, useUser, SignOutButton } from "@clerk/clerk-react";
import { LogOut, Building, Users, Wallet, CreditCard, FileText, Settings, Bell, Menu, CalendarDays, ClipboardList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeClerkRole, isAgentRole, isCustomerRole, isOwnerRole } from "@/lib/auth/get-user-role";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { membershipIdFor } from "@/lib/services";
import { useDocumentRealtime } from "@/lib/firestore-hooks";
import { Navigate } from "react-router-dom";
import OrgOverview from "./OrgOverview";
import OrgCustomers from "./OrgCustomers";
import OrgAgents from "./OrgAgents";
import OrgCollections from "./OrgCollections";
import OrgLoans from "./OrgLoans";
import OrgReports from "./OrgReports";
import AgentOverview from "../agent/AgentOverview";
import AgentCustomers from "../agent/AgentCustomers";

export default function OrgDashboard() {
  const { isLoaded: isUserLoaded, user, isSignedIn } = useUser();
  const { isLoaded: isOrgLoaded, organization } = useOrganization();
  const [activeTab, setActiveTab] = useState("overview");
  const [mode, setMode] = useState<"admin" | "collector">("admin");

  const { data: userDoc, loading: userDocLoading } = useDocumentRealtime<any>("users", user?.id || null);
  const membershipDocId = user && organization ? membershipIdFor(organization.id, user.id) : null;
  const { data: membershipDoc, loading: membershipDocLoading } = useDocumentRealtime<any>("memberships", membershipDocId);

  const clerkRole = normalizeClerkRole((user?.publicMetadata as any)?.role as string | undefined);
  const membershipRoleNormalized = normalizeClerkRole(membershipDoc?.role?.toString() || null);
  const dbUserRoleNormalized = normalizeClerkRole(userDoc?.role?.toString() || null);
  const effectiveRole = membershipRoleNormalized || dbUserRoleNormalized || clerkRole || null;
  const isOwner = isOwnerRole(effectiveRole);

  const adminMenuItems = [
    { id: "overview", label: "Dashboard", leadingIcon: <Building className="w-5 h-5" /> },
    { id: "customers", label: "Customers", leadingIcon: <Users className="w-5 h-5" /> },
    { id: "agents", label: "Agents", leadingIcon: <Users className="w-5 h-5" /> },
    { id: "collections", label: "Collections", leadingIcon: <Wallet className="w-5 h-5" /> },
    { id: "loans", label: "Loans", leadingIcon: <CreditCard className="w-5 h-5" /> },
    { id: "reports", label: "Reports", leadingIcon: <FileText className="w-5 h-5" /> },
  ];

  const collectorMenuItems = [
    { id: "daily", label: "Today's Route", leadingIcon: <CalendarDays className="w-5 h-5" /> },
    { id: "customerLedger", label: "Customer Ledger", leadingIcon: <Users className="w-5 h-5" /> },
    { id: "collectionEntry", label: "Collection Entry", leadingIcon: <ClipboardList className="w-5 h-5" /> },
  ];

  const menuItems = mode === "admin" ? adminMenuItems : collectorMenuItems;

  useEffect(() => {
    if (user && organization) {
      const syncRecord = async () => {
        try {
          await setDoc(doc(db, "organizations", organization.id), {
            id: organization.id,
            name: organization.name,
            createdAt: serverTimestamp()
          }, { merge: true });

          await setDoc(doc(db, "users", user.id), {
            name: user.fullName || "Owner",
            email: user.primaryEmailAddress?.emailAddress || "",
            ...(effectiveRole ? { role: effectiveRole } : {}),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.error("Sync error:", err);
        }
      };
      syncRecord();
    }
  }, [user?.id, organization?.id]);

  if (!isUserLoaded || !isOrgLoaded || (user && (userDocLoading || membershipDocLoading))) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Loading your secure workspace...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return <Navigate to="/organization/signin" replace />;
  }

  // Route protection and redirection
  if (isCustomerRole(effectiveRole)) {
    return <Navigate to="/dashboard/customer" replace />;
  }

  if (isAgentRole(effectiveRole)) {
    return <Navigate to="/dashboard/agent" replace />;
  }

  if (!organization) {
    if (isOwnerRole(effectiveRole) || effectiveRole === "organization") {
      return <Navigate to="/organization/create" replace />;
    }
    if (isAgentRole(effectiveRole)) {
      return <Navigate to="/agent/dashboard" replace />;
    }
    return <Navigate to="/customer/dashboard" replace />;
  }

  // Fallback for when org isn't loaded properly in Clerk setup yet
  const orgName = organization?.name || "My Organization";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex flex-col gap-3 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg">{orgName}</span>
          </div>
          <Sheet>
            <SheetTrigger render={
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            } />
            <SheetContent side="left" className="w-[280px] p-0">
              <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} orgName={orgName} user={user} menuItems={menuItems} />
            </SheetContent>
          </Sheet>
        </div>
        {isOwner ? (
          <div className="flex gap-2">
            <Button
              variant={mode === "admin" ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setMode("admin");
                setActiveTab("overview");
              }}
            >
              Admin Mode
            </Button>
            <Button
              variant={mode === "collector" ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setMode("collector");
                setActiveTab("daily");
              }}
            >
              Collector Mode
            </Button>
          </div>
        ) : null}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0">
        <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} orgName={orgName} user={user} menuItems={menuItems} isOwner={isOwner} mode={mode} setMode={setMode} />
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* We hide the default tabs list since we navigate via sidebar */}
          <div className="hidden"><TabsList><TabsTrigger value="overview">Overview</TabsTrigger></TabsList></div>
          
          <TabsContent value="overview" className="mt-0">
            <OrgOverview />
          </TabsContent>
          <TabsContent value="customers" className="mt-0">
            <OrgCustomers />
          </TabsContent>
          <TabsContent value="agents" className="mt-0">
            <OrgAgents />
          </TabsContent>
          <TabsContent value="collections" className="mt-0">
            <OrgCollections />
          </TabsContent>
          <TabsContent value="loans" className="mt-0">
            <OrgLoans />
          </TabsContent>
          <TabsContent value="reports" className="mt-0">
            <OrgReports />
          </TabsContent>

          <TabsContent value="daily" className="mt-0">
            <AgentOverview />
          </TabsContent>
          <TabsContent value="customerLedger" className="mt-0">
            <AgentCustomers collectorRole={isOwner ? "OWNER" : "AGENT"} collectorName={user?.fullName || ""} collectorId={user?.id || ""} />
          </TabsContent>
          <TabsContent value="collectionEntry" className="mt-0">
            <OrgCollections />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function SidebarContent({ activeTab, setActiveTab, orgName, user, menuItems, isOwner, mode, setMode }: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-100 hidden md:block">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 truncate">{orgName}</h1>
            <p className="text-xs text-slate-500">Pigmy Platform</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-1">
        {isOwner ? (
          <div className="flex gap-2 mb-4 px-1">
            <Button
              variant={mode === "admin" ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setMode("admin");
                setActiveTab("overview");
              }}
            >
              Admin
            </Button>
            <Button
              variant={mode === "collector" ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setMode("collector");
                setActiveTab("daily");
              }}
            >
              Collector
            </Button>
          </div>
        ) : null}

        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
              activeTab === item.id 
                ? "bg-blue-50 text-blue-700 font-medium" 
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.leadingIcon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-3 mb-4">
          <Avatar>
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback>{user?.firstName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-slate-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>
        <SignOutButton>
          <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </SignOutButton>
      </div>
    </div>
  );
}
