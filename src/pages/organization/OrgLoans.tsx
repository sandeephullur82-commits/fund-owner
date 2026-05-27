import { useCollectionRealtime } from "@/lib/firestore-hooks";
import { Loan, User } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { approveLoan } from "@/lib/services";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export default function OrgLoans() {
  const { data: loans, loading: loansLoading } = useCollectionRealtime<Loan>("loans");
  const { data: users, loading: usersLoading } = useCollectionRealtime<User>("users");

  const customers = users.filter(u => u.role === "customer");

  const handleApprove = async (loanId: string) => {
    try {
      await approveLoan(loanId);
      toast.success("Loan approved successfully");
    } catch (e) {
      toast.error("Failed to approve loan");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Loans & EMI Management</h2>
        <p className="text-slate-500">Review loan applications and active EMIs.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested On</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Calculated EMI</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(loansLoading || usersLoading) ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : loans.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No loan requests found.</TableCell></TableRow>
              ) : (
                loans.sort((a,b) => {
                  const dA = (a.createdAt as any)?.toDate?.() || new Date(a.createdAt);
                  const dB = (b.createdAt as any)?.toDate?.() || new Date(b.createdAt);
                  return dB.valueOf() - dA.valueOf();
                }).map(loan => {
                  const customer = customers.find(c => c.id === loan.customerId);
                  const d = (loan.createdAt as any)?.toDate?.() || new Date(loan.createdAt);
                  
                  return (
                    <TableRow key={loan.id}>
                      <TableCell className="text-sm text-slate-600">
                        {d ? format(d, 'MMM d, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">{customer?.name || "Unknown"}</TableCell>
                      <TableCell className="text-right font-medium">₹{loan.principal.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{loan.durationMonths} months</TableCell>
                      <TableCell className="text-right text-blue-600 font-medium">₹{loan.emiAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          loan.status === "active" ? "bg-emerald-100 text-emerald-700" 
                          : loan.status === "pending" ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-700"
                        }`}>
                          {loan.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {loan.status === "pending" && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700"><X className="w-4 h-4" /></Button>
                            <Button size="sm" onClick={() => handleApprove(loan.id)} className="bg-emerald-600 hover:bg-emerald-700"><Check className="w-4 h-4 ml-1" /> Approve</Button>
                          </div>
                        )}
                        {loan.status === "active" && (
                          <span className="text-xs text-slate-500">Remaining: ₹{loan.balanceRemaining.toLocaleString()}</span>
                        )}
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
