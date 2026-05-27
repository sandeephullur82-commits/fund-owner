import { useCollectionRealtime } from "@/lib/firestore-hooks";
import { Collection, User } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function OrgCollections() {
  const { data: collections, loading: collLoading } = useCollectionRealtime<Collection>("collections");
  const { data: users, loading: usersLoading } = useCollectionRealtime<User>("users");

  const customers = users.filter(u => u.role === "customer");
  const agents = users.filter(u => u.role === "agent");

  // Sort by date desc
  const sortedCollections = [...collections].sort((a,b) => {
    const dA = (a.timestamp as any)?.toDate?.() || new Date(a.timestamp);
    const dB = (b.timestamp as any)?.toDate?.() || new Date(b.timestamp);
    return dB.valueOf() - dA.valueOf();
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Collection History</h2>
        <p className="text-slate-500">Real-time log of all savings collected by agents.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Collected By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(collLoading || usersLoading) ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : sortedCollections.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No collections found.</TableCell></TableRow>
              ) : (
                sortedCollections.map(col => {
                  const customer = customers.find(c => c.id === col.customerId);
                  const agent = agents.find(a => a.id === col.agentId);
                  const d = (col.timestamp as any)?.toDate?.() || new Date(col.timestamp);
                  
                  return (
                    <TableRow key={col.id}>
                      <TableCell className="text-sm text-slate-600">
                        {d ? format(d, 'MMM d, yyyy - p') : 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">{customer?.name || "Unknown"}</TableCell>
                      <TableCell className="text-slate-600">{agent?.name || "Unknown"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          col.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                        }`}>
                          {col.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        ₹{col.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
