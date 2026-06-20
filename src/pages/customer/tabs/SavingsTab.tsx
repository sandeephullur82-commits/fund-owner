import React, { useMemo, useState, useCallback } from "react";
import {
  PiggyBank, Download, TrendingUp, Calendar,
  BarChart3, ArrowUpRight, Clock, XCircle, ChevronRight, Loader2, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import type { SavingsAccount, SavingsApplication, SavingsPlan, SavingsTransaction } from "@/types";
import { createSavingsApplication } from "@/lib/services";

function toDate(ts: any): Date {
  if (!ts) return new Date(0);
  if (ts?.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

function safeN(v: any): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

interface Props {
  savingsAccount: SavingsAccount | null;
  savingsTxs: SavingsTransaction[];
  orgName: string;
  savingsApplications?: SavingsApplication[];
  savingsPlans?: SavingsPlan[];
  organizationId?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

type SubTab = "history" | "analytics" | "statement";

export default function SavingsTab({
  savingsAccount, savingsTxs, orgName,
  savingsApplications = [], savingsPlans = [],
  organizationId = "", customerId = "", customerName = "", customerEmail = "", customerPhone,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>("history");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Apply-flow state
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [applying, setApplying] = useState(false);

  // Find latest application for this customer
  const latestApplication = useMemo(() => {
    return savingsApplications
      .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())[0] ?? null;
  }, [savingsApplications]);

  const handleApply = async () => {
    if (!selectedPlanId) { toast.error("Please select a plan."); return; }
    const plan = savingsPlans.find((p) => p.id === selectedPlanId);
    if (!plan) { toast.error("Invalid plan selection."); return; }
    const amount = Number(depositAmount);
    if (!amount || amount < plan.minDeposit || amount > plan.maxDeposit) {
      toast.error(`Amount must be between ₹${plan.minDeposit} and ₹${plan.maxDeposit}.`);
      return;
    }
    setApplying(true);
    try {
      await createSavingsApplication({
        organizationId,
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        planId: plan.id,
        planName: plan.planName,
        planType: plan.planType,
        depositAmount: amount,
        notes: notes.trim(),
      });
      toast.success("Application submitted! Your organization will review it shortly.");
      setShowApplyForm(false);
      setSelectedPlanId("");
      setDepositAmount("");
      setNotes("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit application.");
    } finally { setApplying(false); }
  };

  // ── Balance calculations (never NaN/null/undefined) ──────────────────────────
  const totalDeposits = savingsTxs.reduce((s, t) => s + safeN(t.amount), 0);
  const totalWithdrawals = savingsTxs.reduce((s, t) => s + safeN((t as any).withdrawalAmount), 0);
  const computedBalance = Math.max(0, totalDeposits - totalWithdrawals);
  // Use stored balance if > 0, otherwise fall back to transaction sum
  const storedBalance = safeN(savingsAccount?.totalBalance);
  const totalBalance = storedBalance > 0 ? storedBalance : computedBalance;

  // Compute running balanceAfter for any transaction missing it
  const txsWithBalance = useMemo(() => {
    const chronological = [...savingsTxs].sort(
      (a, b) => toDate(a.collectedAt).getTime() - toDate(b.collectedAt).getTime()
    );
    let running = 0;
    const withBal = chronological.map((tx) => {
      running += safeN(tx.amount);
      running -= safeN((tx as any).withdrawalAmount);
      const bal = safeN(tx.balanceAfter) > 0 ? safeN(tx.balanceAfter) : running;
      return { ...tx, balanceAfter: bal };
    });
    return withBal.sort(
      (a, b) => toDate(b.collectedAt).getTime() - toDate(a.collectedAt).getTime()
    );
  }, [savingsTxs]);

  const lastCollection = txsWithBalance[0];

  // Account Since: first deposit date, or savings account startDate, or createdAt
  const firstDepositDate = useMemo(() => {
    if (savingsTxs.length === 0) return null;
    const oldest = [...savingsTxs].sort(
      (a, b) => toDate(a.collectedAt).getTime() - toDate(b.collectedAt).getTime()
    )[0];
    const d = toDate(oldest.collectedAt);
    return d.getTime() > 0 ? d : null;
  }, [savingsTxs]);

  const accountSinceDate = useMemo(() => {
    if (savingsAccount?.startDate && toDate(savingsAccount.startDate).getTime() > 0)
      return toDate(savingsAccount.startDate);
    if (savingsAccount?.createdAt && toDate((savingsAccount as any).createdAt).getTime() > 0)
      return toDate((savingsAccount as any).createdAt);
    return firstDepositDate;
  }, [savingsAccount, firstDepositDate]);

  const filteredTxs = useMemo(() => {
    return txsWithBalance.filter((tx) => {
      const d = toDate(tx.collectedAt);
      const matchFrom = !dateFrom || d >= new Date(dateFrom);
      const matchTo = !dateTo || d <= new Date(dateTo + "T23:59:59");
      return matchFrom && matchTo;
    });
  }, [txsWithBalance, dateFrom, dateTo]);

  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d).getTime();
      const end = endOfMonth(d).getTime();
      const amount = savingsTxs
        .filter((t) => {
          const ts = toDate(t.collectedAt).getTime();
          return ts >= start && ts <= end;
        })
        .reduce((s, t) => s + safeN(t.amount), 0);
      const count = savingsTxs.filter((t) => {
        const ts = toDate(t.collectedAt).getTime();
        return ts >= start && ts <= end;
      }).length;
      months.push({ month: format(d, "MMM"), amount, count });
    }
    return months;
  }, [savingsTxs]);

  const balanceHistory = useMemo(() => {
    return [...txsWithBalance]
      .reverse()
      .slice(-30)
      .map((tx, i) => ({
        day: i + 1,
        balance: safeN(tx.balanceAfter),
        date: format(toDate(tx.collectedAt), "MMM d"),
      }));
  }, [txsWithBalance]);

  const downloadStatementPDF = useCallback(async () => {
    if (savingsTxs.length === 0) return;
    const { default: jsPDF } = await import("jspdf");

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const PW = 210;
    const MARGIN = 15;
    const CW = PW - MARGIN * 2;
    let y = MARGIN;

    const line = (width = CW) => {
      doc.setDrawColor(220, 220, 220);
      doc.line(MARGIN, y, MARGIN + width, y);
      y += 4;
    };
    const txt = (text: string, size: number, bold = false, color = "#1e293b", align: "left" | "center" | "right" = "left") => {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(color);
      const x = align === "center" ? PW / 2 : align === "right" ? PW - MARGIN : MARGIN;
      doc.text(text, x, y, { align });
      y += size * 0.45;
    };

    // ── Header
    txt("FundCircle", 18, true, "#059669", "center"); y += 1;
    txt(orgName, 10, false, "#64748b", "center"); y += 1;
    txt("SAVINGS ACCOUNT STATEMENT", 9, true, "#94a3b8", "center"); y += 4;
    line();

    // ── Account info
    const infoRows: [string, string][] = [
      ["Customer", customerName || "—"],
      ["Organization", orgName],
      ["Account Since", accountSinceDate ? format(accountSinceDate, "dd MMM yyyy") : "—"],
      ["Generated On", format(new Date(), "dd MMM yyyy, hh:mm a")],
      ["Total Transactions", savingsTxs.length.toString()],
      ["Total Deposits", `Rs. ${totalDeposits.toLocaleString()}`],
      ["Current Balance", `Rs. ${totalBalance.toLocaleString()}`],
    ];
    for (const [label, value] of infoRows) {
      const rowY = y;
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor("#64748b");
      doc.text(label, MARGIN, rowY);
      doc.setFont("helvetica", "bold"); doc.setTextColor("#1e293b");
      doc.text(value, PW - MARGIN, rowY, { align: "right" });
      y += 5.5;
    }
    y += 2;
    line();

    // ── Table header
    const cols = { no: 0, date: 8, receipt: 40, amount: 105, balance: 140, agent: 175 };
    doc.setFillColor(248, 250, 252);
    doc.rect(MARGIN, y - 1, CW, 7, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor("#475569");
    doc.text("#",                MARGIN + cols.no,      y + 4);
    doc.text("Date",             MARGIN + cols.date,    y + 4);
    doc.text("Receipt No",       MARGIN + cols.receipt, y + 4);
    doc.text("Amount (Rs.)",     MARGIN + cols.amount,  y + 4, { align: "right" });
    doc.text("Balance (Rs.)",    MARGIN + cols.balance, y + 4, { align: "right" });
    doc.text("Collected By",     MARGIN + cols.agent,   y + 4);
    y += 8;

    // ── Rows
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    let rowNum = 0;
    for (const tx of txsWithBalance) {
      rowNum++;
      if (y > 272) {
        doc.addPage();
        y = MARGIN + 5;
      }
      if (rowNum % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(MARGIN, y - 1, CW, 6, "F");
      }
      const d = toDate(tx.collectedAt);
      const dateStr = d.getTime() > 0 ? format(d, "dd/MM/yy") : "—";
      doc.setTextColor("#374151");
      doc.text(rowNum.toString(),                      MARGIN + cols.no,      y + 3.5);
      doc.text(dateStr,                                MARGIN + cols.date,    y + 3.5);
      doc.text((tx.receiptNo || "—").slice(0, 20),     MARGIN + cols.receipt, y + 3.5);
      doc.text(safeN(tx.amount).toLocaleString(),      MARGIN + cols.amount,  y + 3.5, { align: "right" });
      doc.text(safeN(tx.balanceAfter).toLocaleString(),MARGIN + cols.balance, y + 3.5, { align: "right" });
      doc.text((tx.collectedByName || "Agent").slice(0, 14), MARGIN + cols.agent, y + 3.5);
      y += 6;
    }

    // ── Footer
    y += 4; line();
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor("#059669");
    doc.text(`Total Deposits: Rs. ${totalDeposits.toLocaleString()}`, MARGIN, y);
    doc.text(`Current Balance: Rs. ${totalBalance.toLocaleString()}`, PW - MARGIN, y, { align: "right" });
    y += 8;
    doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor("#94a3b8");
    doc.text("This is a digitally generated statement. No signature required.", PW / 2, y, { align: "center" });
    y += 4;
    doc.text("Powered by FundCircle", PW / 2, y, { align: "center" });

    doc.save(`savings-statement-${orgName.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }, [savingsTxs, txsWithBalance, orgName, customerName, accountSinceDate, totalDeposits, totalBalance]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2 text-xs">
          <p className="font-bold text-slate-700 dark:text-slate-200">{label || payload[0]?.payload?.date}</p>
          <p className="text-emerald-600 font-semibold">₹{safeN(payload[0]?.value).toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  // ── PRE-ACCOUNT STATES ──────────────────────────────────────────────────────
  if (!savingsAccount) {
    // Pending application
    if (latestApplication?.status === "PENDING") {
      return (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <p className="text-lg font-bold">Application Under Review</p>
            <p className="text-amber-100 text-sm mt-1">
              Your savings account application is being reviewed. We'll notify you once it's approved.
            </p>
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900">Application Details</p>
              {[
                ["Plan", latestApplication.planName],
                ["Amount", `₹${latestApplication.depositAmount.toLocaleString()} / collection`],
                ["Status", "Pending Review"],
                ["Applied", toDate(latestApplication.createdAt).getTime() > 0
                  ? format(toDate(latestApplication.createdAt), "MMM d, yyyy")
                  : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-semibold text-slate-900">{v}</span>
                </div>
              ))}
              {latestApplication.notes && (
                <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">
                  "{latestApplication.notes}"
                </p>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-center text-slate-400">
            Once approved, your account details will appear here automatically.
          </p>
        </div>
      );
    }

    // Rejected application — allow re-apply
    if (latestApplication?.status === "REJECTED") {
      if (!showApplyForm) {
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white text-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <XCircle className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg font-bold">Application Not Approved</p>
              <p className="text-red-100 text-sm mt-1">Your previous application was rejected.</p>
            </div>
            <Card className="border-red-100">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-900">Rejection Reason</p>
                <div className="flex gap-2 p-3 bg-red-50 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{latestApplication.rejectionReason || "No reason provided."}</p>
                </div>
              </CardContent>
            </Card>
            <button
              onClick={() => setShowApplyForm(true)}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors"
            >
              Apply Again
            </button>
          </div>
        );
      }
    }

    // No account, no application — or re-applying after rejection
    if (!showApplyForm) {
      return (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <PiggyBank className="w-8 h-8 text-white" />
            </div>
            <p className="text-xl font-bold">Start Saving Today</p>
            <p className="text-emerald-100 text-sm mt-1">
              Open a savings account and build your financial future with regular deposits.
            </p>
          </div>
          <div className="space-y-3">
            {savingsPlans.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-slate-400">
                  <PiggyBank className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No savings plans are available yet.</p>
                  <p className="text-xs mt-1">Contact your organization for more information.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-900">Available Plans</p>
                {savingsPlans.map((plan) => (
                  <div key={plan.id} className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{plan.planName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {plan.planType.replace(/_/g, " ")} · ₹{plan.minDeposit}–₹{plan.maxDeposit} / {plan.collectionFrequency.toLowerCase()}
                      </p>
                      <p className="text-xs text-emerald-600 mt-0.5">{plan.interestRate}% p.a. interest</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                ))}
                <button
                  onClick={() => setShowApplyForm(true)}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <PiggyBank className="w-4 h-4" /> Open Savings Account
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    // Application form
    const selectedPlan = savingsPlans.find((p) => p.id === selectedPlanId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowApplyForm(false); setSelectedPlanId(""); setDepositAmount(""); setNotes(""); }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
            ←
          </button>
          <div>
            <p className="font-bold text-slate-900">Open Savings Account</p>
            <p className="text-xs text-slate-500">Choose a plan and set your deposit amount</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Select Plan *</label>
              <div className="space-y-2">
                {savingsPlans.map((plan) => (
                  <button key={plan.id} onClick={() => { setSelectedPlanId(plan.id); setDepositAmount(String(plan.minDeposit)); }}
                    className={`w-full p-3 rounded-xl border text-left transition-colors ${selectedPlanId === plan.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <p className="font-semibold text-slate-900 text-sm">{plan.planName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {plan.planType.replace(/_/g, " ")} · ₹{plan.minDeposit}–₹{plan.maxDeposit} · {plan.interestRate}% p.a.
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {selectedPlan && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Deposit Amount (₹ {selectedPlan.minDeposit}–{selectedPlan.maxDeposit}) *
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min={selectedPlan.minDeposit}
                  max={selectedPlan.maxDeposit}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes for the organization…"
                className="w-full h-20 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              />
            </div>

            <button
              onClick={handleApply}
              disabled={applying || !selectedPlanId}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {applying ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : "Submit Application"}
            </button>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-slate-400">
          After review, your organization will open your savings account and assign a collector.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Account Summary Card */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-emerald-100 text-sm font-medium">Savings Balance</p>
            <p className="text-4xl font-black mt-1">₹{totalBalance.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <PiggyBank className="w-7 h-7 text-white" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/15 rounded-xl p-2.5">
            <p className="text-emerald-100 text-[10px] font-medium">Total Deposits</p>
            <p className="text-white font-bold text-sm mt-0.5">₹{totalDeposits.toLocaleString()}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2.5">
            <p className="text-emerald-100 text-[10px] font-medium">Transactions</p>
            <p className="text-white font-bold text-sm mt-0.5">{savingsTxs.length}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2.5">
            <p className="text-emerald-100 text-[10px] font-medium">Status</p>
            <p className="text-white font-bold text-sm mt-0.5">{savingsAccount?.status ?? "ACTIVE"}</p>
          </div>
        </div>
        {savingsAccount?.scheduledAmount && safeN(savingsAccount.scheduledAmount) > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-emerald-100" />
            <p className="text-emerald-100 text-xs">
              Scheduled: <span className="font-bold text-white">
                ₹{safeN(savingsAccount.scheduledAmount).toLocaleString()} / collection
              </span>
            </p>
          </div>
        )}
        {lastCollection && (
          <div className="mt-2 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
            <TrendingUp className="w-4 h-4 text-emerald-100" />
            <p className="text-emerald-100 text-xs">
              Last collection: <span className="font-bold text-white">
                {toDate(lastCollection.collectedAt).getTime() > 0
                  ? format(toDate(lastCollection.collectedAt), "MMM d, yyyy")
                  : "—"}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total Deposits</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">₹{totalDeposits.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Balance ₹{totalBalance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Account Since</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {accountSinceDate ? format(accountSinceDate, "MMM yyyy") : "—"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {accountSinceDate ? format(accountSinceDate, "dd MMM yyyy") : "Member"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        {(["history", "analytics", "statement"] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
              subTab === t
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "history" ? "Deposits" : t === "analytics" ? "Analytics" : "Statement"}
          </button>
        ))}
      </div>

      {/* History sub-tab */}
      {subTab === "history" && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <input
              type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 h-9 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
            />
            <span className="text-slate-400 text-xs shrink-0">to</span>
            <input
              type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 h-9 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="px-3 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 text-xs font-semibold shrink-0"
              >
                Clear
              </button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredTxs.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <PiggyBank className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No deposits found.</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-50 dark:divide-slate-800">
                    {filteredTxs.map((tx) => {
                      const d = toDate(tx.collectedAt);
                      return (
                        <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">Deposit</p>
                              <p className="text-xs text-slate-400">
                                {tx.collectedByName || "Agent"} · {d.getTime() > 0 ? format(d, "MMM d, yyyy · h:mm a") : "—"}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">{tx.receiptNo}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">+₹{safeN(tx.amount).toLocaleString()}</p>
                            <p className="text-xs text-slate-400">Bal: ₹{safeN(tx.balanceAfter).toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2.5 flex justify-between items-center">
                    <p className="text-xs text-slate-500">{filteredTxs.length} records</p>
                    <p className="text-sm font-black text-emerald-700">
                      Total: ₹{filteredTxs.reduce((s, t) => s + safeN(t.amount), 0).toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics sub-tab */}
      {subTab === "analytics" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                Monthly Savings (12 months)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4 pr-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {balanceHistory.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Balance Growth (Last 30 Deposits)</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-4 pr-4">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={balanceHistory} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2}
                      fill="url(#balGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Avg Deposit</p>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  ₹{savingsTxs.length > 0 ? Math.round(totalDeposits / savingsTxs.length).toLocaleString() : "0"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Per transaction</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">This Month</p>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  ₹{monthlyData[monthlyData.length - 1]?.amount.toLocaleString() ?? "0"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{monthlyData[monthlyData.length - 1]?.count ?? 0} deposits</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Statement sub-tab */}
      {subTab === "statement" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Download Statement</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Export your complete savings history</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Organization</span>
                <span className="font-semibold text-slate-900 dark:text-white">{orgName}</span>
              </div>
              {accountSinceDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Account Since</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{format(accountSinceDate, "dd MMM yyyy")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Transactions</span>
                <span className="font-semibold text-slate-900 dark:text-white">{savingsTxs.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Deposits</span>
                <span className="font-bold text-emerald-600">₹{totalDeposits.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Current Balance</span>
                <span className="font-bold text-emerald-700">₹{totalBalance.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={downloadStatementPDF}
              disabled={savingsTxs.length === 0}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Download Statement PDF
            </button>
            <p className="text-xs text-slate-400 text-center">
              A4 PDF with your complete transaction history
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload?.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2 text-xs">
        <p className="font-bold text-slate-700 dark:text-slate-200">{label || payload[0]?.payload?.date}</p>
        <p className="text-emerald-600 font-semibold">₹{safeN(payload[0]?.value).toLocaleString()}</p>
      </div>
    );
  }
  return null;
}
