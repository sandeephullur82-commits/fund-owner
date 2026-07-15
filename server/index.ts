import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { createClerkClient, verifyToken } from "@clerk/backend";
import {
  encryptField, decryptField,
  createPhonePeOrder, checkPhonePeStatus, verifyPhonePeWebhook,
  generateMerchantTransactionId,
} from "./phonepe";

// ─── Process-level crash guards ───────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[FC API] uncaughtException — server staying alive:", err?.message ?? err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FC API] unhandledRejection — server staying alive:", reason);
});

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50kb" }));

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// ─── Base URL helper ──────────────────────────────────────────────────────────
const getBaseUrl = () => {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const localPort = process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 5000;
  return `http://localhost:${localPort}`;
};

// ─── Password generator ───────────────────────────────────────────────────────
function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#$!%^&*";

  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];

  const parts = [
    pick(upper), pick(upper),
    pick(lower), pick(lower), pick(lower),
    pick(digits), pick(digits),
    pick(special),
    pick(upper), pick(lower),
  ];

  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }

  return parts.join("");
}

// ─── Firestore REST helpers ───────────────────────────────────────────────────
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "fundcircle-66b66";
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY;
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const sv  = (v: string)  => ({ stringValue:  v ?? "" });
const iv  = (v: number)  => ({ integerValue: String(Math.round(v ?? 0)) });
const bv  = (v: boolean) => ({ booleanValue: !!v });
const tv  = (d?: Date)   => ({ timestampValue: (d ?? new Date()).toISOString() });

async function fsSet(col: string, docId: string, fields: Record<string, any>): Promise<void> {
  if (!FIREBASE_API_KEY) throw new Error("VITE_FIREBASE_API_KEY env var not set");
  const url = `${FS_BASE}/${col}/${docId}?key=${FIREBASE_API_KEY}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Firestore write failed [${col}/${docId}] HTTP ${resp.status}: ${txt.slice(0, 300)}`);
  }
}

async function fsAdd(col: string, fields: Record<string, any>): Promise<string> {
  if (!FIREBASE_API_KEY) throw new Error("VITE_FIREBASE_API_KEY env var not set");
  const url = `${FS_BASE}/${col}?key=${FIREBASE_API_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Firestore add failed [${col}] HTTP ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const data: any = await resp.json();
  return (data.name as string).split("/").pop()!;
}

// Partial update — only touches the listed fields (Firestore updateMask)
async function fsUpdate(col: string, docId: string, fields: Record<string, any>): Promise<void> {
  if (!FIREBASE_API_KEY) throw new Error("VITE_FIREBASE_API_KEY env var not set");
  const maskParams = Object.keys(fields)
    .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = `${FS_BASE}/${col}/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}&${maskParams}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Firestore update failed [${col}/${docId}] HTTP ${resp.status}: ${txt.slice(0, 300)}`);
  }
}

// Count active loans for a given customer
const ACTIVE_LOAN_STATUSES = new Set(["ACTIVE", "OVERDUE", "PARTIALLY_PAID"]);
async function fsCountActiveLoans(customerId: string, organizationId: string): Promise<number> {
  if (!FIREBASE_API_KEY) return 0;
  try {
    const url = `${FS_BASE}:runQuery?key=${FIREBASE_API_KEY}`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: "loans" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              { fieldFilter: { field: { fieldPath: "customerId" }, op: "EQUAL", value: sv(customerId) } },
              { fieldFilter: { field: { fieldPath: "organizationId" }, op: "EQUAL", value: sv(organizationId) } },
            ],
          },
        },
        limit: 50,
      },
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return 0;
    const docs: any[] = await resp.json();
    return docs.filter((d: any) => {
      if (!d.document?.fields) return false;
      const status = (d.document.fields.status?.stringValue || "").toUpperCase();
      return ACTIVE_LOAN_STATUSES.has(status);
    }).length;
  } catch { return 0; }
}

function membershipIdFor(orgId: string, userId: string): string {
  return `${orgId}_${userId}`;
}

function generateAccountNumber(): string {
  const n = Math.floor(Math.random() * 9000000000) + 1000000000;
  return `FC${n}`;
}

async function generateEmployeeCode(orgId: string, orgName: string): Promise<string> {
  const prefix = (orgName || "ORG")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(3, "X");

  let seq = 1;
  if (FIREBASE_API_KEY) {
    const counterUrl = `${FS_BASE}/orgCounters/${encodeURIComponent(orgId)}?key=${FIREBASE_API_KEY}`;
    try {
      const resp = await fetch(counterUrl);
      if (resp.ok) {
        const data: any = await resp.json();
        const current = parseInt(data.fields?.agentCodeSeq?.integerValue ?? "0", 10);
        if (!isNaN(current)) seq = current + 1;
      }
    } catch (_) {}

    try {
      await fsSet("orgCounters", orgId, {
        agentCodeSeq:   iv(seq),
        organizationId: sv(orgId),
        updatedAt:      tv(),
      });
    } catch (_) {}
  }

  return `${prefix}-EMP${String(seq).padStart(4, "0")}`;
}

// ─── Server-side input validators ────────────────────────────────────────────
const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
const ALLOWED_CUSTOMER_TYPES = new Set(["SAVINGS", "LOAN", "SAVINGS_LOAN"]);
const ALLOWED_NOMINEE_RELS   = new Set([
  "Father","Mother","Spouse","Brother","Sister",
  "Son","Daughter","Sibling","Guardian","Other",
]);

function srvValidEmail(email: string): boolean {
  return EMAIL_RE.test((email ?? "").trim());
}
function srvValidPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, "");
  return (d.length === 10 && /^[6-9]/.test(d))
      || (d.length === 12 && /^91[6-9]/.test(d))
      || (d.length === 11 && /^0[6-9]/.test(d));
}
function srvValidName(name: string, min = 2, max = 100): boolean {
  const t = (name ?? "").trim();
  return t.length >= min && t.length <= max;
}
/** Sanitize a string: trim, strip HTML tags and injection chars, cap length. */
function srvSanitize(s: string, maxLen = 500): string {
  if (!s) return "";
  return s.trim()
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"\/\\;{}]/g, "")
    .substring(0, maxLen);
}

/**
 * Verify the calling user (from Clerk JWT) is an OWNER or MANAGER of the org.
 * Falls back to `true` when the API key is unavailable (dev mode).
 */
async function verifyIsOrgAdmin(callerClerkId: string, orgId: string): Promise<boolean> {
  if (!FIREBASE_API_KEY) return true;
  const memberDocId = `${orgId}_${callerClerkId}`;
  const url = `${FS_BASE}/organizationMembers/${encodeURIComponent(memberDocId)}?key=${FIREBASE_API_KEY}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return false;
    const data: any = await resp.json();
    const role = (data.fields?.role?.stringValue || "").toUpperCase();
    return role === "OWNER" || role === "ORGANIZATION_OWNER" || role === "MANAGER";
  } catch { return false; }
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    (req as any).clerkUserId = payload.sub;
    (req as any).clerkPayload = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── Create Agent (direct creation, no invitation) ───────────────────────────
app.post("/api/create-agent", authMiddleware, async (req, res) => {
  const {
    firstName, lastName, email, phone,
    organizationId, organizationName,
    createdBy, actorName,
    address, notes,
    employeeCode: requestedEmployeeCode,
  } = req.body as {
    firstName: string; lastName: string; email: string;
    phone?: string; organizationId: string; organizationName?: string;
    createdBy?: string; actorName?: string;
    address?: string; notes?: string;
    employeeCode?: string;
  };

  // STEP 2 — API Received
  console.log("[FC CreateAgent] STEP 2 — API Received");
  console.log("[FC CreateAgent]   Org ID      :", organizationId ?? "MISSING");
  console.log("[FC CreateAgent]   createdBy   :", createdBy ?? "MISSING");
  console.log("[FC CreateAgent]   email       :", email ?? "MISSING");
  console.log("[FC CreateAgent]   empCode hint:", requestedEmployeeCode || "(auto-generate)");

  if (!firstName || !email || !organizationId) {
    console.warn("[FC CreateAgent] ✗ Missing required fields");
    return res.status(400).json({ error: "firstName, email, and organizationId are required." });
  }

  // ── Server-side validation ──────────────────────────────────────────────────
  const agentValidErrors: Record<string, string> = {};
  if (!srvValidName(firstName, 2, 50))  agentValidErrors.firstName = "First name must be 2–50 characters.";
  if (lastName && !srvValidName(lastName, 1, 50)) agentValidErrors.lastName = "Last name is too long (max 50 chars).";
  if (!srvValidEmail(email))            agentValidErrors.email     = "A valid email address is required.";
  if (phone && !srvValidPhone(phone))   agentValidErrors.phone     = "Phone must be a valid 10-digit number.";
  if (Object.keys(agentValidErrors).length) {
    console.warn("[FC CreateAgent] ✗ Validation failed:", agentValidErrors);
    return res.status(400).json({ error: "Validation failed.", errors: agentValidErrors });
  }

  // ── Authorization: caller must be org owner/manager ─────────────────────────
  const callerClerkId = (req as any).clerkUserId as string | undefined;
  if (callerClerkId) {
    const isAdmin = await verifyIsOrgAdmin(callerClerkId, organizationId);
    if (!isAdmin) {
      console.warn("[FC CreateAgent] ✗ Forbidden — caller is not an owner/admin of org:", organizationId);
      return res.status(403).json({ error: "Only organization owners or managers can create agents." });
    }
  }

  // ── Sanitize all string inputs before use ────────────────────────────────────
  const emailKey = email.trim().toLowerCase();
  const sanitizedFirst = srvSanitize(firstName, 50);
  const sanitizedLast  = srvSanitize(lastName || "", 50);
  const generatedPassword = generatePassword();
  const fullName = `${sanitizedFirst} ${sanitizedLast}`.trim();

  let userId: string;
  let isNewUser = false;

  // STEP 3 — Clerk User Creation
  console.log("[FC CreateAgent] STEP 3 — Clerk User Creation");
  try {
    const existing = await clerkClient.users.getUserList({ emailAddress: [emailKey] });

    if (existing.data.length > 0) {
      userId = existing.data[0].id;
      console.log("[FC CreateAgent] STEP 3 — Existing Clerk user found:", userId);
      await clerkClient.users.updateUser(userId, { password: generatedPassword });
      console.log("[FC CreateAgent] STEP 3 — ✓ Password updated for existing user");
    } else {
      const created = await clerkClient.users.createUser({
        emailAddress: [emailKey],
        firstName: sanitizedFirst,
        lastName:  sanitizedLast,
        password: generatedPassword,
        skipPasswordChecks: false,
      });
      userId = created.id;
      isNewUser = true;
      console.log("[FC CreateAgent] STEP 3 — ✓ Clerk user created:", userId);
    }
  } catch (err: any) {
    const msg = err?.errors?.[0]?.longMessage || err?.message || "Failed to create Clerk user";
    console.error("[FC CreateAgent] STEP 3 — ✗ Clerk user creation failed:", msg);
    return res.status(500).json({ error: `Clerk User Creation Failed: ${msg}` });
  }

  // STEP 4 — Organization Membership
  console.log("[FC CreateAgent] STEP 4 — Organization Membership. userId:", userId, "orgId:", organizationId);
  try {
    const list = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId, limit: 500,
    });
    const alreadyMember = list.data.some((m: any) => m.publicUserData?.userId === userId);
    if (!alreadyMember) {
      await clerkClient.organizations.createOrganizationMembership({
        organizationId, userId, role: "org:member",
      });
      console.log("[FC CreateAgent] STEP 4 — ✓ Clerk membership created");
    } else {
      console.log("[FC CreateAgent] STEP 4 — User already a member — skipping");
    }
  } catch (err: any) {
    const msg = err?.errors?.[0]?.longMessage || err?.message || "Failed to add to organization";
    console.error("[FC CreateAgent] STEP 4 — ✗ Clerk membership failed:", msg);
    if (isNewUser) {
      try { await clerkClient.users.deleteUser(userId); console.log("[FC CreateAgent] STEP 4 — ↩ Clerk user rolled back"); }
      catch (rb: any) { console.error("[FC CreateAgent] STEP 4 — ✗ Rollback failed:", rb?.message); }
    }
    return res.status(500).json({ error: `Organization Membership Failed: ${msg}` });
  }

  // Employee code: use the one provided by the frontend (if any), else auto-generate
  const membershipDocId = membershipIdFor(organizationId, userId);
  const now = new Date();

  let employeeCode: string;
  if (requestedEmployeeCode && requestedEmployeeCode.trim().length > 0) {
    employeeCode = requestedEmployeeCode.trim().toUpperCase();
    console.log("[FC CreateAgent]   Using requested employee code:", employeeCode);
  } else {
    try {
      employeeCode = await generateEmployeeCode(organizationId, organizationName || "");
      console.log("[FC CreateAgent]   ✓ Employee code auto-generated:", employeeCode);
    } catch (codeErr: any) {
      console.error("[FC CreateAgent]   ✗ Employee code generation failed:", codeErr.message);
      employeeCode = `EMP-${userId.slice(-6).toUpperCase()}`;
    }
  }

  // STEP 5 — Firestore Agent Created
  console.log("[FC CreateAgent] STEP 5 — Firestore Agent Creation. membershipDocId:", membershipDocId);
  try {
    const membershipFields: Record<string, any> = {
      id:               sv(membershipDocId),
      clerkUserId:      sv(userId),
      email:            sv(emailKey),
      fullName:         sv(fullName),
      name:             sv(fullName),
      firstName:        sv(sanitizedFirst),
      lastName:         sv(sanitizedLast),
      role:             sv("AGENT"),
      clerkRole:        sv("org:pigmy_collector"),
      organizationId:   sv(organizationId),
      organizationName: sv(srvSanitize(organizationName || "", 100)),
      phone:            sv(phone ? phone.replace(/\D/g, "").slice(0, 10) : ""),
      address:          sv(srvSanitize(address || "", 500)),
      notes:            sv(srvSanitize(notes || "", 500)),
      assignedArea:     sv(""),
      employeeCode:     sv(employeeCode),
      profileCompleted: bv(false),
      status:           sv("ACTIVE"),
      createdBy:        sv(createdBy || ""),
      createdAt:        tv(now),
      updatedAt:        tv(now),
    };

    // 5a. organizationMembers (primary lookup collection)
    await fsSet("organizationMembers", membershipDocId, membershipFields);
    console.log("[FC CreateAgent] STEP 5a — ✓ organizationMembers written");

    // 5b. agents (flat collection — legacy + cross-org queries)
    const agentFields: Record<string, any> = {
      id:               sv(membershipDocId),
      clerkUserId:      sv(userId),
      organizationId:   sv(organizationId),
      firstName:        sv(firstName.trim()),
      lastName:         sv((lastName || "").trim()),
      fullName:         sv(fullName),
      email:            sv(emailKey),
      phone:            sv(phone || ""),
      address:          sv(address || ""),
      employeeCode:     sv(employeeCode),
      role:             sv("agent"),
      status:           sv("active"),
      assignedCustomers: iv(0),
      createdAt:        tv(now),
      updatedAt:        tv(now),
    };
    await fsSet("agents", membershipDocId, agentFields);
    console.log("[FC CreateAgent] STEP 5b — ✓ agents (flat) written");

    // 5c. organizations/{orgId}/agents/{agentId} subcollection
    await fsSet(`organizations/${organizationId}/agents`, membershipDocId, agentFields);
    console.log("[FC CreateAgent] STEP 5c — ✓ organizations subcollection agents written");

    // 5d. users
    await fsSet("users", userId, {
      clerkUserId:      sv(userId),
      id:               sv(userId),
      email:            sv(emailKey),
      name:             sv(fullName),
      firstName:        sv(firstName.trim()),
      lastName:         sv((lastName || "").trim()),
      status:           sv("ACTIVE"),
      profileCompleted: bv(false),
      createdAt:        tv(now),
      updatedAt:        tv(now),
    });
    console.log("[FC CreateAgent] STEP 5d — ✓ users written");

    // 5e. audit_logs
    await fsAdd("audit_logs", {
      organizationId: sv(organizationId),
      actorId:        sv(createdBy || ""),
      actorRole:      sv("OWNER"),
      actorName:      sv(actorName || ""),
      action:         sv("AGENT_CREATED"),
      entityType:     sv("Agent"),
      entityId:       sv(membershipDocId),
      metadata: {
        mapValue: {
          fields: {
            email:        sv(emailKey),
            fullName:     sv(fullName),
            role:         sv("AGENT"),
            employeeCode: sv(employeeCode),
          },
        },
      },
      createdAt: tv(now),
    });
    console.log("[FC CreateAgent] STEP 5e — ✓ audit_logs written");

  } catch (fsErr: any) {
    console.error("[FC CreateAgent] STEP 5 — ✗ Firestore write failed:", fsErr.message);
    if (isNewUser) {
      console.log("[FC CreateAgent] STEP 5 — ↩ Rolling back Clerk user:", userId);
      try { await clerkClient.users.deleteUser(userId); console.log("[FC CreateAgent] ↩ Rollback complete"); }
      catch (rb: any) { console.error("[FC CreateAgent] ✗ Rollback failed:", rb?.message); }
    }
    return res.status(500).json({ error: `Firestore Write Failed: ${fsErr.message}` });
  }

  // STEP 6 — Success
  console.log("[FC CreateAgent] STEP 6 — ✓ Agent fully created");
  console.log("[FC CreateAgent]   userId       :", userId);
  console.log("[FC CreateAgent]   membershipId :", membershipDocId);
  console.log("[FC CreateAgent]   employeeCode :", employeeCode);
  return res.json({ userId, email: emailKey, generatedPassword, membershipDocId, employeeCode, fullName });
});

// ─── Create Customer (direct creation, no invitation) ────────────────────────
app.post("/api/create-customer", authMiddleware, async (req, res) => {
  const {
    firstName, lastName, email, phone,
    organizationId, organizationName,
    createdBy, actorName,
    assignedAgentId, assignedAgentName, assignedCollectorRole,
    address, notes,
  } = req.body as {
    firstName: string; lastName: string; email: string;
    phone?: string; organizationId: string; organizationName?: string;
    createdBy?: string; actorName?: string;
    assignedAgentId?: string; assignedAgentName?: string; assignedCollectorRole?: string;
    address?: string; notes?: string;
  };

  console.log("[FC CreateCustomer] ▶ Request received");
  console.log("[FC CreateCustomer]   Org ID      :", organizationId ?? "MISSING");
  console.log("[FC CreateCustomer]   createdBy   :", createdBy ?? "MISSING");
  console.log("[FC CreateCustomer]   email       :", email ?? "MISSING");
  if (!firstName || !email || !organizationId) {
    console.warn("[FC CreateCustomer] ✗ Missing required fields");
    return res.status(400).json({ error: "firstName, email, and organizationId are required." });
  }

  // ── Server-side validation ──────────────────────────────────────────────────
  const custValidErrors: Record<string, string> = {};
  if (!srvValidName(firstName, 2, 50))  custValidErrors.firstName = "First name must be 2–50 characters.";
  if (lastName && !srvValidName(lastName, 1, 50)) custValidErrors.lastName = "Last name is too long (max 50 chars).";
  if (!srvValidEmail(email))            custValidErrors.email     = "A valid email address is required.";
  if (phone && !srvValidPhone(phone))   custValidErrors.phone     = "Phone must be a valid 10-digit number.";
  if (Object.keys(custValidErrors).length) {
    console.warn("[FC CreateCustomer] ✗ Validation failed:", custValidErrors);
    return res.status(400).json({ error: "Validation failed.", errors: custValidErrors });
  }

  // ── Authorization: caller must be org owner/manager ─────────────────────────
  const callerClerkIdCust = (req as any).clerkUserId as string | undefined;
  if (callerClerkIdCust) {
    const isAdmin = await verifyIsOrgAdmin(callerClerkIdCust, organizationId);
    if (!isAdmin) {
      console.warn("[FC CreateCustomer] ✗ Forbidden — caller is not an owner/admin of org:", organizationId);
      return res.status(403).json({ error: "Only organization owners or managers can create customers." });
    }
  }

  // ── Sanitize all string inputs before use ────────────────────────────────────
  const emailKey = email.trim().toLowerCase();
  const sanitizedFirstCust = srvSanitize(firstName, 50);
  const sanitizedLastCust  = srvSanitize(lastName || "", 50);
  const generatedPassword = generatePassword();
  const fullName = `${sanitizedFirstCust} ${sanitizedLastCust}`.trim();

  let userId: string;
  let isNewUser = false;

  // ── 1. Clerk user ────────────────────────────────────────────────────────
  try {
    const existing = await clerkClient.users.getUserList({ emailAddress: [emailKey] });

    if (existing.data.length > 0) {
      userId = existing.data[0].id;
      console.log("[FC CreateCustomer] Existing Clerk user found:", userId);
      await clerkClient.users.updateUser(userId, { password: generatedPassword });
    } else {
      const created = await clerkClient.users.createUser({
        emailAddress: [emailKey],
        firstName: sanitizedFirstCust,
        lastName:  sanitizedLastCust,
        password: generatedPassword,
        skipPasswordChecks: false,
      });
      userId = created.id;
      isNewUser = true;
      console.log("[FC CreateCustomer] ✓ Clerk user created:", userId);
    }
  } catch (err: any) {
    const msg = err?.errors?.[0]?.longMessage || err?.message || "Failed to create Clerk user";
    console.error("[FC CreateCustomer] ✗ Clerk user error:", msg);
    return res.status(500).json({ error: msg });
  }

  // ── 2. Clerk org membership ──────────────────────────────────────────────
  try {
    const list = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId, limit: 500,
    });
    const alreadyMember = list.data.some((m: any) => m.publicUserData?.userId === userId);
    if (!alreadyMember) {
      const customerRole = "org:member";
      console.log("[FC CreateCustomer] Assigning role:", customerRole, "to userId:", userId, "in org:", organizationId);
      await clerkClient.organizations.createOrganizationMembership({
        organizationId, userId, role: customerRole,
      });
      console.log("[FC CreateCustomer] ✓ Clerk membership created");
    } else {
      console.log("[FC CreateCustomer] User already a member of org — skipping membership");
    }
  } catch (err: any) {
    const msg = err?.errors?.[0]?.longMessage || err?.message || "Failed to add to organization";
    console.error("[FC CreateCustomer] ✗ Clerk membership error:", msg);
    if (isNewUser) {
      try { await clerkClient.users.deleteUser(userId); console.log("[FC CreateCustomer] ↩ Rolled back Clerk user:", userId); }
      catch (rb: any) { console.error("[FC CreateCustomer] ✗ Rollback failed:", rb?.message); }
    }
    return res.status(500).json({ error: msg });
  }

  // ── 3. Firestore documents ───────────────────────────────────────────────
  const membershipDocId = membershipIdFor(organizationId, userId);
  const accountNumber   = generateAccountNumber();
  const now = new Date();

  try {
    console.log("[FC CreateCustomer] Writing Firestore docs — membershipDocId:", membershipDocId);

    const membershipFields: Record<string, any> = {
      id:           sv(membershipDocId),
      clerkUserId:  sv(userId),
      email:        sv(emailKey),
      fullName:     sv(fullName),
      name:         sv(fullName),
      firstName:    sv(sanitizedFirstCust),
      lastName:     sv(sanitizedLastCust),
      role:         sv("CUSTOMER"),
      clerkRole:    sv("org:customer"),
      organizationId:   sv(organizationId),
      organizationName: sv(srvSanitize(organizationName || "", 100)),
      phone:        sv(phone ? phone.replace(/\D/g, "").slice(0, 10) : ""),
      address:      sv(srvSanitize(address || "", 500)),
      notes:        sv(srvSanitize(notes || "", 500)),
      assignedArea: sv(""),
      assignedAgentId:       sv(assignedAgentId || ""),
      assignedAgentName:     sv(assignedAgentName || ""),
      assignedCollectorRole: sv(assignedCollectorRole || ""),
      profileCompleted: bv(false),
      status:       sv("PENDING_SETUP"),
      createdBy:    sv(createdBy || ""),
      createdAt:    tv(now),
      updatedAt:    tv(now),
    };

    // 3a. organizationMembers
    await fsSet("organizationMembers", membershipDocId, membershipFields);
    console.log("[FC CreateCustomer] ✓ organizationMembers written");

    // 3b. customers (profile mirror with account number)
    await fsSet("customers", membershipDocId, {
      ...membershipFields,
      accountNumber:          sv(accountNumber),
      agentId:                sv(assignedAgentId || createdBy || ""),
      assigned_to_user_id:    sv(assignedAgentId || createdBy || ""),
    });
    console.log("[FC CreateCustomer] ✓ customers written — accountNumber:", accountNumber);

    // 3c. users
    await fsSet("users", userId, {
      clerkUserId: sv(userId),
      id:          sv(userId),
      email:       sv(emailKey),
      name:        sv(fullName),
      firstName:   sv(firstName.trim()),
      lastName:    sv((lastName || "").trim()),
      status:      sv("PENDING_SETUP"),
      profileCompleted: bv(false),
      createdAt:   tv(now),
      updatedAt:   tv(now),
    });
    console.log("[FC CreateCustomer] ✓ users written");

    // 3e. audit_logs
    await fsAdd("audit_logs", {
      organizationId: sv(organizationId),
      actorId:        sv(createdBy || ""),
      actorRole:      sv("OWNER"),
      actorName:      sv(actorName || ""),
      action:         sv("CUSTOMER_CREATED"),
      entityType:     sv("Customer"),
      entityId:       sv(membershipDocId),
      metadata: {
        mapValue: {
          fields: {
            email:         sv(emailKey),
            fullName:      sv(fullName),
            role:          sv("CUSTOMER"),
            accountNumber: sv(accountNumber),
          },
        },
      },
      createdAt: tv(now),
    });
    console.log("[FC CreateCustomer] ✓ audit_logs written");

  } catch (fsErr: any) {
    console.error("[FC CreateCustomer] ✗ Firestore write failed:", fsErr.message);
    if (isNewUser) {
      console.log("[FC CreateCustomer] ↩ Rolling back Clerk user:", userId);
      try { await clerkClient.users.deleteUser(userId); console.log("[FC CreateCustomer] ↩ Rollback complete"); }
      catch (rb: any) { console.error("[FC CreateCustomer] ✗ Rollback failed:", rb?.message); }
    }
    return res.status(500).json({ error: `Failed to create customer records: ${fsErr.message}` });
  }

  console.log("[FC CreateCustomer] ✓ Customer fully created — userId:", userId, "membershipDocId:", membershipDocId);
  return res.json({ userId, email: emailKey, generatedPassword, membershipDocId });
});

// ─── Deactivate agent ─────────────────────────────────────────────────────────
app.post("/api/agents/:userId/deactivate", authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const { organizationId } = req.body;
  if (!organizationId) return res.status(400).json({ error: "organizationId required" });

  const callerClerkId = (req as any).clerkUserId;
  const isAdmin = await verifyIsOrgAdmin(callerClerkId, organizationId);
  if (!isAdmin) return res.status(403).json({ error: "Only owners/managers can deactivate agents" });

  try {
    await clerkClient.organizations.deleteOrganizationMembership({
      organizationId, userId,
    });
    return res.json({ success: true });
  } catch (err: any) {
    const msg = err?.errors?.[0]?.longMessage || err?.message || "Failed to deactivate";
    return res.status(500).json({ error: msg });
  }
});

// ─── Reactivate agent ─────────────────────────────────────────────────────────
app.post("/api/agents/:userId/reactivate", authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const { organizationId } = req.body;
  if (!organizationId) return res.status(400).json({ error: "organizationId required" });

  const callerClerkId = (req as any).clerkUserId;
  const isAdmin = await verifyIsOrgAdmin(callerClerkId, organizationId);
  if (!isAdmin) return res.status(403).json({ error: "Only owners/managers can reactivate agents" });

  try {
    const reactivateRole = "org:member";
    console.log("[FC ReactivateAgent] Assigning role:", reactivateRole, "to userId:", userId, "in org:", organizationId);
    await clerkClient.organizations.createOrganizationMembership({
      organizationId, userId, role: reactivateRole,
    });
    return res.json({ success: true });
  } catch (err: any) {
    const msg = err?.errors?.[0]?.longMessage || err?.message || "Failed to reactivate";
    return res.status(500).json({ error: msg });
  }
});

// ─── Update Customer ──────────────────────────────────────────────────────────
app.put("/api/update-customer/:customerId", authMiddleware, async (req, res) => {
  const { customerId } = req.params;
  const {
    organizationId,
    phone, address,
    nomineeName, nomineeRelation, nomineePhone, nomineeAddress,
    assignedAgentId, assignedAgentName,
    notes,
  } = req.body as {
    organizationId?: string;
    phone?: string; address?: string;
    nomineeName?: string; nomineeRelation?: string;
    nomineePhone?: string; nomineeAddress?: string;
    assignedAgentId?: string; assignedAgentName?: string;
    notes?: string;
  };

  if (!customerId || !organizationId) {
    return res.status(400).json({ error: "customerId and organizationId are required." });
  }

  // ── Server-side validation for update payload ────────────────────────────────
  const updValidErrors: Record<string, string> = {};
  if (phone !== undefined && phone !== null && phone.trim() && !srvValidPhone(phone)) {
    updValidErrors.phone = "Phone must be a valid 10-digit number.";
  }
  if (nomineeRelation !== undefined && nomineeRelation !== null &&
      nomineeRelation.trim() && !ALLOWED_NOMINEE_RELS.has(nomineeRelation.trim())) {
    updValidErrors.nomineeRelation = "Select a valid nominee relationship.";
  }
  if (nomineePhone !== undefined && nomineePhone !== null && nomineePhone.trim() && !srvValidPhone(nomineePhone)) {
    updValidErrors.nomineePhone = "Nominee phone must be a valid 10-digit number.";
  }
  if (Object.keys(updValidErrors).length) {
    return res.status(400).json({ error: "Validation failed.", errors: updValidErrors });
  }

  console.log("[FC UpdateCustomer] customerId:", customerId, "orgId:", organizationId);

  // ── Build partial-update payload ─────────────────────────────────────────
  const now = new Date();
  const fields: Record<string, any> = { updatedAt: tv(now) };

  // Sanitize all string fields before writing
  const cleanPhone           = phone          ? phone.replace(/\D/g, "").slice(0, 10) : null;
  const cleanAddress         = address        ? srvSanitize(address, 500)       : null;
  const cleanNomineeName     = nomineeName    ? srvSanitize(nomineeName, 100)   : null;
  const cleanNomineeRelation = nomineeRelation ? nomineeRelation.trim()          : null;
  const cleanNomineePhone    = nomineePhone   ? nomineePhone.replace(/\D/g, "").slice(0, 10) : null;
  const cleanNomineeAddress  = nomineeAddress ? srvSanitize(nomineeAddress, 500) : null;
  const cleanNotes           = notes          ? srvSanitize(notes, 500)          : null;

  if (cleanPhone           != null) fields.phone           = sv(cleanPhone);
  if (cleanAddress         != null) fields.address         = sv(cleanAddress);
  if (cleanNomineeName     != null) fields.nomineeName     = sv(cleanNomineeName);
  if (cleanNomineeRelation != null) fields.nomineeRelation = sv(cleanNomineeRelation);
  if (cleanNomineePhone    != null) fields.nomineePhone    = sv(cleanNomineePhone);
  if (cleanNomineeAddress  != null) fields.nomineeAddress  = sv(cleanNomineeAddress);
  // Keep nested nominee map in sync for legacy compat
  if (cleanNomineeName != null) {
    fields.nominee = {
      mapValue: {
        fields: {
          name:     sv(cleanNomineeName),
          relation: sv(cleanNomineeRelation || ""),
          phone:    sv(cleanNomineePhone    || ""),
          address:  sv(cleanNomineeAddress  || ""),
        },
      },
    };
  }
  if (cleanNotes           != null) fields.notes           = sv(cleanNotes);
  if (assignedAgentId      != null) fields.assignedAgentId  = sv(assignedAgentId);
  if (assignedAgentName    != null) fields.assignedAgentName = sv(srvSanitize(assignedAgentName, 100));

  // ── 4. Partial-update both collections ──────────────────────────────────
  try {
    await fsUpdate("organizationMembers", customerId, fields);
    console.log("[FC UpdateCustomer] ✓ organizationMembers updated");
  } catch (e: any) {
    console.error("[FC UpdateCustomer] ✗ organizationMembers update failed:", e.message);
    return res.status(500).json({ error: e.message });
  }
  try {
    await fsUpdate("customers", customerId, fields);
    console.log("[FC UpdateCustomer] ✓ customers mirror updated");
  } catch (_) {}

  return res.json({ success: true });
});

// ─── MFA diagnostics & reset ──────────────────────────────────────────────────
app.get("/api/clerk/mfa-status", async (req, res) => {
  const email = (req.query.email as string ?? "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "email query param required" });

  console.log("[FC MFA] GET /api/clerk/mfa-status — email:", email);
  try {
    const list = await clerkClient.users.getUserList({ emailAddress: [email] });
    if (!list.data.length) {
      console.log("[FC MFA]   user not found");
      return res.json({ found: false, userId: null, mfaFactors: [], message: "User not found in Clerk" });
    }
    const user = list.data[0];
    const totpFactors  = (user as any).totpEnabled      ? ["totp"]       : [];
    const phoneFactors = ((user as any).phoneNumbers ?? [])
      .filter((p: any) => p.reservedForSecondFactor)
      .map(() => "phone_code");
    const backupCodes  = (user as any).backupCodeEnabled ? ["backup_code"] : [];
    const mfaFactors   = [...totpFactors, ...phoneFactors, ...backupCodes];

    console.log("[FC MFA]   userId:", user.id, "| mfaFactors:", JSON.stringify(mfaFactors));
    return res.json({ found: true, userId: user.id, mfaFactors, message: mfaFactors.length ? "MFA factors found" : "No MFA factors enrolled" });
  } catch (err: any) {
    const msg = err?.errors?.[0]?.longMessage || err?.message || "Failed to check MFA status";
    console.error("[FC MFA] mfa-status error:", msg);
    return res.status(500).json({ error: msg });
  }
});

app.post("/api/clerk/reset-user-mfa", async (req, res) => {
  const email = (req.body?.email ?? "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "email required" });

  console.log("════════════════════════════════════════════════");
  console.log("[FC MFA] POST /api/clerk/reset-user-mfa — email:", email);

  try {
    const list = await clerkClient.users.getUserList({ emailAddress: [email] });
    if (!list.data.length) {
      console.warn("[FC MFA]   User not found in Clerk for email:", email);
      return res.status(404).json({ error: "User not found", cleared: false });
    }

    const user = list.data[0];
    const userId = user.id;
    console.log("[FC MFA]   userId          :", userId);
    console.log("[FC MFA]   primaryEmail    :", user.primaryEmailAddress?.emailAddress ?? "—");
    console.log("[FC MFA]   totpEnabled     :", (user as any).totpEnabled ?? false);
    console.log("[FC MFA]   backupCodeEnabled:", (user as any).backupCodeEnabled ?? false);

    let cleared = false;
    let factorsRemoved: string[] = [];

    try {
      await (clerkClient.users as any).disableMFA(userId);
      cleared = true;
      factorsRemoved.push("all");
      console.log("[FC MFA]   ✓ disableMFA() succeeded — all MFA factors removed");
    } catch (mfaErr: any) {
      const code = mfaErr?.errors?.[0]?.code;
      if (code === "resource_not_found" || mfaErr?.status === 404) {
        console.log("[FC MFA]   No MFA factors to delete (user had none enrolled)");
        cleared = true;
      } else {
        try {
          await (clerkClient.users as any).request({
            method: "DELETE",
            path: `/v1/users/${userId}/mfa`,
          });
          cleared = true;
          factorsRemoved.push("all");
          console.log("[FC MFA]   ✓ Raw DELETE /mfa succeeded");
        } catch (rawErr: any) {
          const rawMsg = rawErr?.errors?.[0]?.longMessage || rawErr?.message || String(rawErr);
          console.error("[FC MFA]   ✗ Raw DELETE /mfa failed:", rawMsg);
          cleared = true;
          console.log("[FC MFA]   Treating as no-op (user may have had no enrolled factors)");
        }
      }
    }

    console.log("[FC MFA]   cleared:", cleared, "| factorsRemoved:", JSON.stringify(factorsRemoved));
    console.log("════════════════════════════════════════════════");

    return res.json({
      cleared,
      userId,
      factorsRemoved,
      message: cleared
        ? "MFA factors removed. If MFA is Required in Clerk Dashboard, disable it at: Configure → Multi-factor → Off"
        : "Could not remove MFA factors",
    });
  } catch (err: any) {
    const msg = err?.errors?.[0]?.longMessage || err?.message || "Failed to reset MFA";
    console.error("[FC MFA] reset-user-mfa error:", msg);
    return res.status(500).json({ error: msg });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok", service: "fundcircle",
    timestamp: new Date().toISOString(),
  });
});

// ─── Clerk User Profile (read-only, for agent viewing customer) ───────────────
app.get("/api/clerk-user/:userId", authMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!userId || !userId.startsWith("user_")) {
    return res.status(400).json({ error: "Invalid Clerk user ID" });
  }
  try {
    const u = await clerkClient.users.getUser(userId);
    const primary = u.emailAddresses.find(e => e.id === u.primaryEmailAddressId);
    const primaryPhone = u.phoneNumbers.find(p => p.id === u.primaryPhoneNumberId);
    return res.json({
      id:                  u.id,
      imageUrl:            u.imageUrl || null,
      firstName:           u.firstName || null,
      lastName:            u.lastName  || null,
      fullName:            [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
      email:               primary?.emailAddress || null,
      emailVerified:       primary?.verification?.status === "verified",
      phone:               primaryPhone?.phoneNumber || null,
      phoneVerified:       primaryPhone?.verification?.status === "verified",
      lastSignInAt:        u.lastSignInAt  ? new Date(u.lastSignInAt).toISOString()  : null,
      createdAt:           u.createdAt     ? new Date(u.createdAt).toISOString()     : null,
      banned:              u.banned,
      locked:              u.locked,
    });
  } catch (err: any) {
    const status = err?.status || err?.clerkError ? 404 : 500;
    return res.status(status).json({ error: err?.message || "Failed to fetch Clerk user" });
  }
});

// ─── Remove Organization Logo ─────────────────────────────────────────────────
app.post("/api/remove-org-logo", authMiddleware, async (req, res) => {
  const { organizationId } = req.body as { organizationId: string };
  const callerClerkId = (req as any).clerkUserId as string;

  if (!organizationId) {
    return res.status(400).json({ error: "organizationId is required." });
  }

  const isAdmin = await verifyIsOrgAdmin(callerClerkId, organizationId);
  if (!isAdmin) {
    return res.status(403).json({ error: "Only organization owners or managers can remove the logo." });
  }

  try {
    await clerkClient.organizations.deleteOrganizationLogo(organizationId);
    return res.json({ success: true });
  } catch (err: any) {
    const msg = err?.errors?.[0]?.longMessage || err?.message || "Failed to remove logo";
    console.error("[FC RemoveLogo] Error:", msg);
    return res.status(500).json({ error: msg });
  }
});

// ─── Firestore server-side GET helper ────────────────────────────────────────
async function fsGet(col: string, docId: string): Promise<Record<string, any> | null> {
  if (!FIREBASE_API_KEY) return null;
  try {
    const url  = `${FS_BASE}/${col}/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data: any = await resp.json();
    return data.fields ?? null;
  } catch { return null; }
}

function fsVal(field: any): any {
  if (!field) return null;
  if (field.stringValue    !== undefined) return field.stringValue;
  if (field.integerValue   !== undefined) return Number(field.integerValue);
  if (field.doubleValue    !== undefined) return Number(field.doubleValue);
  if (field.booleanValue   !== undefined) return field.booleanValue;
  if (field.timestampValue !== undefined) return field.timestampValue;
  if (field.nullValue      !== undefined) return null;
  if (field.mapValue?.fields) {
    return Object.fromEntries(
      Object.entries<any>(field.mapValue.fields).map(([k, v]) => [k, fsVal(v)])
    );
  }
  return null;
}

function fsFieldsToObj(fields: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fsVal(v)]));
}

// ─── PhonePe Payment Gateway Routes ──────────────────────────────────────────

async function loadPhonePeConfig(organizationId: string) {
  const fields = await fsGet("orgPhonePeConfig", organizationId);
  if (!fields) return null;
  const cfg = fsFieldsToObj(fields);
  if (cfg.deleted || !cfg.merchantId) return null;
  try {
    return {
      merchantId:    cfg.merchantId as string,
      clientId:      decryptField(cfg.clientId || ""),
      clientSecret:  decryptField(cfg.clientSecret || ""),
      saltKey:       decryptField(cfg.saltKey || ""),
      saltIndex:     (cfg.saltIndex || "1") as string,
      webhookSecret: decryptField(cfg.webhookSecret || ""),
      environment:   (cfg.environment || "sandbox") as "sandbox" | "production",
    };
  } catch { return null; }
}

// POST /api/phonepe/save-config — Owner saves encrypted PhonePe credentials
app.post("/api/phonepe/save-config", authMiddleware, async (req: Request, res: Response) => {
  const callerClerkId = (req as any).clerkUserId as string;
  const { organizationId, merchantId, clientId, clientSecret, saltKey, saltIndex, webhookSecret, environment }
    = req.body as Record<string, string>;

  if (!organizationId) return res.status(400).json({ error: "organizationId required" });
  if (!merchantId?.trim()) return res.status(400).json({ error: "merchantId required" });

  const isAdmin = await verifyIsOrgAdmin(callerClerkId, organizationId);
  if (!isAdmin) return res.status(403).json({ error: "Only organization owners can configure PhonePe." });

  const env: "sandbox" | "production" = environment === "production" ? "production" : "sandbox";

  const existingFields = await fsGet("orgPhonePeConfig", organizationId);
  const existing = existingFields ? fsFieldsToObj(existingFields) : null;

  const encOrKeep = (newVal: string | undefined, existingKey: string) => {
    const v = (newVal || "").trim();
    if (v) return encryptField(v);
    if (existing?.[existingKey]) return existing[existingKey];
    return "";
  };

  const now = new Date();
  try {
    await fsSet("orgPhonePeConfig", organizationId, {
      merchantId:    sv(srvSanitize(merchantId.trim(), 100)),
      clientId:      sv(encOrKeep(clientId, "clientId")),
      clientSecret:  sv(encOrKeep(clientSecret, "clientSecret")),
      saltKey:       sv(encOrKeep(saltKey, "saltKey")),
      saltIndex:     sv(srvSanitize((saltIndex || "1").trim(), 5)),
      webhookSecret: sv(encOrKeep(webhookSecret, "webhookSecret")),
      environment:   sv(env),
      deleted:       bv(false),
      createdAt:     existing ? (existingFields?.createdAt ?? tv(now)) : tv(now),
      updatedAt:     tv(now),
    });

    const hint = merchantId.trim().slice(0, 4) + "****";
    await fsSet("organizations", organizationId, {
      phonePeConfigured:     bv(true),
      phonePeEnvironment:    sv(env),
      phonePeMerchantIdHint: sv(hint),
      updatedAt:             tv(now),
    });

    console.log(`[PhonePe] ✓ Config saved for org ${organizationId} env:${env}`);
    return res.json({ success: true, environment: env, merchantIdHint: hint });
  } catch (err: any) {
    console.error("[PhonePe] save-config error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/phonepe/delete-config — Owner removes PhonePe integration
app.post("/api/phonepe/delete-config", authMiddleware, async (req: Request, res: Response) => {
  const callerClerkId = (req as any).clerkUserId as string;
  const { organizationId } = req.body as { organizationId: string };
  if (!organizationId) return res.status(400).json({ error: "organizationId required" });

  const isAdmin = await verifyIsOrgAdmin(callerClerkId, organizationId);
  if (!isAdmin) return res.status(403).json({ error: "Only owners can remove PhonePe config." });

  try {
    await fsSet("orgPhonePeConfig", organizationId, {
      merchantId: sv(""), clientId: sv(""), clientSecret: sv(""),
      saltKey: sv(""), saltIndex: sv(""), webhookSecret: sv(""),
      environment: sv("sandbox"), deleted: bv(true), updatedAt: tv(new Date()),
    });
    await fsSet("organizations", organizationId, {
      phonePeConfigured:     bv(false),
      phonePeEnvironment:    sv("sandbox"),
      phonePeMerchantIdHint: sv(""),
      updatedAt:             tv(new Date()),
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/phonepe/validate — Test stored credentials against PhonePe API
app.post("/api/phonepe/validate", authMiddleware, async (req: Request, res: Response) => {
  const callerClerkId = (req as any).clerkUserId as string;
  const { organizationId } = req.body as { organizationId: string };
  if (!organizationId) return res.status(400).json({ error: "organizationId required" });

  const isAdmin = await verifyIsOrgAdmin(callerClerkId, organizationId);
  if (!isAdmin) return res.status(403).json({ error: "Only owners can validate PhonePe config." });

  const ppConfig = await loadPhonePeConfig(organizationId);
  if (!ppConfig) return res.status(404).json({ valid: false, message: "PhonePe not configured for this organization." });

  const result = await checkPhonePeStatus(ppConfig, `VALIDATE_${Date.now()}`);
  const credentialsOk = result.errorCode !== "NETWORK_ERROR" && result.errorCode !== "PARSE_ERROR";

  if (credentialsOk) {
    return res.json({
      valid: true,
      message: `Connected to PhonePe ${ppConfig.environment}. Credentials look valid.`,
      environment: ppConfig.environment,
    });
  }
  return res.json({ valid: false, message: result.errorMessage || "Could not connect to PhonePe. Check credentials." });
});

// POST /api/phonepe/create-order — Create a PhonePe UPI QR payment order
app.post("/api/phonepe/create-order", authMiddleware, async (req: Request, res: Response) => {
  const {
    organizationId, loanId, installmentId, customerId, customerName, customerPhone,
    agentId, agentName, amount, collectionType, installmentNo, collectedByRole, collectedById,
  } = req.body as {
    organizationId: string; loanId?: string; installmentId?: string;
    customerId: string; customerName: string; customerPhone?: string;
    agentId: string; agentName: string; amount: number;
    collectionType: "LOAN_EMI" | "GENERAL"; installmentNo?: number;
    collectedByRole?: string; collectedById?: string;
  };

  if (!organizationId || !customerId || !agentId || !(amount > 0)) {
    return res.status(400).json({ error: "organizationId, customerId, agentId and amount > 0 required" });
  }
  if (amount > 1_00_000) {
    return res.status(400).json({ error: "Amount cannot exceed ₹1,00,000 per transaction" });
  }

  const ppConfig = await loadPhonePeConfig(organizationId);
  if (!ppConfig) return res.status(404).json({ error: "PhonePe not configured for this organization." });

  const merchantTransactionId = generateMerchantTransactionId(organizationId);
  const note = collectionType === "LOAN_EMI"
    ? `EMI${installmentNo ? ` #${installmentNo}` : ""} - ${srvSanitize(customerName, 50)}`
    : `Payment - ${srvSanitize(customerName, 50)}`;
  const base = getBaseUrl();

  const orderResult = await createPhonePeOrder(ppConfig, {
    merchantTransactionId,
    amountRupees:   amount,
    customerMobile: customerPhone?.replace(/\D/g, "").slice(-10),
    note,
    callbackUrl:    `${base}/api/phonepe/webhook`,
    redirectUrl:    `${base}/payment-complete`,
  });

  if (!orderResult.success) {
    console.error("[PhonePe] create-order failed:", orderResult.errorCode, orderResult.errorMessage);
    return res.status(502).json({
      error: orderResult.errorMessage || "PhonePe order creation failed",
      code:  orderResult.errorCode,
    });
  }

  const now = new Date();
  try {
    await fsSet("phonePeOrders", merchantTransactionId, {
      merchantTransactionId: sv(merchantTransactionId),
      organizationId:        sv(organizationId),
      loanId:                sv(loanId || ""),
      installmentId:         sv(installmentId || ""),
      customerId:            sv(customerId),
      customerName:          sv(srvSanitize(customerName, 100)),
      agentId:               sv(agentId),
      agentName:             sv(srvSanitize(agentName, 100)),
      amount:                { doubleValue: amount },
      collectionType:        sv(collectionType || "LOAN_EMI"),
      installmentNo:         iv(installmentNo || 0),
      collectedByRole:       sv(collectedByRole || "AGENT"),
      collectedById:         sv(collectedById || agentId),
      status:                sv("INITIATED"),
      collectionRecorded:    bv(false),
      expiresAt:             tv(new Date(now.getTime() + 15 * 60 * 1000)),
      createdAt:             tv(now),
      updatedAt:             tv(now),
    });
  } catch (fsErr: any) {
    console.error("[PhonePe] ⚠ Firestore order write (non-fatal):", fsErr.message);
  }

  return res.json({ success: true, merchantTransactionId, intentUrl: orderResult.intentUrl });
});

// POST /api/phonepe/check-status — Poll payment status from PhonePe
app.post("/api/phonepe/check-status", authMiddleware, async (req: Request, res: Response) => {
  const { organizationId, merchantTransactionId } = req.body as {
    organizationId: string; merchantTransactionId: string;
  };
  if (!organizationId || !merchantTransactionId) {
    return res.status(400).json({ error: "organizationId and merchantTransactionId required" });
  }

  const ppConfig = await loadPhonePeConfig(organizationId);
  if (!ppConfig) return res.status(404).json({ error: "PhonePe not configured." });

  const statusResult = await checkPhonePeStatus(ppConfig, merchantTransactionId);

  if (statusResult.state === "COMPLETED" || statusResult.state === "FAILED") {
    try {
      await fsUpdate("phonePeOrders", merchantTransactionId, {
        status:               sv(statusResult.state === "COMPLETED" ? "SUCCESS" : "FAILED"),
        phonePeTransactionId: sv(statusResult.transactionId || ""),
        utr:                  sv(statusResult.utr || ""),
        errorCode:            sv(statusResult.errorCode || ""),
        updatedAt:            tv(new Date()),
      });
    } catch (_) {}
  }

  return res.json({
    success:       statusResult.success,
    state:         statusResult.state,
    transactionId: statusResult.transactionId,
    utr:           statusResult.utr,
    amountRupees:  statusResult.amountRupees,
    errorCode:     statusResult.errorCode,
    errorMessage:  statusResult.errorMessage,
  });
});

// POST /api/phonepe/webhook — Server-to-server callback from PhonePe
// No authMiddleware — PhonePe calls this directly; verified via HMAC-SHA256 signature
app.post(
  "/api/phonepe/webhook",
  express.text({ type: ["application/json", "text/plain", "*/*"] }),
  async (req: Request, res: Response) => {
    console.log("[PhonePe Webhook] ▶ Received", req.method, req.headers["content-type"]);
    try {
      const xVerify = (req.headers["x-verify"] as string) || "";
      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      if (!rawBody || rawBody === "{}") return res.status(400).json({ error: "Empty body" });

      let decodedPayload: any = null;
      try {
        const parsed = JSON.parse(rawBody);
        const responseB64 = parsed.response;
        decodedPayload = responseB64
          ? JSON.parse(Buffer.from(responseB64, "base64").toString("utf8"))
          : parsed;
      } catch {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const merchantTransactionId =
        decodedPayload?.data?.merchantTransactionId ||
        decodedPayload?.merchantTransactionId || "";

      if (!merchantTransactionId) return res.status(400).json({ error: "merchantTransactionId missing" });
      console.log("[PhonePe Webhook] merchantTransactionId:", merchantTransactionId);

      const orderFields = await fsGet("phonePeOrders", merchantTransactionId);
      if (!orderFields) {
        console.warn("[PhonePe Webhook] Order not found:", merchantTransactionId);
        return res.status(200).json({ acknowledged: true }); // 200 prevents retries
      }
      const order     = fsFieldsToObj(orderFields);
      const cfgFields = await fsGet("orgPhonePeConfig", order.organizationId);
      const cfg       = cfgFields ? fsFieldsToObj(cfgFields) : null;

      if (cfg && xVerify) {
        try {
          const webhookSecret = decryptField(cfg.webhookSecret || "");
          const parsedBody    = JSON.parse(rawBody);
          const b64ForVerify  = parsedBody.response || Buffer.from(rawBody).toString("base64");
          const valid = verifyPhonePeWebhook(b64ForVerify, xVerify, webhookSecret, cfg.saltIndex || "1");
          if (!valid) {
            console.warn("[PhonePe Webhook] ✗ Signature invalid");
            return res.status(401).json({ error: "Invalid signature" });
          }
          console.log("[PhonePe Webhook] ✓ Signature verified");
        } catch (sigErr: any) {
          console.warn("[PhonePe Webhook] Signature check error:", sigErr.message);
        }
      }

      const payData      = decodedPayload?.data || {};
      const state        = payData?.state || "";
      const responseCode = payData?.responseCode || decodedPayload?.code || "";
      const pgTxnId      = payData?.transactionId || "";
      const utr          = payData?.paymentInstrument?.utr || "";

      const isSuccess = state === "COMPLETED" || responseCode === "SUCCESS" || decodedPayload?.code === "PAYMENT_SUCCESS";
      const isFailed  = state === "FAILED"    || responseCode === "FAILED"   || decodedPayload?.code === "PAYMENT_ERROR";
      const newStatus = isSuccess ? "SUCCESS" : isFailed ? "FAILED" : "PENDING";

      console.log(`[PhonePe Webhook] status:${newStatus} | pgTxnId:${pgTxnId} | utr:${utr}`);

      try {
        await fsUpdate("phonePeOrders", merchantTransactionId, {
          status:               sv(newStatus),
          phonePeTransactionId: sv(pgTxnId),
          utr:                  sv(utr),
          updatedAt:            tv(new Date()),
        });
      } catch (fsErr: any) {
        console.error("[PhonePe Webhook] Firestore update failed:", fsErr.message);
      }

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("[PhonePe Webhook] Error:", err.message);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  console.warn(`[FC API] 404 — unmatched route: ${req.method} ${req.path}`);
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[FC API] Unhandled error:", err?.message ?? err);
  res.status(500).json({ error: err?.message || "Internal server error" });
});

const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3002;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[FC API] Server running on http://localhost:${PORT}`);
});
