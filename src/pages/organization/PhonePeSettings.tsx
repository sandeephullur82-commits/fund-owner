/**
 * PhonePe Payment Gateway Settings
 * Owner-only UI for configuring multi-tenant PhonePe credentials.
 * Credentials are NEVER returned to the frontend — only config status.
 */
import React, { useState, useEffect, useRef } from "react";
import { useOrganization, useAuth } from "@clerk/clerk-react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDocumentRealtime } from "@/lib/firestore-hooks";
import { toast } from "sonner";
import {
  Shield, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2,
  Trash2, RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  Lock, Zap, Globe,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import FieldError from "@/components/ui/FieldError";

const API_BASE = import.meta.env.DEV
  ? "http://localhost:3002"
  : "";

interface PhonePeStatusDoc {
  phonePeConfigured: boolean;
  phonePeEnvironment: "sandbox" | "production";
  phonePeMerchantIdHint: string; // masked, e.g. "MERC****"
}

type SaveState = "idle" | "saving" | "saved" | "error";
type ValidateState = "idle" | "validating" | "success" | "error";

// ─── Password field with show/hide ───────────────────────────────────────────
function SecretInput({
  id, label, value, onChange, placeholder, error, disabled = false, hint,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  error?: string; disabled?: boolean; hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-slate-700 font-medium text-sm flex items-center gap-1.5">
        <Lock className="h-3 w-3 text-slate-400" />{label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`rounded-xl h-11 pr-10 font-mono text-sm ${error ? "border-red-400" : ""}`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={show ? "Hide" : "Show"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <FieldError error={error} />}
      {hint && !error && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PhonePeSettings() {
  const { organization } = useOrganization();
  const { getToken } = useAuth();

  const { data: orgDoc, loading: orgLoading } = useDocumentRealtime<any>(
    "organizations",
    organization?.id || null,
  );

  const isConfigured      = orgDoc?.phonePeConfigured === true;
  const currentEnv        = (orgDoc?.phonePeEnvironment || "sandbox") as "sandbox" | "production";
  const merchantIdHint    = orgDoc?.phonePeMerchantIdHint || "";

  // ── Form state ──────────────────────────────────────────────────────────────
  const [expanded,       setExpanded]       = useState(false);
  const [merchantId,     setMerchantId]     = useState("");
  const [clientId,       setClientId]       = useState("");
  const [clientSecret,   setClientSecret]   = useState("");
  const [saltKey,        setSaltKey]        = useState("");
  const [saltIndex,      setSaltIndex]      = useState("1");
  const [webhookSecret,  setWebhookSecret]  = useState("");
  const [environment,    setEnvironment]    = useState<"sandbox" | "production">("sandbox");
  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const [saveState,      setSaveState]      = useState<SaveState>("idle");
  const [validateState,  setValidateState]  = useState<ValidateState>("idle");
  const [validateMsg,    setValidateMsg]    = useState("");
  const [deleting,       setDeleting]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  // Auto-expand when first configuring
  useEffect(() => {
    if (!orgLoading && !isConfigured) setExpanded(true);
  }, [orgLoading, isConfigured]);

  // Sync environment toggle with stored value when expanding
  useEffect(() => {
    if (expanded) setEnvironment(currentEnv);
  }, [expanded, currentEnv]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!merchantId.trim())   errs.merchantId   = "Merchant ID is required.";
    if (!clientId.trim())     errs.clientId     = "Client ID is required.";
    if (!clientSecret.trim()) errs.clientSecret = "Client Secret is required.";
    if (!saltKey.trim())      errs.saltKey      = "Salt Key is required.";
    if (!saltIndex.trim())    errs.saltIndex    = "Salt Index is required.";
    if (!webhookSecret.trim()) errs.webhookSecret = "Webhook Secret is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!organization?.id) return;
    const token = await getToken();
    setSaveState("saving");
    try {
      const res = await fetch(`${API_BASE}/api/phonepe/save-config`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          organizationId: organization.id,
          merchantId:     merchantId.trim(),
          clientId:       clientId.trim(),
          clientSecret:   clientSecret.trim(),
          saltKey:        saltKey.trim(),
          saltIndex:      saltIndex.trim(),
          webhookSecret:  webhookSecret.trim(),
          environment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      // Clear sensitive fields from state
      setClientSecret(""); setSaltKey(""); setWebhookSecret("");
      setSaveState("saved");
      toast.success("PhonePe credentials saved & encrypted.");
      setExpanded(false);
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (err: any) {
      setSaveState("error");
      toast.error(err.message || "Failed to save PhonePe config.");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const handleValidate = async () => {
    if (!organization?.id) return;
    const token = await getToken();
    setValidateState("validating");
    setValidateMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/phonepe/validate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ organizationId: organization.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setValidateState("error");
        setValidateMsg(data.message || data.error || "Connection failed.");
      } else {
        setValidateState("success");
        setValidateMsg(data.message || "Connection successful!");
      }
    } catch (err: any) {
      setValidateState("error");
      setValidateMsg(err.message || "Network error.");
    }
  };

  const handleDelete = async () => {
    if (!organization?.id) return;
    const token = await getToken();
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/phonepe/delete-config`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ organizationId: organization.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("PhonePe integration removed.");
      setConfirmDelete(false);
      setExpanded(false);
      setMerchantId(""); setClientId(""); setClientSecret("");
      setSaltKey(""); setSaltIndex("1"); setWebhookSecret("");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove PhonePe config.");
    } finally {
      setDeleting(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 animate-pulse h-20" aria-hidden="true" />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Zap className="h-4.5 w-4.5 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">PhonePe Payment Gateway</p>
            <p className="text-[11px] text-slate-500">Accept UPI payments via PhonePe's official PG API</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConfigured ? (
            <span className={[
              "text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full",
              currentEnv === "production"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700",
            ].join(" ")}>
              {currentEnv === "production" ? "Live" : "Sandbox"}
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
              Not Set Up
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Configured status bar ── */}
      {isConfigured && !expanded && (
        <div className="px-5 py-3 flex items-center gap-3 bg-slate-50 border-b border-slate-100">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-700 font-medium">
              Merchant ID: <span className="font-mono">{merchantIdHint}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleValidate}
              disabled={validateState === "validating"}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
            >
              {validateState === "validating"
                ? <><Loader2 className="h-3 w-3 animate-spin" />Testing…</>
                : <><RefreshCw className="h-3 w-3" />Test Connection</>}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {/* ── Validate result ── */}
      {(validateState === "success" || validateState === "error") && validateMsg && !expanded && (
        <div className={[
          "px-5 py-2 text-xs flex items-center gap-2 border-b border-slate-100",
          validateState === "success" ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50",
        ].join(" ")}>
          {validateState === "success"
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          {validateMsg}
        </div>
      )}

      {/* ── Expanded form ── */}
      {expanded && (
        <div className="px-5 py-5 space-y-5">
          {/* Info */}
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-3.5 space-y-1.5">
            <p className="text-xs font-semibold text-violet-800">Multi-Tenant Architecture</p>
            <p className="text-[11px] text-violet-700 leading-relaxed">
              Each organization uses its own PhonePe Merchant Account. FundCircle never touches your money —
              all payments go directly to your merchant account. Credentials are AES-256 encrypted on the server.
            </p>
            <a
              href="https://developer.phonepe.com/v1/reference/pay-api-1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:underline font-medium"
            >
              <ExternalLink className="h-3 w-3" />
              PhonePe Developer Docs
            </a>
          </div>

          {/* Environment */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium text-sm flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              Environment
            </Label>
            <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50 gap-1">
              {(["sandbox", "production"] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={[
                    "flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150",
                    environment === env
                      ? env === "production"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-amber-500 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  ].join(" ")}
                >
                  {env === "sandbox" ? "🧪 Sandbox (Test)" : "🚀 Production (Live)"}
                </button>
              ))}
            </div>
            {environment === "production" && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800">
                  <strong>Production mode</strong> — real money will be collected.
                  Verify all credentials before saving.
                </p>
              </div>
            )}
          </div>

          {/* Merchant ID */}
          <div className="grid gap-1.5">
            <Label htmlFor="pp-merchant-id" className="text-slate-700 font-medium text-sm">
              Merchant ID
            </Label>
            <Input
              id="pp-merchant-id"
              value={merchantId}
              onChange={(e) => { setMerchantId(e.target.value); setErrors((p) => ({ ...p, merchantId: "" })); }}
              placeholder={isConfigured ? merchantIdHint || "Enter new Merchant ID" : "e.g. MERCHANTUAT"}
              className={`rounded-xl h-11 font-mono text-sm ${errors.merchantId ? "border-red-400" : ""}`}
            />
            {errors.merchantId && <FieldError error={errors.merchantId} />}
            <p className="text-[11px] text-slate-400">Found in your PhonePe Business Dashboard → API Keys</p>
          </div>

          {/* Client ID */}
          <div className="grid gap-1.5">
            <Label htmlFor="pp-client-id" className="text-slate-700 font-medium text-sm">
              Client ID
            </Label>
            <Input
              id="pp-client-id"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setErrors((p) => ({ ...p, clientId: "" })); }}
              placeholder={isConfigured ? "•••••• (leave blank to keep current)" : "e.g. CLIENT_ID_12345"}
              className={`rounded-xl h-11 font-mono text-sm ${errors.clientId ? "border-red-400" : ""}`}
            />
            {errors.clientId && <FieldError error={errors.clientId} />}
          </div>

          {/* Client Secret */}
          <SecretInput
            id="pp-client-secret"
            label="Client Secret"
            value={clientSecret}
            onChange={(v) => { setClientSecret(v); setErrors((p) => ({ ...p, clientSecret: "" })); }}
            placeholder={isConfigured ? "•••••• (leave blank to keep current)" : "Your client secret"}
            error={errors.clientSecret}
            hint="Encrypted before storage — never exposed to client"
          />

          {/* Salt Key */}
          <SecretInput
            id="pp-salt-key"
            label="Salt Key"
            value={saltKey}
            onChange={(v) => { setSaltKey(v); setErrors((p) => ({ ...p, saltKey: "" })); }}
            placeholder={isConfigured ? "•••••• (leave blank to keep current)" : "Your salt key"}
            error={errors.saltKey}
            hint="Used for HMAC-SHA256 signature verification"
          />

          {/* Salt Index */}
          <div className="grid gap-1.5">
            <Label htmlFor="pp-salt-index" className="text-slate-700 font-medium text-sm">
              Salt Index
            </Label>
            <Input
              id="pp-salt-index"
              value={saltIndex}
              onChange={(e) => { setSaltIndex(e.target.value.replace(/\D/g, "")); setErrors((p) => ({ ...p, saltIndex: "" })); }}
              placeholder="1"
              maxLength={2}
              className={`rounded-xl h-11 w-24 font-mono text-sm ${errors.saltIndex ? "border-red-400" : ""}`}
            />
            {errors.saltIndex && <FieldError error={errors.saltIndex} />}
            <p className="text-[11px] text-slate-400">Usually "1" — check your PhonePe dashboard</p>
          </div>

          {/* Webhook Secret */}
          <SecretInput
            id="pp-webhook-secret"
            label="Webhook Secret"
            value={webhookSecret}
            onChange={(v) => { setWebhookSecret(v); setErrors((p) => ({ ...p, webhookSecret: "" })); }}
            placeholder={isConfigured ? "•••••• (leave blank to keep current)" : "Your webhook verification secret"}
            error={errors.webhookSecret}
            hint={`Configure PhonePe to send webhooks to: ${window.location.origin}/api/phonepe/webhook`}
          />

          {/* ── Action buttons ── */}
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving"}
              className={[
                "h-10 px-5 text-sm font-semibold rounded-xl gap-2",
                saveState === "saved"
                  ? "bg-emerald-500 text-white"
                  : saveState === "error"
                  ? "bg-red-500 text-white"
                  : "bg-violet-600 hover:bg-violet-700 text-white",
              ].join(" ")}
            >
              {saveState === "saving"
                ? <><Loader2 className="h-4 w-4 animate-spin" />Encrypting & Saving…</>
                : saveState === "saved"
                ? <><CheckCircle2 className="h-4 w-4" />Saved!</>
                : saveState === "error"
                ? <><AlertTriangle className="h-4 w-4" />Save Failed</>
                : <><Shield className="h-4 w-4" />Save Encrypted Config</>}
            </Button>

            {isConfigured && (
              <Button
                type="button"
                variant="outline"
                onClick={handleValidate}
                disabled={validateState === "validating"}
                className="h-10 px-4 text-sm rounded-xl gap-2"
              >
                {validateState === "validating"
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Testing…</>
                  : <><RefreshCw className="h-4 w-4" />Validate Connection</>}
              </Button>
            )}

            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          {/* Validate result */}
          {(validateState === "success" || validateState === "error") && validateMsg && (
            <div className={[
              "rounded-xl px-4 py-3 flex items-start gap-2 text-xs",
              validateState === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200",
            ].join(" ")}>
              {validateState === "success"
                ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{validateMsg}</span>
            </div>
          )}

          {/* ── Delete section ── */}
          {isConfigured && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1.5 font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove PhonePe Integration
                </button>
              ) : (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 space-y-3">
                  <p className="text-xs font-semibold text-red-800">Remove PhonePe Integration?</p>
                  <p className="text-[11px] text-red-700 leading-relaxed">
                    This will delete all stored PhonePe credentials for this organization.
                    Pending payments will not be affected.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="h-8 px-4 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg gap-1.5"
                    >
                      {deleting ? <><Loader2 className="h-3 w-3 animate-spin" />Removing…</> : <><Trash2 className="h-3 w-3" />Yes, Remove</>}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                      className="h-8 px-4 text-xs rounded-lg"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
