import { useState, useRef, useEffect } from "react";
import { useCollectionRealtime } from "@/lib/firestore-hooks";
import { Collection, Membership } from "@/types";
import { sanitizeSearch } from "@/lib/validation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format, startOfDay, subDays, isAfter } from "date-fns";
import {
  Search, Download, IndianRupee, ChevronDown, Loader2,
  X, Filter, User, BadgeCheck, Calendar, SlidersHorizontal,
  FileSpreadsheet, Eye,
} from "lucide-react";
import { exportCollectionsReport } from "@/lib/exportExcel";
import { createAuditLog } from "@/lib/services";
import { fcToast } from "@/lib/toast";
import { useOrganization, useUser } from "@clerk/clerk-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

type CollectionTypeFilter = "ALL" | "LOAN_EMI" | "GENERAL" | "SAVINGS" | "BOTH";
type DateRangeFilter      = "ALL" | "TODAY" | "WEEK" | "MONTH";

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDate(ts: any): Date {
  if (!ts) return new Date(0);
  if (ts?.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

/** Indian rupee locale formatting: ₹1,00,000 */
function inr(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return "₹0";
  return "₹" + Number(amount).toLocaleString("en-IN");
}

function getCollectionAmount(col: Collection): number {
  return Number(col.amount) || 0;
}

function getEmiAmount(col: Collection): number {
  if ((col as any).collectionType === "LOAN_EMI") return Number(col.amount) || 0;
  if ((col as any).collectionType === "BOTH")     return Number((col as any).loanAmount) || 0;
  return 0;
}

function getGeneralAmount(col: Collection): number {
  if ((col as any).collectionType === "GENERAL") return Number(col.amount) || 0;
  return 0;
}

function getSavingsAmount(col: Collection): number {
  if ((col as any).collectionType === "SAVINGS") return Number(col.amount) || 0;
  if ((col as any).collectionType === "BOTH")    return Number((col as any).savingsAmount) || 0;
  return 0;
}

/** Member name helper: tries fullName, name, email, id-suffix */
function memberName(m: Membership | undefined | null, fallback = "—"): string {
  if (!m) return fallback;
  return (m as any).fullName || (m as any).name || m.email || fallback;
}

/** Resolve collected-by member (use collectedById first, then agentId) */
function resolveCollector(col: Collection, members: Membership[]): Membership | undefined {
  const id = (col as any).collectedById || col.agentId;
  if (!id) return undefined;
  return members.find((m) => (m as any).clerkUserId === id || m.id === id);
}

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type?: string }) {
  const t = (type || "").toUpperCase();
  const cfg: Record<string, { label: string; cls: string }> = {
    LOAN_EMI: { label: "EMI",       cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    GENERAL:  { label: "General",   cls: "bg-sky-50 text-sky-700 border-sky-200"         },
    SAVINGS:  { label: "Savings",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    BOTH:     { label: "S + EMI",   cls: "bg-violet-50 text-violet-700 border-violet-200"  },
  };
  const { label, cls } = cfg[t] || { label: t || "—", cls: "bg-slate-50 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-bold uppercase tracking-wide shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role?: string }) {
  const r = (role || "AGENT").toUpperCase();
  const isOwner = r === "OWNER" || r === "MANAGER";
  return (
    <span className={`inline-flex items-center h-4 px-1.5 rounded text-[9px] font-bold uppercase tracking-wide shrink-0 ${
      isOwner ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-sky-50 text-sky-700 border border-sky-200"
    }`}>
      {isOwner ? "Owner" : "Collector"}
    </span>
  );
}

// ── Collector display ─────────────────────────────────────────────────────────
function CollectorCell({ col, members }: { col: Collection; members: Membership[] }) {
  const m       = resolveCollector(col, members);
  const name    = m ? memberName(m) : (col as any).collectedByName || "—";
  const role    = (col as any).collectedByRole || (m ? (m.role as string) : "AGENT");
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-slate-800 text-sm font-medium truncate">{name}</span>
      <RoleBadge role={role} />
    </div>
  );
}

// ── Mobile transaction card ───────────────────────────────────────────────────
function TransactionCard({ col, members }: { col: Collection; members: Membership[] }) {
  const cust    = members.find((m) => m.id === col.customerId || (m as any).clerkUserId === col.customerId);
  const d       = toDate((col as any).collectedAt || (col as any).timestamp);
  const colType = (col as any).collectionType;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
      {/* Top row: receipt + amount */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-slate-400 truncate">{(col as any).receiptNo || "No Receipt"}</p>
          <p className="font-bold text-slate-900 text-base truncate">{memberName(cust, col.customerId?.slice(-8) || "—")}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-black text-emerald-600">{inr(getCollectionAmount(col))}</p>
        </div>
      </div>

      {/* Bottom row: type + collector + date */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={colType} />
          <CollectorCell col={col} members={members} />
        </div>
        <span className="text-[11px] text-slate-400 shrink-0">
          {d.getTime() > 0 ? format(d, "dd MMM, h:mm a") : "—"}
        </span>
      </div>

      {/* BOTH type: show savings + EMI split */}
      {colType === "BOTH" && (
        <div className="flex gap-3 pt-1 border-t border-slate-50 text-xs">
          <span className="text-emerald-600 font-semibold">Savings: {inr(getSavingsAmount(col))}</span>
          <span className="text-indigo-600 font-semibold">EMI: {inr(getEmiAmount(col))}</span>
        </div>
      )}
    </div>
  );
}

// ── Collector filter sheet (mobile-friendly) ──────────────────────────────────
interface CollectorFilterProps {
  agents: Membership[];
  value: string;
  onChange: (v: string) => void;
}
function CollectorFilter({ agents, value, onChange }: CollectorFilterProps) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = agents.filter((a) => {
    const n = memberName(a, "").toLowerCase();
    return n.includes(search.toLowerCase());
  });

  const selected = value ? agents.find((a) => a.id === value || (a as any).clerkUserId === value) : null;
  const label    = selected ? memberName(selected) : "All Collectors";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`h-9 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-colors min-w-0 max-w-[180px] ${
          value ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <User className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search collectors…"
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${!value ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}
            >
              All Collectors
            </button>
            {filtered.map((a) => {
              const isOwner = (a.role as string)?.toUpperCase() === "OWNER";
              const isSelected = value === a.id || value === (a as any).clerkUserId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { onChange(a.id); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                    isSelected ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate text-sm">{memberName(a)}</span>
                  <RoleBadge role={a.role as string} />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-4">No collectors found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export preview modal ──────────────────────────────────────────────────────
interface ExportPreviewProps {
  filtered: Collection[];
  members: Membership[];
  emiTotal: number;
  generalTotal: number;
  totalAmount: number;
  onConfirm: () => void;
  onClose: () => void;
  exporting: boolean;
}
function ExportPreviewModal({
  filtered, members, emiTotal, generalTotal, totalAmount,
  onConfirm, onClose, exporting,
}: ExportPreviewProps) {
  const preview = filtered.slice(0, 10);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Export Preview</h3>
              <p className="text-xs text-slate-400">{filtered.length} records will be exported</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="bg-slate-50 rounded-2xl p-3">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-base font-black text-slate-900 truncate">{inr(totalAmount)}</p>
          </div>
          <div className="bg-indigo-50 rounded-2xl p-3">
            <p className="text-xs text-indigo-500">EMI</p>
            <p className="text-base font-black text-indigo-700 truncate">{inr(emiTotal)}</p>
          </div>
          <div className="bg-sky-50 rounded-2xl p-3">
            <p className="text-xs text-sky-500">General</p>
            <p className="text-base font-black text-sky-700 truncate">{inr(generalTotal)}</p>
          </div>
        </div>

        {/* Preview rows */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 space-y-2">
            {preview.map((col) => {
              const cust = members.find((m) => m.id === col.customerId || (m as any).clerkUserId === col.customerId);
              const d = toDate((col as any).collectedAt || (col as any).timestamp);
              return (
                <div key={col.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-50 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{memberName(cust, "—")}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{(col as any).receiptNo || "—"}</p>
                  </div>
                  <TypeBadge type={(col as any).collectionType} />
                  <span className="text-sm font-bold text-emerald-600 shrink-0">{inr(getCollectionAmount(col))}</span>
                </div>
              );
            })}
            {filtered.length > 10 && (
              <p className="text-center text-xs text-slate-400 py-2">
                …and {filtered.length - 10} more records in the Excel file
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={exporting}
            className="flex-1 h-12 rounded-2xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {exporting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
              : <><Download className="w-4 h-4" /> Download Excel</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, amount, count, colorCls }: {
  label: string; amount: number; count?: number; colorCls: string;
}) {
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${colorCls}`}>
      <div className="text-lg sm:text-xl md:text-2xl font-black leading-tight break-all">
        {inr(amount)}
      </div>
      <div className="text-[11px] sm:text-xs mt-0.5 font-medium opacity-75 leading-snug">
        {label}
        {count !== undefined && (
          <span className="ml-1 opacity-60">· {count} txn{count !== 1 ? "s" : ""}</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OrgCollections() {
  const { data: collections, loading } = useCollectionRealtime<Collection>("collections");
  const { data: members }              = useCollectionRealtime<Membership>("organizationMembers");
  const { data: loans }                = useCollectionRealtime<any>("loans");
  const { data: installments }         = useCollectionRealtime<any>("loan_installments");
  const { data: savingsAccounts }      = useCollectionRealtime<any>("savings_accounts");
  const { organization }               = useOrganization();
  const { user }                       = useUser();

  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState<CollectionTypeFilter>("ALL");
  const [dateFilter, setDateFilter]   = useState<DateRangeFilter>("ALL");
  const [agentFilter, setAgentFilter] = useState("");
  const [page, setPage]               = useState(1);
  const [exporting, setExporting]     = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const resetPage = (fn: () => void) => { fn(); setPage(1); };

  // ── Build collector list from actual collections data ──────────────────────
  const collectorIdsInData = new Set(
    collections.map((c) => (c as any).collectedById || c.agentId).filter(Boolean)
  );
  const agents = members.filter((m) => {
    const role = (m.role as string || "").toUpperCase();
    const isCollector = ["AGENT", "PIGMY_COLLECTOR", "OWNER", "MANAGER"].includes(role);
    const clerkId = (m as any).clerkUserId;
    return isCollector && (collectorIdsInData.has(clerkId) || collectorIdsInData.has(m.id));
  });

  // ── Filter logic ───────────────────────────────────────────────────────────
  const filtered = collections.filter((col) => {
    const colType = (col as any).collectionType;

    // type filter
    if (typeFilter !== "ALL" && colType !== typeFilter) return false;

    // date filter
    const d = toDate((col as any).collectedAt || (col as any).timestamp);
    const today = startOfDay(new Date());
    if (dateFilter === "TODAY" && !isAfter(d, today))            return false;
    if (dateFilter === "WEEK"  && !isAfter(d, subDays(today, 7)))  return false;
    if (dateFilter === "MONTH" && !isAfter(d, subDays(today, 30))) return false;

    // collector filter — match by collectedById or legacy agentId
    if (agentFilter) {
      const collectorId = (col as any).collectedById || col.agentId;
      const collectorMember = agents.find((a) => a.id === agentFilter || (a as any).clerkUserId === agentFilter);
      const clerkId = collectorMember ? ((collectorMember as any).clerkUserId || collectorMember.id) : agentFilter;
      if (collectorId !== clerkId && collectorId !== agentFilter) return false;
    }

    // search: customer name, customer ID, receipt number
    if (search) {
      const q = search.toLowerCase();
      const cust = members.find((m) => m.id === col.customerId || (m as any).clerkUserId === col.customerId);
      const custName = ((cust as any)?.fullName || (cust as any)?.name || "").toLowerCase();
      const custId = (col.customerId || "").toLowerCase();
      const receiptNo = ((col as any).receiptNo || "").toLowerCase();
      const collectorName = ((col as any).collectedByName || "").toLowerCase();
      if (
        !custName.includes(q)     &&
        !custId.includes(q)       &&
        !receiptNo.includes(q)    &&
        !collectorName.includes(q)
      ) return false;
    }

    return true;
  }).sort(
    (a, b) =>
      toDate((b as any).collectedAt || (b as any).timestamp).valueOf() -
      toDate((a as any).collectedAt || (a as any).timestamp).valueOf()
  );

  // ── Summary calculations ───────────────────────────────────────────────────
  const totalAmount   = filtered.reduce((s, c) => s + getCollectionAmount(c), 0);
  const emiTotal      = filtered.reduce((s, c) => s + getEmiAmount(c), 0);
  const generalTotal  = filtered.reduce((s, c) => s + getGeneralAmount(c), 0);
  // Note: savingsTotal kept for legacy data integrity
  const savingsLegacy = filtered.reduce((s, c) => s + getSavingsAmount(c), 0);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore   = page * PAGE_SIZE < filtered.length;

  // ── Distinct active types in data ─────────────────────────────────────────
  const typesInData = new Set(collections.map((c) => (c as any).collectionType).filter(Boolean));
  const showSavings = typesInData.has("SAVINGS") || typesInData.has("BOTH");

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportConfirm = async () => {
    setExporting(true);
    try {
      await exportCollectionsReport({
        orgName: organization?.name || "FundCircle Organization",
        collections: filtered,          // export filtered selection, not all
        members, loans, installments, savingsAccounts,
      });
      fcToast.reportExported("Excel Report");
      setShowPreview(false);
      if (organization?.id && user?.id) {
        createAuditLog({
          organizationId: organization.id,
          actorId: user.id,
          actorRole: "OWNER",
          actorName: user.fullName || user.firstName || "",
          action: "EXCEL_EXPORTED",
          module: "REPORTS",
          category: "EXPORT",
          entityType: "Report",
          entityId: organization.id,
          description: `${user.fullName || "Owner"} exported ${filtered.length} collection records to Excel`,
          metadata: { totalRecords: filtered.length, exportedAt: new Date().toISOString() },
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Export failed:", err);
      fcToast.exportFailed();
    } finally {
      setExporting(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-7 w-48 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-200 rounded-2xl" />)}
        </div>
        <div className="flex gap-2 flex-wrap">
          {[...Array(4)].map((_, i) => <div key={i} className="h-9 w-20 bg-slate-200 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // ── Active filter count (for badge) ────────────────────────────────────────
  const activeFilters = [typeFilter !== "ALL", dateFilter !== "ALL", !!agentFilter, !!search].filter(Boolean).length;

  return (
    <>
      {/* Export preview modal */}
      {showPreview && (
        <ExportPreviewModal
          filtered={filtered}
          members={members}
          emiTotal={emiTotal}
          generalTotal={generalTotal}
          totalAmount={totalAmount}
          onConfirm={handleExportConfirm}
          onClose={() => setShowPreview(false)}
          exporting={exporting}
        />
      )}

      <div className="space-y-5">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Collections Ledger</h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              All EMI payments and general collections — realtime, searchable.
            </p>
          </div>
          <button
            onClick={() => setShowPreview(true)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-green-200 bg-white hover:bg-green-50 text-green-700 text-xs font-bold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Preview &amp;</span> Export
          </button>
        </div>

        {/* ── Summary cards ──────────────────────────────────────────────── */}
        <div className={`grid gap-3 ${showSavings ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
          <SummaryCard
            label={`Total · ${filtered.length} record${filtered.length !== 1 ? "s" : ""}`}
            amount={totalAmount}
            colorCls="bg-slate-50 border-slate-200 text-slate-900"
          />
          <SummaryCard
            label="EMI Collections"
            amount={emiTotal}
            colorCls="bg-indigo-50 border-indigo-100 text-indigo-900"
          />
          <SummaryCard
            label="General Collections"
            amount={generalTotal}
            colorCls="bg-sky-50 border-sky-100 text-sky-900"
          />
          {showSavings && (
            <SummaryCard
              label="Savings (Legacy)"
              amount={savingsLegacy}
              colorCls="bg-emerald-50 border-emerald-100 text-emerald-900"
            />
          )}
        </div>

        {/* ── Verification note ─────────────────────────────────────────── */}
        {Math.abs(totalAmount - emiTotal - generalTotal - savingsLegacy) > 1 && (
          <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
            ⚠️ Note: Some records may have mixed types. Total includes all amounts.
          </div>
        )}

        {/* ── Search bar ────────────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => resetPage(() => setSearch(sanitizeSearch(e.target.value)))}
            placeholder="Search by customer name, ID, or receipt number…"
            maxLength={100}
            className="pl-10 h-11 rounded-xl border-slate-200 text-sm"
          />
          {search && (
            <button
              onClick={() => resetPage(() => setSearch(""))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Filter chips ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Type filter */}
          <div className="flex gap-1 flex-wrap">
            {([
              ["ALL",      "All Types"],
              ["LOAN_EMI", "EMI"],
              ["GENERAL",  "General"],
              ...(showSavings ? [["SAVINGS", "Savings"], ["BOTH", "S+EMI"]] as const : []),
            ] as [CollectionTypeFilter, string][]).map(([t, lbl]) => (
              <button
                key={t}
                onClick={() => resetPage(() => setTypeFilter(t))}
                className={`h-9 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                  typeFilter === t
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-slate-200 hidden sm:block" />

          {/* Date filter */}
          <div className="flex gap-1 flex-wrap">
            {([
              ["ALL",   "All Time"],
              ["TODAY", "Today"],
              ["WEEK",  "Week"],
              ["MONTH", "Month"],
            ] as [DateRangeFilter, string][]).map(([d, lbl]) => (
              <button
                key={d}
                onClick={() => resetPage(() => setDateFilter(d))}
                className={`h-9 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                  dateFilter === d
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Collector filter */}
          {agents.length > 0 && (
            <CollectorFilter
              agents={agents}
              value={agentFilter}
              onChange={(v) => resetPage(() => setAgentFilter(v))}
            />
          )}

          {/* Clear all filters */}
          {activeFilters > 0 && (
            <button
              onClick={() => {
                setTypeFilter("ALL");
                setDateFilter("ALL");
                setAgentFilter("");
                setSearch("");
                setPage(1);
              }}
              className="h-9 px-3 rounded-xl text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors flex items-center gap-1.5"
            >
              <X className="w-3 h-3" />
              Clear ({activeFilters})
            </button>
          )}
        </div>

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {filtered.length === 0 && (
          <div className="text-center py-16 px-4">
            <IndianRupee className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-semibold">No collections found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        )}

        {/* ── Mobile cards (< md) ───────────────────────────────────────── */}
        {filtered.length > 0 && (
          <>
            <div className="block md:hidden space-y-3">
              {paginated.map((col) => (
                <TransactionCard key={col.id} col={col} members={members} />
              ))}
            </div>

            {/* ── Desktop table (md+) ────────────────────────────────────── */}
            <div className="hidden md:block">
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-[160px]" />
                      <col />
                      <col className="w-[100px]" />
                      <col className="w-[180px]" />
                      <col className="w-[110px]" />
                      <col className="w-[140px]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Receipt No.</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Collected By</th>
                        <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date &amp; Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginated.map((col) => {
                        const cust   = members.find((m) => m.id === col.customerId || (m as any).clerkUserId === col.customerId);
                        const d      = toDate((col as any).collectedAt || (col as any).timestamp);
                        const colType = (col as any).collectionType;
                        return (
                          <tr key={col.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-slate-500 truncate block">
                                {(col as any).receiptNo || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-900 text-sm truncate block">
                                {memberName(cust, col.customerId?.slice(-8) || "—")}
                              </span>
                              {cust && (
                                <span className="text-[11px] text-slate-400 font-mono truncate block">
                                  {col.customerId?.slice(-8)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <TypeBadge type={colType} />
                            </td>
                            <td className="px-4 py-3">
                              <CollectorCell col={col} members={members} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-bold text-emerald-600 text-sm">
                                {inr(getCollectionAmount(col))}
                              </span>
                              {colType === "BOTH" && (
                                <span className="block text-[10px] text-slate-400">
                                  S:{inr(getSavingsAmount(col))} + E:{inr(getEmiAmount(col))}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-slate-500 text-sm whitespace-nowrap">
                                {d.getTime() > 0 ? format(d, "dd MMM, h:mm a") : "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* ── Load more ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-600">{paginated.length}</span> of{" "}
                <span className="font-semibold text-slate-600">{filtered.length}</span> records
              </p>
              {hasMore && (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  Load {Math.min(PAGE_SIZE, filtered.length - paginated.length)} more
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
