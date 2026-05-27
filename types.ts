export type Role = "organization_owner" | "agent" | "customer" | "OWNER";

export interface Organization {
  id: string; // matches Clerk organization ID
  name: string;
  createdAt: number;
}

export interface User {
  id: string; // Firestore document id or Clerk user id for synchronized user profiles
  clerkUserId?: string; // Clerk user id once linked
  organizationId?: string;
  role?: Role;
  name: string;
  email: string;
  phone?: string;
  assignedArea?: string;
  agentId?: string;
  balance?: number;
  invitationId?: string;
  status?: "pending" | "active";
  createdAt: number;
}

export interface Membership {
  id: string; // organizationId_clerkUserId
  organizationId: string;
  clerkUserId: string;
  role: Role;
  name: string;
  email: string;
  phone?: string;
  createdAt: number;
  assignedArea?: string; // For agents
  agentId?: string; // For customers, the agent assigned to them
  balance?: number; // For customers
  invitationId?: string;
  status?: "pending" | "active";
}

export interface Collection {
  id: string;
  organizationId: string;
  customerId: string;
  agentId: string;
  amount: number;
  timestamp: number;
  status: "completed" | "pending";
  collectedByRole?: "OWNER" | "AGENT" | string;
  collectedByUserId?: string;
  collectedByName?: string;
  receiptUrl?: string; // Firebase Storage URL
}

export interface Transaction {
  id: string;
  organizationId: string;
  customerId: string;
  agentId: string;
  amount: number;
  type: "deposit" | "withdrawal" | "emi_payment" | "loan_disbursement";
  timestamp: number;
  referenceId?: string;
}

export interface Loan {
  id: string;
  organizationId: string;
  customerId: string;
  principal: number;
  interestRate: number; // e.g., 2% monthly
  durationMonths: number;
  status: "pending" | "approved" | "rejected" | "active" | "closed";
  emiAmount: number;
  totalComputed: number;
  balanceRemaining: number;
  createdAt: number;
  approvedAt?: number;
}

export interface EMIPayment {
  id: string;
  organizationId: string;
  loanId: string;
  customerId: string;
  agentId: string;
  amount: number;
  timestamp: number;
}

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  timestamp: number;
}
