/**
 * PhonePeQRPanel — Dynamic QR payment panel for the CollectDialog.
 *
 * Flow:
 *  1. On mount → calls /api/phonepe/create-order (server creates PhonePe order)
 *  2. Renders QR from the UPI intent URL returned by PhonePe
 *  3. Listens to phonePeOrders/{txnId} via Firestore realtime for webhook-driven updates
 *  4. "Refresh Status" button manually polls /api/phonepe/check-status
 *  5. On SUCCESS → calls onSuccess(phonePeTransactionId) which triggers collection recording
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Loader2, QrCode, CheckCircle2, XCircle, RefreshCw,
  Banknote, AlertTriangle, Smartphone, Zap,
} from "lucide-react";
import { toast } from "sonner";

const API_BASE = import.meta.env.DEV ? "http://localhost:3002" : "";

type PanelState =
  | "creating"   // calling /create-order
  | "qr_ready"   // showing QR, waiting for scan
  | "polling"    // manual status refresh in progress
  | "success"    // payment confirmed
  | "failed"     // payment failed
  | "expired"    // order expired (15 min)
  | "error";     // API error creating order

export interface PhonePeQRPanelProps {
  orgId:          string;
  orgName:        string;
  loanId?:        string;
  installmentId?: string;
  customerId:     string;
  customerName:   string;
  customerPhone?: string;
  agentId:        string;
  agentName:      string;
  amount:         number;
  installmentNo?: number;
  collectionType: "LOAN_EMI" | "GENERAL";
  collectedByRole?: string;
  collectedById?:   string;
  onSuccess:      (phonePeTransactionId: string, utr?: string) => void;
  onCancel:       () => void;
  onSwitchToStatic: () => void;
}

export default function PhonePeQRPanel({
  orgId, orgName, loanId, installmentId, customerId, customerName,
  customerPhone, agentId, agentName, amount, installmentNo,
  collectionType, collectedByRole, collectedById,
  onSuccess, onCancel, onSwitchToStatic,
}: PhonePeQRPanelProps) {
  const { getToken }     = useAuth();
  const [state,      setState]      = useState<PanelState>("creating");
  const [txnId,      setTxnId]      = useState<string>("");
  const [qrUrl,      setQrUrl]      = useState<string>("");
  const [qrErr,      setQrErr]      = useState(false);
  const [errMsg,     setErrMsg]     = useState("");
  const [ppTxnId,    setPpTxnId]    = useState("");
  const [ppUtr,      setPpUtr]      = useState("");
  const [elapsed,    setElapsed]    = useState(0);
  const [retryCount, setRetryCount] = useState(0); // increment to re-create order
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsub        = useRef<(() => void) | null>(null);
  const succeededRef = useRef(false);

  const ORDER_EXPIRY_SECS = 15 * 60; // 15 minutes

  // ── Create order on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState("creating");
      setQrErr(false);
      setTxnId("");
      setQrUrl("");
      setErrMsg("");
      succeededRef.current = false;
      try {
        const token = await getToken();
        const res   = await fetch(`${API_BASE}/api/phonepe/create-order`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            organizationId: orgId,
            loanId, installmentId,
            customerId, customerName, customerPhone,
            agentId, agentName, amount, collectionType,
            installmentNo,
            collectedByRole, collectedById,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setErrMsg(data.error || data.message || "Could not create PhonePe order.");
          setState("error");
          return;
        }
        const { merchantTransactionId, intentUrl } = data;
        setTxnId(merchantTransactionId);
        if (intentUrl) {
          // Build QR code URL from the UPI intent string
          const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(intentUrl)}&bgcolor=ffffff&color=1e1b4b&margin=8&qzone=1`;
          setQrUrl(qr);
        }
        setState("qr_ready");
      } catch (err: any) {
        if (!cancelled) {
          setErrMsg(err.message || "Network error.");
          setState("error");
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  // ── Firestore realtime listener on phonePeOrders/{txnId} ─────────────────
  useEffect(() => {
    if (!txnId) return;
    const docRef = doc(db, "phonePeOrders", txnId);
    unsub.current = onSnapshot(docRef, (snap) => {
      if (!snap.exists() || succeededRef.current) return;
      const d = snap.data();
      const s = d?.status as string;
      if (s === "SUCCESS" || s === "COMPLETED") {
        succeededRef.current = true;
        setPpTxnId(d?.phonePeTransactionId || "");
        setPpUtr(d?.utr || "");
        setState("success");
      } else if (s === "FAILED" || s === "PAYMENT_ERROR") {
        setState("failed");
        setErrMsg(d?.errorMessage || "Payment failed or declined.");
      } else if (s === "EXPIRED") {
        setState("expired");
      }
    });
    return () => unsub.current?.();
  }, [txnId]);

  // ── Elapsed timer + auto-expire ───────────────────────────────────────────
  useEffect(() => {
    if (state !== "qr_ready" && state !== "polling") return;
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e >= ORDER_EXPIRY_SECS) {
          setState("expired");
          clearInterval(timerRef.current!);
          return e;
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [state]);

  // ── Trigger onSuccess when state changes to success ───────────────────────
  useEffect(() => {
    if (state === "success") {
      // Small delay so the success screen is visible briefly
      const t = setTimeout(() => onSuccess(ppTxnId, ppUtr), 1800);
      return () => clearTimeout(t);
    }
  }, [state, ppTxnId, ppUtr, onSuccess]);

  // ── Manual status refresh ─────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (!txnId || state === "polling" || state === "success") return;
    setState("polling");
    try {
      const token = await getToken();
      const res   = await fetch(`${API_BASE}/api/phonepe/check-status`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ organizationId: orgId, merchantTransactionId: txnId }),
      });
      const data = await res.json();
      if (data.state === "COMPLETED") {
        succeededRef.current = true;
        setPpTxnId(data.transactionId || "");
        setPpUtr(data.utr || "");
        setState("success");
      } else if (data.state === "FAILED") {
        setState("failed");
        setErrMsg(data.errorMessage || "Payment was declined.");
      } else {
        // Still pending
        setState("qr_ready");
        toast.info("Payment is still pending. Ask the customer to complete payment.");
      }
    } catch (err: any) {
      setState("qr_ready");
      toast.error("Could not check status. Try again.");
    }
  }, [txnId, state, orgId, getToken]);

  const mins = String(Math.floor((ORDER_EXPIRY_SECS - elapsed) / 60)).padStart(2, "0");
  const secs = String((ORDER_EXPIRY_SECS - elapsed) % 60).padStart(2, "0");

  // ── Render: creating ─────────────────────────────────────────────────────
  if (state === "creating") {
    return (
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 flex flex-col items-center gap-3">
        <Loader2 className="w-7 h-7 text-violet-600 animate-spin" />
        <p className="text-sm font-semibold text-violet-800">Generating PhonePe QR…</p>
        <p className="text-xs text-violet-600 text-center">Creating a payment order on PhonePe's servers</p>
      </div>
    );
  }

  // ── Render: error ─────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">PhonePe QR Unavailable</p>
            <p className="text-xs text-red-600 mt-0.5">{errMsg}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 h-9 text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onSwitchToStatic}>
            <Banknote className="w-3.5 h-3.5 mr-1.5" />Use Static UPI
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: success ───────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <p className="text-base font-bold text-emerald-800">Payment Successful!</p>
        <p className="text-xs text-emerald-700 text-center">
          ₹{amount.toLocaleString("en-IN")} received via PhonePe
        </p>
        {ppUtr && (
          <div className="rounded-lg bg-white border border-emerald-200 px-3 py-2 w-full">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">UTR Reference</p>
            <p className="text-xs font-mono font-semibold text-slate-800">{ppUtr}</p>
          </div>
        )}
        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
        <p className="text-[11px] text-emerald-600">Recording collection…</p>
      </div>
    );
  }

  // ── Render: failed ────────────────────────────────────────────────────────
  if (state === "failed") {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">Payment Failed</p>
            <p className="text-xs text-red-600">{errMsg || "The payment was declined or failed."}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 h-10 text-sm" onClick={onCancel}>Cancel</Button>
          <Button type="button" className="flex-1 h-10 text-sm bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onSwitchToStatic}>
            <Banknote className="w-3.5 h-3.5 mr-1.5" />Use Cash / Static UPI
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: expired ───────────────────────────────────────────────────────
  if (state === "expired") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-100 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">QR Code Expired</p>
            <p className="text-xs text-amber-700">This payment session has expired (15 min limit).</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 h-10 text-sm" onClick={onCancel}>Cancel</Button>
          <Button type="button" className="flex-1 h-10 text-sm bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => { setRetryCount(r => r + 1); setElapsed(0); }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Generate New QR
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: qr_ready | polling ────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-600" />
          <p className="text-sm font-bold text-violet-900">PhonePe QR Payment</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            Expires {mins}:{secs}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse inline-block" />
            Live
          </span>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-3">
        {qrErr || !qrUrl ? (
          <div className="w-[200px] h-[200px] rounded-xl bg-slate-100 flex flex-col items-center justify-center gap-2 border border-slate-200">
            <QrCode className="w-10 h-10 text-slate-300" />
            <p className="text-[10px] text-slate-400 text-center px-4">QR unavailable — ask customer to use UPI app directly</p>
          </div>
        ) : (
          <div className="p-2 rounded-xl border-2 border-violet-200 bg-white shadow-sm">
            {state === "polling" ? (
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
              </div>
            ) : (
              <img
                src={qrUrl}
                alt="PhonePe QR Code"
                width={200}
                height={200}
                className="rounded-lg"
                onError={() => setQrErr(true)}
              />
            )}
          </div>
        )}

        {/* Amount & details */}
        <div className="w-full text-center space-y-1">
          <p className="text-3xl font-black text-violet-700">₹{amount.toLocaleString("en-IN")}</p>
          <p className="text-xs font-semibold text-slate-700">{customerName}</p>
          {installmentNo && (
            <p className="text-[10px] text-slate-500">EMI #{installmentNo} · {loanId?.slice(-8).toUpperCase()}</p>
          )}
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
              <Smartphone className="w-3 h-3 text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-700">{orgName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Instruction */}
      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
        Ask customer to scan using <strong>PhonePe, Google Pay, Paytm, BHIM</strong> or any UPI app.
        Status updates automatically when payment is received.
      </p>

      {/* Transaction ID */}
      {txnId && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Transaction ID</p>
          <p className="text-xs font-mono text-slate-700 font-semibold break-all">{txnId}</p>
        </div>
      )}

      {/* Actions */}
      <Button
        type="button"
        onClick={handleRefresh}
        disabled={state === "polling"}
        variant="outline"
        className="w-full h-10 text-sm gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
      >
        {state === "polling"
          ? <><Loader2 className="w-4 h-4 animate-spin" />Checking Status…</>
          : <><RefreshCw className="w-4 h-4" />Refresh Payment Status</>}
      </Button>

      <div className="flex gap-2 border-t border-violet-100 pt-3">
        <Button type="button" variant="outline" className="flex-1 h-9 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-9 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          onClick={onSwitchToStatic}
        >
          <Banknote className="w-3.5 h-3.5 mr-1" />Use Static UPI
        </Button>
      </div>
    </div>
  );
}
