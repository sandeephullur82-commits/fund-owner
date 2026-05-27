import { useCollectionRealtime } from "@/lib/firestore-hooks";
import { Collection, User } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, Users } from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@clerk/clerk-react";

export default function AgentOverview() {
  const { user } = useUser();
  // Using user.id to find our agent document to match ID in firestore.
  // In a real scenario we might have the agent's firestore ID separately.
  // We'll just assume my custom firestore-hooks filters properly or we filter client-side.
  const { data: collections, loading: collLoading } = useCollectionRealtime<Collection>("collections");
  const { data: users, loading: usersLoading } = useCollectionRealtime<User>("users");

  // We find the agent document matching the clerk email or metadata
  // If we just sync clerk ID -> firestore, user.id is the key.
  const agentId = user?.id; 

  const myCollections = collections.filter(c => c.agentId === agentId);
  const myCustomers = users.filter(u => u.role === "customer" && u.agentId === agentId);

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const todayCollections = myCollections.filter(c => {
    const collDate = (c.timestamp as any)?.toDate?.() || new Date(c.timestamp);
    return collDate >= today;
  });

  const todayTotal = todayCollections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Today's Summary</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-emerald-600 text-white shadow-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-emerald-100 font-medium mb-1">Collections Today</p>
                <h3 className="text-4xl font-bold">₹{todayTotal.toLocaleString()}</h3>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <IndianRupee className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 text-emerald-100 text-sm">
              Across {todayCollections.length} transactions
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 font-medium mb-1">Assigned Customers</p>
                <h3 className="text-4xl font-bold text-slate-900">{myCustomers.length}</h3>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-500">
              Active in your area
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Collections</CardTitle>
        </CardHeader>
        <CardContent>
          {todayCollections.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No collections yet today.</div>
          ) : (
            <div className="space-y-4">
              {todayCollections.sort((a,b) => {
                const dA = (a.timestamp as any)?.toDate?.() || new Date(a.timestamp);
                const dB = (b.timestamp as any)?.toDate?.() || new Date(b.timestamp);
                return dB.valueOf() - dA.valueOf();
              }).map(col => {
                const customer = users.find(u => u.id === col.customerId);
                const d = (col.timestamp as any)?.toDate?.() || new Date(col.timestamp);
                
                return (
                  <div key={col.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900">{customer?.name || "Unknown"}</p>
                      <p className="text-sm text-slate-500">{d ? format(d, 'h:mm a') : 'N/A'}</p>
                    </div>
                    <div className="text-lg font-bold text-emerald-600">+₹{col.amount}</div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
