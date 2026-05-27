import { useState } from "react";
import { useCollectionRealtime } from "@/lib/firestore-hooks";
import { Collection, User, Loan, Transaction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Calendar, IndianRupee, Users, Download, Eye, AlertCircle } from "lucide-react";
import { format, startOfDay, startOfMonth, subDays } from "date-fns";

type ReportType = "daily" | "monthly" | "collection" | "loan";

export default function OrgReports() {
  const [reportType, setReportType] = useState<ReportType>("daily");
  
  const { data: collections, loading: collLoading } = useCollectionRealtime<Collection>("collections");
  const { data: users, loading: usersLoading } = useCollectionRealtime<User>("users");
  const { data: loans, loading: loansLoading } = useCollectionRealtime<Loan>("loans");

  if (collLoading || usersLoading || loansLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 w-48 rounded"></div>
        <div className="h-64 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  const customers = users.filter((u) => u.role === "customer");
  const agents = users.filter((u) => u.role === "agent");

  // Helper to parse dates uniformly
  const getDocDate = (timestamp: any) => {
    return (timestamp as any)?.toDate?.() || new Date(timestamp);
  };

  // Filter ranges
  const todayStart = startOfDay(new Date());
  const monthStart = startOfMonth(new Date());

  // 1. Daily Report Data
  const dailyCollections = collections.filter(c => getDocDate(c.timestamp) >= todayStart);
  const dailyTotal = dailyCollections.reduce((sum, c) => sum + (c.amount || 0), 0);

  // 2. Monthly Report Data
  const monthlyCollections = collections.filter(c => getDocDate(c.timestamp) >= monthStart);
  const monthlyTotal = monthlyCollections.reduce((sum, c) => sum + (c.amount || 0), 0);

  // 3. Collection by Agent Report Data
  const agentContributions = agents.map(agent => {
    const agentCols = collections.filter(c => c.agentId === agent.id);
    const totalCollected = agentCols.reduce((sum, c) => sum + (c.amount || 0), 0);
    return {
      agentName: agent.name,
      agentPhone: agent.phone || "N/A",
      assignedArea: agent.assignedArea || "Not Specified",
      count: agentCols.length,
      totalCollected
    };
  });

  // 4. Loan Report Data
  const activeLoans = loans.filter(l => l.status === "active");
  const pendingLoans = loans.filter(l => l.status === "pending");
  const totalDisbursed = activeLoans.reduce((sum, l) => sum + (l.principal || 0), 0);
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.balanceRemaining || 0), 0);

  // Export functions (CSV Generation)
  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (reportType === "daily") {
      csvContent += "Customer Name,Phone,Amount Collected,Time\n";
      dailyCollections.forEach(col => {
        const cust = customers.find(c => c.id === col.customerId);
        csvContent += `"${cust?.name || 'Unknown'}",${cust?.phone || ''},${col.amount},"${format(getDocDate(col.timestamp), 'h:mm a')}"\n`;
      });
    } else if (reportType === "monthly") {
      csvContent += "Date,Customer Name,Amount (₹),Collected By\n";
      monthlyCollections.forEach(col => {
        const cust = customers.find(c => c.id === col.customerId);
        const agnt = agents.find(a => a.id === col.agentId);
        csvContent += `"${format(getDocDate(col.timestamp), 'yyyy-MM-dd')}","${cust?.name || 'Unknown'}",${col.amount},"${agnt?.name || 'Unknown'}"\n`;
      });
    } else if (reportType === "collection") {
      csvContent += "Agent Name,Phone,Assigned Area,Collections Count,Total Collected (₹)\n";
      agentContributions.forEach(ac => {
        csvContent += `"${ac.agentName}",${ac.agentPhone},"${ac.assignedArea}",${ac.count},${ac.totalCollected}\n`;
      });
    } else if (reportType === "loan") {
      csvContent += "Customer Name,Principal Disbursed,EMI Amount,Balance Remaining,Status\n";
      loans.forEach(l => {
        const cust = customers.find(c => c.id === l.customerId);
        csvContent += `"${cust?.name || 'Unknown'}",${l.principal},${l.emiAmount.toFixed(0)},${l.balanceRemaining},"${l.status.toUpperCase()}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FundCircle_Report_${reportType}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header with quick export options */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-25px font-extrabold text-slate-900 tracking-tight">Financial Reports</h2>
          <p className="text-slate-500 text-sm">Real-time reports derived strictly from live Pigmy collection ledgers.</p>
        </div>
        
        <Button onClick={exportToCSV} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 h-11 px-5 rounded-xl text-sm shadow-sm transition-all duration-200">
          <Download className="w-4 h-4" /> Download Excel/CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setReportType("daily")}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px ${
            reportType === "daily" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Daily Report (ದೈನಂದಿನ ವರದಿ)
        </button>
        <button
          onClick={() => setReportType("monthly")}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px ${
            reportType === "monthly" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Monthly Report (ತಿಂಗಳ ವರದಿ)
        </button>
        <button
          onClick={() => setReportType("collection")}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px ${
            reportType === "collection" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Agent Collection Report (ಏಜೆಂಟ್ ಸಂಗ್ರಹಣೆ)
        </button>
        <button
          onClick={() => setReportType("loan")}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px ${
            reportType === "loan" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Loan & EMI Ledger (ಸಾಲದ ಲೆಡ್ಜರ್)
        </button>
      </div>

      {/* Overview Cards */}
      {reportType === "daily" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-emerald-50 border-emerald-100 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Today's Grand Collection</span>
              <h1 className="text-3xl font-black text-emerald-900 mt-2">₹{dailyTotal.toLocaleString()}</h1>
              <p className="text-xs text-emerald-700/85 mt-1">{dailyCollections.length} Deposits collected today so far.</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200/80 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Outstanding Customer Savings</span>
              <h1 className="text-3xl font-black text-slate-900 mt-2">
                ₹{customers.reduce((sum, c) => sum + (c.balance || 0), 0).toLocaleString()}
              </h1>
              <p className="text-xs text-slate-400 mt-1">Across {customers.length} registered customers.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === "monthly" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-blue-50 border-blue-100 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-widest">Monthly Running Savings Pool</span>
              <h1 className="text-3xl font-black text-blue-900 mt-2">₹{monthlyTotal.toLocaleString()}</h1>
              <p className="text-xs text-blue-700/85 mt-1">{monthlyCollections.length} Total monthly deposits recorded.</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200/80 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Running Average Deposit</span>
              <h1 className="text-3xl font-black text-slate-900 mt-2">
                ₹{monthlyCollections.length ? Math.round(monthlyTotal / monthlyCollections.length).toLocaleString() : "0"}
              </h1>
              <p className="text-xs text-slate-400 mt-1">Calculated per transactions logs.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === "collection" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {agentContributions.map((ac, idx) => (
            <Card key={idx} className="rounded-2xl border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{ac.agentName}</span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">₹{ac.totalCollected.toLocaleString()}</h3>
                <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-medium text-slate-500 pt-3 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400">deposits count</span>
                    <p className="font-extrabold mt-0.5">{ac.count}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Area Zone</span>
                    <p className="font-extrabold mt-0.5 mt-0.5 truncate">{ac.assignedArea}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reportType === "loan" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-orange-50 border-orange-100 rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <span className="text-xs font-bold text-orange-850 uppercase tracking-wide">Total Active Loans</span>
              <h2 className="text-2xl font-black text-orange-900 mt-1">{activeLoans.length}</h2>
              <p className="text-xs text-orange-650 mt-1">{pendingLoans.length} Loans awaiting approval</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200/80 rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Principal Disbursed</span>
              <h2 className="text-2xl font-black text-slate-900 mt-1">₹{totalDisbursed.toLocaleString()}</h2>
              <p className="text-xs text-slate-400 mt-1">Initial capital outlays.</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-100 rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <span className="text-xs font-bold text-red-800 uppercase tracking-wide">Total Outstanding Balance</span>
              <h2 className="text-2xl font-black text-red-900 mt-1">₹{totalOutstanding.toLocaleString()}</h2>
              <p className="text-xs text-red-650 mt-1">Target collectable principal + interest.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Table Details */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/60 border-b border-slate-100">
          <CardTitle className="text-md font-bold text-slate-800">
            {reportType === "daily" && "Today's Collection Logs"}
            {reportType === "monthly" && "Monthly Deposit Ledger"}
            {reportType === "collection" && "Agent Performance Directory"}
            {reportType === "loan" && "Customer Loan Registry"}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Live updates pulling in real-time from mobile operator networks.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {reportType === "daily" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name (ಗ್ರಾಹಕರು)</TableHead>
                    <TableHead className="hidden sm:table-cell">Phone (ಫೋನ್)</TableHead>
                    <TableHead>Collected (ಮೊತ್ತ)</TableHead>
                    <TableHead>Time (ಸಮಯ)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyCollections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-slate-400 text-sm">
                        No transactions recorded today.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailyCollections.map((col, i) => {
                      const cust = customers.find(c => c.id === col.customerId);
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-semibold text-slate-900">{cust?.name || "Unknown"}</TableCell>
                          <TableCell className="hidden sm:table-cell text-slate-500">{cust?.phone || "N/A"}</TableCell>
                          <TableCell className="font-extrabold text-emerald-600">₹{col.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-slate-400 text-xs">{format(getDocDate(col.timestamp), "h:mm a")}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}

            {reportType === "monthly" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date (ದಿನಾಂಕ)</TableHead>
                    <TableHead>Customer Name (ಗ್ರಾಹಕರು)</TableHead>
                    <TableHead>Amt (ಮೊತ್ತ)</TableHead>
                    <TableHead className="hidden sm:table-cell">Collected By (ಸಂಗ್ರಹ ಸಂಗ್ರಹಕಾರ)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyCollections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-slate-400 text-sm">
                        No monthly transactions.
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyCollections.map((col, i) => {
                      const cust = customers.find(c => c.id === col.customerId);
                      const agnt = agents.find(a => a.id === col.agentId);
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-slate-600">{format(getDocDate(col.timestamp), "yyyy-MM-dd")}</TableCell>
                          <TableCell className="font-semibold text-slate-900">{cust?.name || "Unknown"}</TableCell>
                          <TableCell className="font-extrabold text-emerald-600">₹{col.amount}</TableCell>
                          <TableCell className="hidden sm:table-cell text-slate-500 font-medium">{agnt?.name || "System"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}

            {reportType === "collection" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Name (ಏಜೆಂಟ್)</TableHead>
                    <TableHead className="hidden sm:table-cell">Assigned Area (ಪ್ರದೇಶ)</TableHead>
                    <TableHead>Transactions Count</TableHead>
                    <TableHead>Total Collected (ದಿನಮೊತ್ತ)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentContributions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-slate-400 text-sm">
                        No active agents registered.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentContributions.map((ac, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-semibold text-slate-900">{ac.agentName}</TableCell>
                        <TableCell className="hidden sm:table-cell text-slate-500 font-medium">{ac.assignedArea}</TableCell>
                        <TableCell className="font-medium text-slate-600">{ac.count} deposits</TableCell>
                        <TableCell className="font-extrabold text-blue-600">₹{ac.totalCollected.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {reportType === "loan" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name (ಗ್ರಾಹಕರು)</TableHead>
                    <TableHead>Principal (ಸಾಲದ ಮೊತ್ತ)</TableHead>
                    <TableHead>Monthly EMI (ತಿಂಗಳು ಕಂತು)</TableHead>
                    <TableHead>Outstanding Bal (ಬಾಕಿ)</TableHead>
                    <TableHead>Status (ಸ್ಥಿತಿ)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-slate-400 text-sm">
                        No active loan applications recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    loans.map((l, i) => {
                      const cust = customers.find(c => c.id === l.customerId);
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-semibold text-slate-900">{cust?.name || "Unknown"}</TableCell>
                          <TableCell className="font-medium text-slate-600">₹{l.principal.toLocaleString()}</TableCell>
                          <TableCell className="font-bold text-orange-600">₹{l.emiAmount.toFixed(0)}</TableCell>
                          <TableCell className="font-extrabold text-slate-900">₹{l.balanceRemaining.toLocaleString()}</TableCell>
                          <TableCell>
                            <span className={`px-2.5 py-1 text-2xs font-extrabold rounded-full ${
                              l.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' :
                              l.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-150' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {l.status.toUpperCase()}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
