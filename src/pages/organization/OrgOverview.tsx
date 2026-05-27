import { useCollectionRealtime } from "@/lib/firestore-hooks";
import { Collection, Loan, Membership } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, CreditCard, TrendingUp, IndianRupee } from "lucide-react";
import { format } from "date-fns";

export default function OrgOverview() {
  const { data: collections, loading: collLoading } = useCollectionRealtime<Collection>("collections");
  const { data: members, loading: membersLoading } = useCollectionRealtime<Membership>("organizationMembers");
  const { data: loans, loading: loansLoading } = useCollectionRealtime<Loan>("loans");

  if (collLoading || membersLoading || loansLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 w-48 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const customers = members.filter((u) => u.role === "CUSTOMER" || u.role === "customer");
  const agents = members.filter((u) => u.role === "AGENT" || u.role === "agent");

  // Calculate today's collections
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const todayCollections = collections.filter(c => {
    // Handling standard JS timestamp vs Firestore timestamp
    // Assuming timestamp saved natively in JS via serverTimestamp
    // We'll evaluate if `timestamp` is an object with toDate() or a number
    const collDate = (c.timestamp as any)?.toDate?.() || new Date(c.timestamp);
    return collDate >= today;
  });

  const todayTotal = todayCollections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalBalance = customers.reduce((sum, c) => sum + (Number(c.balance) || 0), 0);
  
  const activeLoans = loans.filter(l => l.status === "active");
  const pendingLoans = loans.filter(l => l.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
          <p className="text-slate-500">Real-time platform metrics and activity.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Today's Collection" 
          value={`₹${todayTotal.toLocaleString()}`} 
          icon={<IndianRupee className="w-5 h-5 text-emerald-600" />}
          trend="+12% from yesterday"
          bg="bg-emerald-50"
        />
        <MetricCard 
          title="Total Customers" 
          value={customers.length.toString()} 
          icon={<Users className="w-5 h-5 text-blue-600" />}
          trend={`${agents.length} Active Agents`}
          bg="bg-blue-50"
        />
        <MetricCard 
          title="Total Platform Balance" 
          value={`₹${totalBalance.toLocaleString()}`} 
          icon={<Wallet className="w-5 h-5 text-purple-600" />}
          trend="Realtime total savings"
          bg="bg-purple-50"
        />
        <MetricCard 
          title="Active Loans" 
          value={activeLoans.length.toString()} 
          icon={<CreditCard className="w-5 h-5 text-orange-600" />}
          trend={`${pendingLoans.length} Pending Approval`}
          bg="bg-orange-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-slate-500" />
              Recent Collections
            </CardTitle>
          </CardHeader>
          <CardContent>
            {collections.length === 0 ? (
              <div className="text-center py-10 text-slate-500">No collections recorded yet.</div>
            ) : (
              <div className="space-y-4">
                {collections.sort((a,b) => {
                  const dA = (a.timestamp as any)?.toDate?.() || new Date(a.timestamp);
                  const dB = (b.timestamp as any)?.toDate?.() || new Date(b.timestamp);
                  return dB.valueOf() - dA.valueOf();
                }).slice(0, 5).map((col) => {
                  const customer = customers.find(c => c.id === col.customerId);
                  const agent = agents.find(a => a.id === col.agentId);
                  const d = (col.timestamp as any)?.toDate?.() || new Date(col.timestamp);
                  
                  return (
                    <div key={col.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{customer?.name || "Unknown Customer"}</span>
                        <span className="text-xs text-slate-500">Agent: {agent?.name || "Unknown"} • {d ? format(d, 'PP p') : ''}</span>
                      </div>
                      <div className="font-bold text-emerald-600">
                        +₹{col.amount}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
             <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100 text-center cursor-pointer hover:bg-blue-100 transition-colors">
               Add New Agent
             </div>
             <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-100 text-center cursor-pointer hover:bg-emerald-100 transition-colors">
               Add New Customer
             </div>
             <div className="p-3 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium border border-purple-100 text-center cursor-pointer hover:bg-purple-100 transition-colors">
               Generate Daily Report
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, trend, bg }: any) {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-500">{title}</h3>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bg}`}>
            {icon}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-slate-900">{value}</span>
          <span className="text-xs text-slate-500 mt-1">{trend}</span>
        </div>
      </CardContent>
    </Card>
  );
}
