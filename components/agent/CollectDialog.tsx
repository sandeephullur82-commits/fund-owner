import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CreditCard, Banknote, Loader2, AlertTriangle, CheckCircle2,
  TrendingDown, ChevronRight, ZapOff, Sparkles,
} from "lucide-react";
import { Loan, LoanInstallment } from "@/types";
import {
  recordGeneralCollection,
  recordEMICollection,
  recordPartialPayment,
  recordAdvancePayment,
  recordForeclosure,
  syncInstallmentStatuses,
  getActiveLoanForCustomer,
  getNextPendingInstallment,
} from "@/lib/services";
import ReceiptModal, { ReceiptData } from "@/components/ReceiptModal";
import FieldError from "@/components/ui/FieldError";

type PaymentMode   = "CASH" | "UPI" | "BANK_TRANSFER";
type CollectMode   = "LOAN_EMI" | "GENERAL" | null;
type RepaymentType = "REGULAR_EMI" | "PARTIAL_PAYMENT" | "ADVANCE_PAYMENT" | "FORECLOSURE";

export function toDate(ts: any): Date {
  if (!ts) return new Date(0);
  if (ts?.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

interface CollectDialogProps {
  customer: any | null;
  orgId: string;
  orgName: string;
  agentId: string;
  agentName: string;
  onClose: () => void;
  collectedByRole?: string;
  collectedById?: string;
}

const TYPE_META: Record<RepaymentType, {
  label: string;
  sublabel: string;
  icon: React.ElementType;
  badge: string;
  border: string;
  bg: string;
  text: string;
}> = {
  REGULAR_EMI: {
    label:    "Regular EMI",
    sublabel: "Exact EMI amount detected",
    icon:     CheckCircle2,
    badge:    "bg-indigo-100 text-indigo-700 border-indigo-200",
    border:   "border-indigo-200",
    bg:       "bg-indigo-50",
    text:     "text-indigo-700",
  },
  PARTIAL_PAYMENT: {
    label:    "Partial Payment",
    sublabel: "Amount is less than EMI",
    icon:     TrendingDown,
    badge:    "bg-amber-100 text-amber-700 border-amber-200",
    border:   "border-amber-200",
    bg:       "bg-amber-50",
    text:     "text-amber-700",
  },
  ADVANCE_PAYMENT: {
    label:    "Advance Payment",
    sublabel: "Covers more than one EMI",
    icon:     CreditCard,
    badge:    "bg-emerald-100 text-emerald-700 border-emerald-200",
    border:   "border-emerald-200",
    bg:       "bg-emerald-50",
    text:     "text-emerald-700",
  },
  FORECLOSURE: {
    label:    "Foreclosure",
    sublabel: "Settles entire outstanding balance",
    icon:     ZapOff,
    badge:    "bg-rose-100 text-rose-700 border-rose-200",
    border:   "border-rose-200",
    bg:       "bg-rose-50",
    text:     "text-rose-700",
  },
};

const SUBMIT_COLORS: Record<RepaymentType, string> = {
  REGULAR_EMI:     "bg-indigo-600 hover:bg-indigo-700",
  PARTIAL_PAYMENT: "bg-amber-500  hover:bg-amber-600",
  ADVANCE_PAYMENT: "bg-emerald-600 hover:bg-emerald-700",
  FORECLOSURE:     "bg-rose-600   hover:bg-rose-700",
};

const SUBMIT_LABELS: Record<RepaymentType, string> = {
  REGULAR_EMI:     "Collect EMI",
  PARTIAL_PAYMENT: "Record Partial Payment",
  ADVANCE_PAYMENT: "Record Advance Payment",
  FORECLOSURE:     "Confirm Foreclosure",
};

function detectRepaymentType(
  num: number,
  emi: number,
  outstanding: number,
): RepaymentType | null {
  if (!num || num <= 0) return null;
  if (num >= outstanding - 0.05)          return "FORECLOSURE";
  if (emi > 0 && Math.abs(num - emi) <= 1) return "REGULAR_EMI";
  if (emi > 0 && num > emi + 1)            return "ADVANCE_PAYMENT";
  return "PARTIAL_PAYMENT";
}

export default function CollectDialog({
  customer, orgId, orgName, agentId, agentName, onClose,
  collectedByRole, collectedById,
}: CollectDialogProps) {
  const [collectMode,     setCollectMode]     = useState<CollectMode>(null);
  const [activeLoan,      setActiveLoan]      = useState<Loan | null>(null);
  const [nextInstallment, setNextInstallment] = useState<LoanInstallment | null>(null);
  const [loadingDetails,  setLoadingDetails]  = useState(false);
  const [amount,          setAmount]          = useState("");
  const [amountError,     setAmountError]     = useState("");
  const [paymentMode,     setPaymentMode]     = useState<PaymentMode>("CASH");
  const [notes,           setNotes]           = useState("");
  const [submitting,      setSubmitting]      = useState(false);
  const [receipt,         setReceipt]         = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (!customer) {
      setCollectMode(null); setAmount(""); setAmountError("");
      setActiveLoan(null); setNextInstallment(null);
      return;
    }
    setLoadingDetails(true);
    setAmount(""); setAmountError(""); setPaymentMode("CASH");
    setNotes(""); setActiveLoan(null); setNextInstallment(null);

    (async () => {
      try {
        const loan = await getActiveLoanForCustomer(customer.id, orgId);
        if (loan && (loan.status === "CLOSED" || (loan.outstandingBalance ?? 0) <= 0)) {
          setActiveLoan(null);
          setCollectMode("GENERAL");
        } else if (loan) {
          setActiveLoan(loan);
          try { await syncInstallmentStatuses(loan.id); } catch (_) {}
          const inst = await getNextPendingInstallment(loan.id);
          setNextInstallment(inst);
          if (inst) setAmount(String(Math.round(inst.emiAmount || 0)));
          setCollectMode("LOAN_EMI");
        } else {
          setCollectMode("GENERAL");
        }
      } catch {
        toast.error("Failed to load account details.");
        setCollectMode("GENERAL");
      } finally {
        setLoadingDetails(false);
      }
    })();
  }, [customer?.id]);

  const outstanding  = activeLoan ? (activeLoan.outstandingBalance ?? 0) : 0;
  const emiAmount    = nextInstallment ? (nextInstallment.emiAmount ?? 0) : 0;
  const custName     = customer ? (customer.fullName || customer.name || customer.email || "") : "";
  const numAmount    = Number(amount);

  const detectedType = useMemo<RepaymentType | null>(() => {
    if (collectMode !== "LOAN_EMI" || !activeLoan) return null;
    if (!amount.trim() || isNaN(numAmount) || numAmount <= 0) return null;
    return detectRepaymentType(numAmount, emiAmount, outstanding);
  }, [amount, emiAmount, outstanding, collectMode, activeLoan]);

  const exceedsOutstanding = numAmount > outstanding + 0.05 && numAmount > 0;

  const advancePreview = useMemo(() => {
    if (detectedType !== "ADVANCE_PAYMENT" || !nextInstallment || !numAmount) return null;
    if (emiAmount <= 0) return null;
    const fullEMIs = Math.floor(numAmount / emiAmount);
    const partial  = numAmount - fullEMIs * emiAmount;
    return { fullEMIs, partial: Math.round(partial * 100) / 100 };
  }, [detectedType, numAmount, emiAmount, nextInstallment]);

  const partialRemaining = useMemo(() => {
    if (detectedType !== "PARTIAL_PAYMENT" || !nextInstallment || !numAmount) return null;
    return Math.max(0, Math.round((emiAmount - numAmount) * 100) / 100);
  }, [detectedType, numAmount, emiAmount, nextInstallment]);

  const handleAmountChange = (val: string) => {
    setAmount(val.replace(/[^0-9.]/g, ""));
    setAmountError("");
  };

  const handleCollectEMI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !activeLoan || !agentId) return;

    const num = numAmount;
    if (!num || isNaN(num) || num <= 0) { setAmountError("Amount must be greater than ₹0"); return; }
    if (num > outstanding + 0.05) {
      setAmountError(`Amount exceeds outstanding balance of ₹${outstanding.toLocaleString("en-IN")}`);
      return;
    }

    const type = detectedType;
    if (!type) { setAmountError("Enter a valid amount"); return; }

    if ((type === "REGULAR_EMI" || type === "PARTIAL_PAYMENT") && !nextInstallment) {
      setAmountError("No pending installment found"); return;
    }

    setAmountError("");
    setSubmitting(true);

    const collectorInfo = {
      organizationId: orgId, organizationName: orgName,
      loanId: activeLoan.id, customerId: customer.id,
      agentId, agentName, paymentMode,
      ...(collectedByRole ? { collectedByRole } : {}),
      ...(collectedById   ? { collectedById   } : {}),
    };

    try {
      if (type === "REGULAR_EMI") {
        const result = await recordEMICollection({
          ...collectorInfo,
          installmentId: nextInstallment!.id,
          amount: num,
        });
        setReceipt({
          receiptNo: result.receiptNo, organizationName: orgName,
          customerName: custName, amount: num,
          collectionType: "LOAN_EMI", repaymentType: "REGULAR",
          loanOutstanding: result.loanClosed ? 0 : Math.max(0, outstanding - num),
          installmentNo: nextInstallment!.installmentNo, agentName, collectedAt: new Date(),
        });
        onClose();
        toast.success(`EMI ₹${num.toLocaleString("en-IN")} collected · ${result.receiptNo}`);

      } else if (type === "PARTIAL_PAYMENT") {
        const result = await recordPartialPayment({
          ...collectorInfo,
          installmentId: nextInstallment!.id,
          amount: num,
        });
        setReceipt({
          receiptNo: result.receiptNo, organizationName: orgName,
          customerName: custName, amount: num,
          collectionType: "LOAN_EMI", repaymentType: "PARTIAL",
          loanOutstanding: result.loanClosed ? 0 : Math.max(0, outstanding - num),
          installmentNo: nextInstallment!.installmentNo, agentName, collectedAt: new Date(),
        });
        onClose();
        toast.success(`Partial ₹${num.toLocaleString("en-IN")} collected · ${result.receiptNo}`);

      } else if (type === "ADVANCE_PAYMENT") {
        const result = await recordAdvancePayment({
          ...collectorInfo,
          amount: num,
        });
        setReceipt({
          receiptNo: result.receiptNo, organizationName: orgName,
          customerName: custName, amount: num,
          collectionType: "LOAN_EMI", repaymentType: "ADVANCE",
          loanOutstanding: result.loanClosed ? 0 : Math.max(0, outstanding - num),
          emisCleared: result.emisCleared, agentName, collectedAt: new Date(),
        });
        onClose();
        toast.success(`Advance ₹${num.toLocaleString("en-IN")} · ${result.emisCleared} EMI${result.emisCleared !== 1 ? "s" : ""} cleared · ${result.receiptNo}`);

      } else if (type === "FORECLOSURE") {
        const result = await recordForeclosure({
          organizationId: orgId, organizationName: orgName,
          loanId: activeLoan.id, customerId: customer.id,
          agentId, agentName, paymentMode,
          ...(collectedByRole ? { collectedByRole } : {}),
          ...(collectedById   ? { collectedById   } : {}),
        });
        setReceipt({
          receiptNo: result.receiptNo, organizationName: orgName,
          customerName: custName, amount: result.amountPaid,
          collectionType: "LOAN_EMI", repaymentType: "FORECLOSURE",
          loanOutstanding: 0, agentName, collectedAt: new Date(),
        });
        onClose();
        toast.success(`Loan foreclosed · ₹${result.amountPaid.toLocaleString("en-IN")} settled · ${result.receiptNo}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Collection failed.");
    } finally { setSubmitting(false); }
  };

  const handleCollectGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !agentId) return;
    const num = Number(amount);
    if (!amount.trim())         { setAmountError("Amount is required"); return; }
    if (isNaN(num) || num <= 0) { setAmountError("Amount must be greater than ₹0"); return; }
    if (num > 1_000_000)        { setAmountError("Amount cannot exceed ₹10,00,000"); return; }
    setAmountError("");
    setSubmitting(true);
    try {
      const result = await recordGeneralCollection({
        organizationId: orgId, organizationName: orgName,
        customerId: customer.id, agentId, agentName, amount: num,
        paymentMode, notes: notes.trim() || undefined,
        ...(collectedByRole ? { collectedByRole } : {}),
        ...(collectedById   ? { collectedById   } : {}),
      });
      setReceipt({
        receiptNo: result.receiptNo, organizationName: orgName,
        customerName: custName, amount: num,
        collectionType: "SAVINGS", agentName, collectedAt: new Date(),
      });
      onClose();
      toast.success(`₹${num.toLocaleString("en-IN")} collected · ${result.receiptNo}`);
    } catch (err: any) {
      toast.error(err?.message || "Collection failed.");
    } finally { setSubmitting(false); }
  };

  const canSubmit =
    !submitting &&
    !loadingDetails &&
    !exceedsOutstanding &&
    !!detectedType &&
    numAmount > 0;

  const submitBtnColor = detectedType ? SUBMIT_COLORS[detectedType] : "bg-indigo-600 hover:bg-indigo-700";
  const submitLabel    = detectedType ? SUBMIT_LABELS[detectedType] : "Collect";

  return (
    <>
      <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {collectMode === "LOAN_EMI"
                ? <CreditCard className="w-5 h-5 text-indigo-600" />
                : <Banknote className="w-5 h-5 text-emerald-600" />}
              {collectMode === "LOAN_EMI" ? "Record EMI Payment" : "Record Collection"}
            </DialogTitle>
          </DialogHeader>

          {customer && (
            <div className="mt-1 space-y-4">
              {/* Customer info card */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-1">
                <p className="font-bold text-slate-900 text-sm">{custName}</p>
                <p className="text-xs text-slate-500">{customer.phone || customer.email}</p>

                {loadingDetails ? (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
                    <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                    <span className="text-xs text-slate-400">Loading account details…</span>
                  </div>
                ) : (
                  <>
                    {collectMode === "LOAN_EMI" && activeLoan && (
                      <>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                          <span className="text-xs text-slate-500">Outstanding Balance</span>
                          <span className="font-bold text-indigo-600 text-sm">
                            ₹{outstanding.toLocaleString("en-IN")}
                          </span>
                        </div>
                        {nextInstallment && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Monthly EMI</span>
                            <span className="text-xs font-semibold text-slate-700">
                              ₹{Math.round(emiAmount).toLocaleString("en-IN")}/mo
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {collectMode === "GENERAL" && (
                      <p className="text-xs text-emerald-600 mt-1 pt-1 border-t border-slate-200">
                        General collection
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* ── LOAN EMI FORM ── */}
              {collectMode === "LOAN_EMI" && activeLoan && !loadingDetails && (
                <form onSubmit={handleCollectEMI} className="space-y-4">

                  {/* Amount input */}
                  <div className="space-y-2">
                    <Label htmlFor="cd-emi-amt">
                      Payment Amount (₹)
                    </Label>
                    <Input
                      id="cd-emi-amt"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      placeholder={`e.g. ₹${Math.round(emiAmount).toLocaleString("en-IN")}`}
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      className={`text-xl h-12 font-bold ${
                        exceedsOutstanding || amountError ? "border-red-400" : detectedType ? `border-2 ${TYPE_META[detectedType].border}` : ""
                      }`}
                      autoFocus
                      disabled={submitting}
                    />

                    {/* Exceeds outstanding error */}
                    {exceedsOutstanding && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Amount exceeds outstanding balance of ₹{outstanding.toLocaleString("en-IN")}
                      </div>
                    )}
                    <FieldError error={amountError} />
                  </div>

                  {/* Auto-detected repayment type badge */}
                  {detectedType && !exceedsOutstanding ? (
                    <div className={`rounded-xl border px-4 py-3 space-y-2 ${TYPE_META[detectedType].bg} ${TYPE_META[detectedType].border}`}>
                      <div className="flex items-center gap-2">
                        <Sparkles className={`w-3.5 h-3.5 shrink-0 ${TYPE_META[detectedType].text}`} />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                          Detected Repayment Type
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {React.createElement(TYPE_META[detectedType].icon, {
                          className: `w-4 h-4 shrink-0 ${TYPE_META[detectedType].text}`,
                        })}
                        <div>
                          <p className={`text-sm font-bold leading-tight ${TYPE_META[detectedType].text}`}>
                            {TYPE_META[detectedType].label}
                          </p>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {TYPE_META[detectedType].sublabel}
                          </p>
                        </div>
                      </div>

                      {/* REGULAR EMI hint */}
                      {detectedType === "REGULAR_EMI" && nextInstallment && (
                        <p className="text-xs text-indigo-600">
                          EMI #{nextInstallment.installmentNo} will be marked as paid.
                        </p>
                      )}

                      {/* PARTIAL hint */}
                      {detectedType === "PARTIAL_PAYMENT" && partialRemaining !== null && (
                        <p className="text-xs text-amber-700">
                          Remaining balance on this EMI: <strong>₹{partialRemaining.toLocaleString("en-IN")}</strong>. Installment will be marked PARTIAL.
                        </p>
                      )}

                      {/* ADVANCE preview */}
                      {detectedType === "ADVANCE_PAYMENT" && advancePreview && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                          Clears <strong>{advancePreview.fullEMIs}</strong> full EMI{advancePreview.fullEMIs !== 1 ? "s" : ""}
                          {advancePreview.partial > 0 && ` + ₹${advancePreview.partial.toLocaleString("en-IN")} partial`}
                        </div>
                      )}

                      {/* FORECLOSURE warning */}
                      {detectedType === "FORECLOSURE" && (
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500 mt-0.5" />
                            <p className="text-xs text-rose-700 leading-snug">
                              This will settle the entire outstanding balance and <strong>close the loan immediately</strong>.
                            </p>
                          </div>
                          <div className="bg-white rounded-lg px-3 py-2 flex justify-between items-center border border-rose-100">
                            <span className="text-xs text-slate-500">Settlement Amount</span>
                            <span className="text-base font-black text-rose-700">
                              ₹{outstanding.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    !exceedsOutstanding && amount.trim() === "" && nextInstallment && (
                      <p className="text-xs text-slate-400 text-center">
                        Enter an amount — repayment type will be detected automatically
                      </p>
                    )
                  )}

                  {/* Payment Mode */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Payment Mode</Label>
                    <div className="flex gap-1.5">
                      {(["CASH", "UPI", "BANK_TRANSFER"] as PaymentMode[]).map((m) => (
                        <button key={m} type="button" onClick={() => setPaymentMode(m)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors ${
                            paymentMode === m
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                          }`}
                        >
                          {m === "BANK_TRANSFER" ? "Bank" : m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className={`flex-1 h-11 text-white ${submitBtnColor}`}
                      disabled={!canSubmit}
                    >
                      {submitting
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                        : submitLabel}
                    </Button>
                  </div>
                </form>
              )}

              {/* No active loan */}
              {collectMode === "LOAN_EMI" && !activeLoan && !loadingDetails && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3 border border-amber-100">
                  ℹ No active loan found for this customer.
                </p>
              )}

              {/* ── GENERAL COLLECTION FORM ── */}
              {collectMode === "GENERAL" && (
                <form onSubmit={handleCollectGeneral} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cd-gen-amt">Amount to Collect (₹)</Label>
                    <Input id="cd-gen-amt" type="number" inputMode="decimal" min="1" placeholder="e.g. 100"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setAmountError(""); }}
                      className={`text-xl h-12 font-bold ${amountError ? "border-red-400" : ""}`}
                      autoFocus disabled={submitting}
                    />
                    <FieldError error={amountError} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Payment Mode</Label>
                    <div className="flex gap-1.5">
                      {(["CASH", "UPI", "BANK_TRANSFER"] as PaymentMode[]).map((m) => (
                        <button key={m} type="button"
                          onClick={() => setPaymentMode(m)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors ${
                            paymentMode === m
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-emerald-400"
                          }`}
                        >
                          {m === "BANK_TRANSFER" ? "Bank" : m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cd-gen-notes">
                      Notes <span className="text-slate-400 font-normal text-xs">(optional)</span>
                    </Label>
                    <Input id="cd-gen-notes" type="text" placeholder="e.g. advance, late fee…"
                      value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                      className="h-9 text-sm" disabled={submitting}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-11"
                      disabled={submitting || loadingDetails}>
                      {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : "Collect"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
