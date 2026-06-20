import { format } from "date-fns";
import { X, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReceiptData {
  receiptNo: string;
  organizationName: string;
  customerName: string;
  accountNumber?: string;
  amount: number;
  savingsAmount?: number;
  loanAmount?: number;
  newBalance?: number;
  collectionType: "SAVINGS" | "LOAN_EMI" | "BOTH";
  agentName: string;
  collectedAt: Date;
  loanId?: string;
  installmentNo?: number;
  loanOutstanding?: number;
}

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

function safeN(v: any): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  if (!receipt) return null;

  const handlePrint = () => window.print();

  const displayBalance = safeN(receipt.newBalance);
  const displayOutstanding = safeN(receipt.loanOutstanding);

  return (
    <>
      {/*
        Print CSS — visibility approach so it works inside React's #root container.
        Using `body > *` hiding would hide #root itself and blank the page.
      */}
      <style>{`
        @media print {
          /* Make everything invisible, then reveal only the receipt card */
          body * { visibility: hidden !important; }
          .fc-receipt-modal,
          .fc-receipt-modal * { visibility: visible !important; }

          /* Position receipt at top-left of the 80mm page */
          .fc-receipt-modal {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            background: white !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 6mm !important;
            margin: 0 !important;
          }

          /* 80mm thermal paper */
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      <div className="fc-receipt-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="fc-receipt-modal relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
          {/* Close ✕ */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ── Receipt Content ─────────────────────────────────────────── */}
          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-4">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">FundCircle</h2>
              <p className="text-sm font-semibold text-slate-600 mt-0.5">{receipt.organizationName}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                {receipt.collectionType === "SAVINGS"
                  ? "✓ Savings Receipt"
                  : receipt.collectionType === "BOTH"
                  ? "✓ Combined Collection Receipt"
                  : "✓ EMI Payment Receipt"}
              </div>
            </div>

            {/* Receipt number */}
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receipt Number</p>
              <p className="text-base font-black text-slate-900 mt-0.5 font-mono tracking-wide">
                {receipt.receiptNo || "—"}
              </p>
            </div>

            {/* Details */}
            <div className="space-y-2.5 text-sm">
              <ReceiptRow label="Customer" value={receipt.customerName || "—"} />
              {receipt.accountNumber && (
                <ReceiptRow label="Account No." value={receipt.accountNumber} />
              )}
              <ReceiptRow
                label="Date & Time"
                value={
                  receipt.collectedAt instanceof Date && receipt.collectedAt.getTime() > 0
                    ? format(receipt.collectedAt, "dd MMM yyyy, hh:mm a")
                    : "—"
                }
              />
              <ReceiptRow label="Collected By" value={receipt.agentName || "—"} />
              {receipt.collectionType === "LOAN_EMI" && receipt.installmentNo && (
                <ReceiptRow label="EMI Installment" value={`#${receipt.installmentNo}`} />
              )}
            </div>

            {/* Amounts */}
            <div className="border-t border-dashed border-slate-300 pt-4 space-y-2">
              {receipt.collectionType === "BOTH" ? (
                <>
                  {receipt.savingsAmount !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Savings Deposit</span>
                      <span className="font-bold text-emerald-600">
                        ₹{safeN(receipt.savingsAmount).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {receipt.loanAmount !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">EMI Payment</span>
                      <span className="font-bold text-indigo-600">
                        ₹{safeN(receipt.loanAmount).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-2">
                    <span className="font-bold text-slate-700">Total Collected</span>
                    <span className="text-xl font-black text-emerald-600">
                      ₹{safeN(receipt.amount).toLocaleString()}
                    </span>
                  </div>
                  {receipt.newBalance !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">New Savings Balance</span>
                      <span className="font-bold text-slate-900">₹{displayBalance.toLocaleString()}</span>
                    </div>
                  )}
                  {receipt.loanOutstanding !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Loan Outstanding</span>
                      <span className="font-bold text-slate-900">
                        {receipt.loanOutstanding === 0
                          ? <span className="text-emerald-600">LOAN CLOSED ✓</span>
                          : `₹${displayOutstanding.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">
                      {receipt.collectionType === "SAVINGS" ? "Amount Deposited" : "EMI Amount Paid"}
                    </span>
                    <span className="text-xl font-black text-emerald-600">
                      ₹{safeN(receipt.amount).toLocaleString()}
                    </span>
                  </div>
                  {receipt.collectionType === "SAVINGS" && receipt.newBalance !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">New Savings Balance</span>
                      <span className="font-bold text-slate-900">₹{displayBalance.toLocaleString()}</span>
                    </div>
                  )}
                  {receipt.collectionType === "LOAN_EMI" && receipt.loanOutstanding !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Outstanding Balance</span>
                      <span className="font-bold text-slate-900">
                        {receipt.loanOutstanding === 0 ? (
                          <span className="text-emerald-600">LOAN CLOSED ✓</span>
                        ) : (
                          `₹${displayOutstanding.toLocaleString()}`
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-dashed border-slate-300 pt-3 text-center">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                This is a digitally generated receipt.<br />
                No signature required. Powered by FundCircle.
              </p>
            </div>
          </div>

          {/* ── Action Buttons ─────────────────────────────────────────── */}
          <div className="px-6 pb-6 flex gap-3">
            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex-1 gap-2 h-11"
            >
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button
              onClick={onClose}
              className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-semibold text-slate-900 text-right">{value || "—"}</span>
    </div>
  );
}
