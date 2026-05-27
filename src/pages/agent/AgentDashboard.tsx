import { useUser, useOrganization, SignOutButton } from "@clerk/clerk-react";
import { LogOut, Users, Wallet, CreditCard, CalendarDays, Contact, Menu } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import AgentOverview from "./AgentOverview";
import AgentCustomers from "./AgentCustomers";

export default function AgentDashboard() {
  const { isLoaded: isUserLoaded, isSignedIn, user } = useUser();
  const { isLoaded: isOrgLoaded, organization } = useOrganization();
  const [activeTab, setActiveTab] = useState("overview");

  if (!isUserLoaded || !isOrgLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Loading your agent console...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return <Navigate to="/agent/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
              <Contact className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 truncate">Agent Portal</h1>
              <p className="text-xs text-slate-500">{organization?.name}</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
              activeTab === "overview" ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            <span>Today's Plan</span>
          </button>
          <button
            onClick={() => setActiveTab("customers")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
              activeTab === "customers" ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Users className="w-5 h-5" />
            <span>My Customers</span>
          </button>
        </div>

        <div className="p-4 border-t border-slate-100">
          <SignOutButton>
            <Button variant="outline" className="w-full justify-start text-slate-600">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </SignOutButton>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-5xl mx-auto">
        <div className="md:hidden flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-2">
            <Contact className="w-6 h-6 text-emerald-600" />
            <span className="font-bold">Agent Portal</span>
           </div>
           <SignOutButton>
            <Button variant="ghost" size="icon" className="text-slate-500"><LogOut className="w-5 h-5" /></Button>
           </SignOutButton>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Mobile Tabs List */}
          <TabsList className="grid w-full grid-cols-2 md:hidden mb-6">
            <TabsTrigger value="overview">Today</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-0">
            <AgentOverview />
          </TabsContent>
          <TabsContent value="customers" className="mt-0">
            <AgentCustomers />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
