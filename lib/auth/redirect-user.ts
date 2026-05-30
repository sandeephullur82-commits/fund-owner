import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { membershipIdFor, reconcilePendingInviteMembership } from "@/lib/services";
import { getDashboardPath, normalizeClerkRole } from "./get-user-role";

export interface UserRedirectResult {
  path: string;
  profileIncomplete: boolean;
  role: string | null;
  membership: any | null;
  organizationId: string | null;
}

async function fetchMembershipForOrganization(userId: string, organizationId: string) {
  const docId = membershipIdFor(organizationId, userId);
  console.log("[FC STEP 9] fetchMembership — docId:", docId);
  const snap = await getDoc(doc(db, "organizationMembers", docId));
  if (!snap.exists()) {
    console.warn("[FC STEP 9] ✗ No membership doc at organizationMembers/" + docId);
    return null;
  }
  const data = snap.data();
  console.log("[FC STEP 9] ✓ Membership doc found:");
  console.log("[FC STEP 9]   role             :", data.clerkRole ?? data.role ?? "MISSING");
  console.log("[FC STEP 9]   status           :", data.status ?? "—");
  console.log("[FC STEP 9]   profileCompleted :", data.profileCompleted ?? "field absent");
  console.log("[FC STEP 9]   clerkUserId      :", data.clerkUserId ?? "MISSING — may block role resolution");
  console.log("[FC STEP 9]   organizationId   :", data.organizationId ?? "MISSING");
  console.log("[FC STEP 9]   email            :", data.email ?? "—");
  return data;
}

async function fetchAnyMembershipForUser(userId: string) {
  console.log("[FC STEP 9] Searching ALL orgs for userId:", userId);
  const snap = await getDocs(
    query(collection(db, "organizationMembers"), where("clerkUserId", "==", userId))
  );
  if (snap.empty) {
    console.warn("[FC STEP 9] ✗ No membership found anywhere for userId:", userId);
    return null;
  }
  const data = snap.docs[0].data();
  console.log("[FC STEP 9] ✓ Found membership in org:", data.organizationId ?? snap.docs[0].id);
  console.log("[FC STEP 9]   role:", data.clerkRole ?? data.role ?? "MISSING");
  console.log("[FC STEP 9]   status:", data.status ?? "—");
  return data;
}

export async function resolveUserRedirectTarget(
  user: any | null,
  activeOrgId?: string | null
): Promise<UserRedirectResult> {
  if (!user) {
    console.warn("[FC STEP 9] No user object — returning /auth/sign-in");
    return { path: "/auth/sign-in", profileIncomplete: false, role: null, membership: null, organizationId: null };
  }

  const email    = user.primaryEmailAddress?.emailAddress?.trim().toLowerCase() || "";
  const fullName = user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim();

  console.log("════════════════════════════════════════════════");
  console.log("[FC STEP 9] ▶ Role resolution");
  console.log("[FC STEP 9]   userId     :", user.id);
  console.log("[FC STEP 9]   email      :", email || "MISSING — may cause reconciliation to skip");
  console.log("[FC STEP 9]   fullName   :", fullName || "(not set)");
  console.log("[FC STEP 9]   activeOrgId:", activeOrgId ?? "null");
  console.log("════════════════════════════════════════════════");

  // ── Reconcile pending invite ─────────────────────────────────────────────
  if (email && activeOrgId) {
    try {
      console.log("[FC STEP 6] ▶ Reconciling pending invite — email:", email, "| orgId:", activeOrgId, "| userId:", user.id);
      const reconciled = await reconcilePendingInviteMembership(email, activeOrgId, user.id, fullName);
      if (reconciled.length) {
        console.log("[FC STEP 6] ✓ Pending invite reconciled — docs created/updated:", reconciled.length);
        console.log("[FC STEP 6]   role written:", reconciled[0]?.clerkRole ?? reconciled[0]?.role ?? "—");
      } else {
        console.log("[FC STEP 6] No pending invite found to reconcile (may already be done)");
      }
    } catch (error) {
      console.error("[FC STEP 6] ✗ Pending invite reconciliation failed:", error);
    }
  } else {
    if (!email)      console.warn("[FC STEP 6] Skipping reconciliation — no email");
    if (!activeOrgId) console.warn("[FC STEP 6] Skipping reconciliation — no activeOrgId");
  }

  // ── Fetch membership doc ─────────────────────────────────────────────────
  let membership: any    = null;
  let membershipOrgId    = activeOrgId || null;

  if (activeOrgId) {
    membership = await fetchMembershipForOrganization(user.id, activeOrgId);
  }

  if (!membership) {
    console.log("[FC STEP 9] No membership for active org — searching all orgs…");
    membership = await fetchAnyMembershipForUser(user.id);
    if (membership) {
      membershipOrgId = membership.organizationId || membershipOrgId;
    }
  }

  // ── No membership anywhere ───────────────────────────────────────────────
  if (!membership) {
    console.warn("[FC STEP 9] ✗ No Firestore membership found anywhere");
    console.warn("[FC STEP 9]   Possible causes:");
    console.warn("[FC STEP 9]   • Customer was invited but never accepted the Clerk invitation");
    console.warn("[FC STEP 9]   • activatePendingInvite() failed (check STEP 6 logs)");
    console.warn("[FC STEP 9]   • clerkUserId was never written to the membership doc");
    console.warn("[FC STEP 9]   • Email mismatch between Clerk account and pendingInvites doc");
    console.log("[FC STEP 10] → Routing to /organization/invitation (no membership)");
    return { path: "/organization/invitation", profileIncomplete: false, role: null, membership: null, organizationId: membershipOrgId };
  }

  // ── Role resolution ──────────────────────────────────────────────────────
  const rawRole    = membership.clerkRole || membership.role || null;
  const normalized = normalizeClerkRole(rawRole);
  const profileCompleted = membership.profileCompleted !== false;
  const path = profileCompleted ? getDashboardPath(rawRole) : "/complete-profile";

  console.log("[FC STEP 9] ✓ Role resolved:");
  console.log("[FC STEP 9]   rawRole         :", rawRole ?? "NULL — CRITICAL: no role stored in Firestore doc");
  console.log("[FC STEP 9]   normalizedRole  :", normalized ?? "null (UNRECOGNIZED — check normalizeClerkRole())");
  console.log("[FC STEP 9]   profileCompleted:", profileCompleted);

  if (!normalized) {
    console.error("[FC STEP 9] ✗ UNRECOGNIZED ROLE:", rawRole);
    console.error("[FC STEP 9]   Valid values: OWNER, AGENT, CUSTOMER (Firestore) | org:owner, org:pigmy_collector, org:customer (Clerk)");
    console.error("[FC STEP 9]   This will redirect to /onboarding — check the membership doc in Firestore");
  }

  // ── Dashboard redirect ───────────────────────────────────────────────────
  console.log("────────────────────────────────────────────");
  console.log("[FC STEP 10] ▶ Dashboard redirect decision:");
  console.log("[FC STEP 10]   userId          :", user.id);
  console.log("[FC STEP 10]   orgId           :", membershipOrgId ?? "null");
  console.log("[FC STEP 10]   role            :", normalized ?? "(unrecognized)");
  console.log("[FC STEP 10]   profileCompleted:", profileCompleted ? "✓ yes" : "✗ no → /complete-profile");
  console.log("[FC STEP 10]   → destination   :", path);
  console.log("────────────────────────────────────────────");

  return { path, profileIncomplete: !profileCompleted, role: rawRole, membership, organizationId: membershipOrgId };
}
