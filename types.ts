export type Role = "organization_owner" | "agent" | "customer" | "OWNER";

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  phone?: string;
  address?: string;
  currency?: string;
  logoUrl?: string;
  ownerClerkUserId?: string;
  ownerEmail?: string;
  subscriptionPlanId?: string;
  createdAt: number;
}

export interface User {
  id: string;
  clerkUserId?: string;
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
  id: string;
  organizationId: string;
  clerkUserId: string;
  role: Role;
  name: string;
  email: string;
  phone?: string;
  createdAt: number;
  assignedArea?: string;
  agentId?: string;
  balance?: number;
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
  receiptUrl?: string;
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
  interestRate: number;
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

export type SubscriptionPlanId = "starter" | "professional" | "enterprise";
export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "expired" | "cancelled" | "trial";
export type PaymentStatus = "success" | "failed" | "pending";

export interface Subscription {
  id: string;
  organizationId: string;
  planId: SubscriptionPlanId;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  maxAgents: number;
  maxCustomers: number;
  startedAt: any;
  expiresAt?: number;
  createdAt: any;
  updatedAt: any;
}

export interface Payment {
  id: string;
  organizationId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  paymentStatus: PaymentStatus;
  paidAt: any;
  invoiceNumber: string;
  cardLast4?: string;
  createdAt: any;
}

export interface Invoice {
  id: string;
  organizationId: string;
  subscriptionId: string;
  paymentId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  planName: string;
  billingCycle: BillingCycle;
  status: "paid" | "unpaid" | "cancelled";
  issuedAt: any;
  paidAt?: any;
  createdAt: any;
}
