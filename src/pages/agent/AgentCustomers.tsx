import React, { useState } from "react";
import { useCollectionRealtime } from "@/lib/firestore-hooks";
import { User, Loan } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, IndianRupee } from "lucide-react";
import { useUser, useOrganization } from "@clerk/clerk-react";
import { recordCollection } from "@/lib/services";

type AgentCustomersProps = {
  collectorRole?: "OWNER" | "AGENT" | string;
  collectorName?: string;
  collectorId?: string;
};

export default function AgentCustomers({ collectorRole = "AGENT", collectorName = "", collectorId = "" }: AgentCustomersProps) {
  const { user } = useUser();
  const { organization } = useOrganization();
  const { data: users, loading } = useCollectionRealtime<User>("users");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const agentId = user?.id || ""; 
  const activeCollectorRole = collectorRole || (user?.publicMetadata as any)?.role === "org:owner" ? "OWNER" : "AGENT";
  const activeCollectorName = collectorName || user?.fullName || "Collector";
  const activeCollectorId = collectorId || user?.id || "";
  const myCustomers = users.filter(u => u.role === "customer" && u.agentId === agentId && 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.phone?.includes(searchTerm))
  );

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !selectedCustomer) return;
    if (Number(amount) <= 0) return toast.error("Enter a valid amount");

    setIsSubmitting(true);
    try {
      await recordCollection(organization.id, {
        customerId: selectedCustomer.id,
        agentId: agentId,
        amount: Number(amount),
        status: "completed",
        collectedByRole: activeCollectorRole,
        collectedByUserId: activeCollectorId,
        collectedByName: activeCollectorName,
      });
      toast.success("Collection recorded successfully");
      setSelectedCustomer(null);
      setAmount("");
    } catch (e) {
      toast.error("Failed to record collection");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <Input 
          placeholder="Search your customers..." 
          className="pl-10 h-12 bg-white"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8">Loading...</div>
        ) : myCustomers.length === 0 ? (
          <div className="col-span-full text-center py-8 text-slate-500">No customers found.</div>
        ) : (
          myCustomers.map(customer => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{customer.name}</h3>
                    <p className="text-sm text-slate-500">{customer.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">Balance</p>
                    <p className="font-bold text-emerald-600">₹{(customer.balance || 0).toLocaleString()}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setSelectedCustomer(customer)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <IndianRupee className="w-4 h-4 mr-2" /> Collect Daily Savings
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Collection</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <form onSubmit={handleCollect} className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg mb-4">
                <p className="text-sm text-slate-500">Customer</p>
                <p className="font-bold text-lg">{selectedCustomer.name}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input 
                  id="amount" 
                  type="number" 
                  placeholder="e.g. 500" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  required 
                  className="text-lg"
                  autoFocus
                />
              </div>
              
              <Button type="submit" className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
                {isSubmitting ? "Processing..." : "Confirm Collection"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
