/**
 * FundCircle — PhonePe Payment Gateway Service
 * Server-side only. Never import this from frontend code.
 *
 * Architecture:
 * - Credentials are AES-256-CBC encrypted before storing in Firestore
 * - All PhonePe API calls happen here; frontend never sees merchant secrets
 * - Supports both Sandbox and Production environments per organization
 */

import crypto from "crypto";

// ─── Encryption ───────────────────────────────────────────────────────────────
const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

/**
 * Derive a stable 32-byte AES key from SESSION_SECRET.
 * Falls back gracefully for environments without the secret.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    "fc-pg-fallback-key-replace-in-production";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptField(text: string): string {
  if (!text) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptField(encrypted: string): string {
  if (!encrypted) return "";
  const parts = encrypted.split(":");
  if (parts.length !== 2) throw new Error("Invalid encrypted data format");
  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(parts[1], "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ─── PhonePe API base URLs ────────────────────────────────────────────────────
const SANDBOX_BASE = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const PROD_BASE    = "https://api.phonepe.com/apis/hermes";

export function getPhonePeBase(environment: string): string {
  return environment === "production" ? PROD_BASE : SANDBOX_BASE;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PhonePeConfig {
  merchantId:    string;
  clientId:      string;
  clientSecret:  string;
  saltKey:       string;
  saltIndex:     string;
  webhookSecret: string;
  environment:   "sandbox" | "production";
}

export interface CreateOrderParams {
  merchantTransactionId: string;
  amountRupees:          number; // in rupees (will be converted to paise)
  customerMobile?:       string;
  note:                  string;
  callbackUrl:           string;
  redirectUrl:           string;
}

export interface CreateOrderResult {
  success:               boolean;
  merchantTransactionId: string;
  intentUrl?:            string; // UPI deep link — encode into QR on frontend
  errorCode?:            string;
  errorMessage?:         string;
  rawCode?:              string; // PhonePe response code for debugging
}

export interface CheckStatusResult {
  success:        boolean;
  state:          "PENDING" | "COMPLETED" | "FAILED" | "UNKNOWN";
  transactionId?: string; // PhonePe's transaction ID
  utr?:           string; // Bank UTR / reference
  amountRupees?:  number;
  errorCode?:     string;
  errorMessage?:  string;
}

// ─── Create payment order (UPI_QR) ───────────────────────────────────────────
export async function createPhonePeOrder(
  config: PhonePeConfig,
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  const base     = getPhonePeBase(config.environment);
  const endpoint = "/pg/v1/pay";

  const payload = {
    merchantId:            config.merchantId,
    merchantTransactionId: params.merchantTransactionId,
    merchantUserId:        `MUID_${params.merchantTransactionId.slice(-10)}`,
    amount:                Math.round(params.amountRupees * 100), // paise
    redirectUrl:           params.redirectUrl,
    redirectMode:          "GET",
    callbackUrl:           params.callbackUrl,
    ...(params.customerMobile ? { mobileNumber: params.customerMobile } : {}),
    paymentInstrument: { type: "UPI_QR" },
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signatureData  = base64Payload + endpoint + config.saltKey;
  const checksum       = crypto.createHash("sha256").update(signatureData).digest("hex");
  const xVerify        = `${checksum}###${config.saltIndex}`;

  console.log(`[PhonePe] Creating order ${params.merchantTransactionId} — env:${config.environment} amount:₹${params.amountRupees}`);

  let rawText = "";
  try {
    const resp = await fetch(`${base}${endpoint}`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY":     xVerify,
      },
      body: JSON.stringify({ request: base64Payload }),
    });
    rawText = await resp.text();
  } catch (netErr: any) {
    console.error("[PhonePe] Network error:", netErr.message);
    return {
      success:               false,
      merchantTransactionId: params.merchantTransactionId,
      errorCode:             "NETWORK_ERROR",
      errorMessage:          netErr.message,
    };
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    return {
      success:               false,
      merchantTransactionId: params.merchantTransactionId,
      errorCode:             "PARSE_ERROR",
      errorMessage:          `PhonePe returned non-JSON: ${rawText.slice(0, 200)}`,
    };
  }

  if (!data.success) {
    console.warn("[PhonePe] Order creation failed:", data.code, data.message);
    return {
      success:               false,
      merchantTransactionId: params.merchantTransactionId,
      errorCode:             data.code || "UNKNOWN_ERROR",
      errorMessage:          data.message || "PhonePe order creation failed",
      rawCode:               data.code,
    };
  }

  const instr     = data.data?.instrumentResponse || {};
  // PhonePe may return intentUrl or qrData depending on API version
  const intentUrl = instr.intentUrl || instr.qrData || instr.qr || null;

  console.log(`[PhonePe] ✓ Order created — intentUrl: ${intentUrl ? "present" : "missing"}`);

  return {
    success:               true,
    merchantTransactionId: params.merchantTransactionId,
    intentUrl:             intentUrl ?? undefined,
    rawCode:               data.code,
  };
}

// ─── Check payment status ─────────────────────────────────────────────────────
export async function checkPhonePeStatus(
  config: PhonePeConfig,
  merchantTransactionId: string,
): Promise<CheckStatusResult> {
  const base     = getPhonePeBase(config.environment);
  const endpoint = `/pg/v1/status/${config.merchantId}/${merchantTransactionId}`;

  const checksum = crypto
    .createHash("sha256")
    .update(endpoint + config.saltKey)
    .digest("hex");
  const xVerify = `${checksum}###${config.saltIndex}`;

  let data: any;
  try {
    const resp = await fetch(`${base}${endpoint}`, {
      method:  "GET",
      headers: {
        "Content-Type":  "application/json",
        "X-VERIFY":      xVerify,
        "X-MERCHANT-ID": config.merchantId,
      },
    });
    data = await resp.json();
  } catch (err: any) {
    return { success: false, state: "UNKNOWN", errorCode: "NETWORK_ERROR", errorMessage: err.message };
  }

  const code          = data.code || "";
  const state         = data.data?.state || "";
  const responseCode  = data.data?.responseCode || "";

  let normalized: "PENDING" | "COMPLETED" | "FAILED" | "UNKNOWN";
  if (
    state === "COMPLETED" ||
    responseCode === "SUCCESS" ||
    code === "PAYMENT_SUCCESS"
  ) {
    normalized = "COMPLETED";
  } else if (state === "FAILED" || code === "PAYMENT_ERROR" || code === "PAYMENT_DECLINED" || code === "TIMED_OUT") {
    normalized = "FAILED";
  } else if (state === "PENDING" || code === "PAYMENT_PENDING" || code === "PAYMENT_INITIATED") {
    normalized = "PENDING";
  } else {
    normalized = "PENDING"; // default to pending if uncertain
  }

  return {
    success:        normalized === "COMPLETED",
    state:          normalized,
    transactionId:  data.data?.transactionId,
    utr:            data.data?.paymentInstrument?.utr,
    amountRupees:   data.data?.amount ? data.data.amount / 100 : undefined,
    errorCode:      normalized !== "COMPLETED" ? code : undefined,
    errorMessage:   normalized !== "COMPLETED" ? data.message : undefined,
  };
}

// ─── Webhook signature verification ──────────────────────────────────────────
export function verifyPhonePeWebhook(
  base64Payload: string,
  xVerifyHeader: string,
  saltKey:       string,
  saltIndex:     string,
): boolean {
  if (!base64Payload || !xVerifyHeader) return false;
  const parts = xVerifyHeader.split("###");
  if (parts.length !== 2) return false;
  if (parts[1] !== saltIndex) return false;

  const expected = crypto
    .createHash("sha256")
    .update(base64Payload + saltKey)
    .digest("hex");

  return parts[0] === expected;
}

// ─── Merchant transaction ID generator ───────────────────────────────────────
export function generateMerchantTransactionId(orgId: string): string {
  const orgPart   = orgId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const ts        = Date.now().toString(36).toUpperCase();
  const rand      = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `FC-${orgPart}-${ts}-${rand}`;
}
