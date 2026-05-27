import React, { useState } from "react";
import { useOrganizationList, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { membershipIdFor } from "@/lib/services";
import { toast } from "sonner";
import {
  Building2,
  Phone,
  MapPin,
  Globe,
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Check,
  Zap,
  Star,
  Crown,
  Shield,
  Sparkles,
  Loader2,
  IndianRupee,
  Users,
  UserCheck,
} from "lucide-react";

const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
];

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    maxAgents: 5,
    maxCustomers: 100,
    color: "sky",
    icon: Zap,
    features: [
      "Up to 5 Pigmy Collectors",
      "Up to 100 Customers",
      "Realtime collection tracking",
      "Basic analytics dashboard",
      "CSV export reports",
      "Email support",
    ],
  },
  {
    id: "professional" as const,
    name: "Professional",
    monthlyPrice: 1499,
    yearlyPrice: 14990,
    maxAgents: 25,
    maxCustomers: 1000,
    color: "violet",
    icon: Star,
    popular: true,
    features: [
      "Up to 25 Pigmy Collectors",
      "Up to 1,000 Customers",
      "Realtime collection tracking",
      "Advanced analytics + trends",
      "CSV + Excel exports",
      "Loan & EMI management",
      "SMS notifications",
      "Priority support",
    ],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    maxAgents: -1,
    maxCustomers: -1,
    color: "amber",
    icon: Crown,
    features: [
      "Unlimited Pigmy Collectors",
      "Unlimited Customers",
      "Realtime collection tracking",
      "Full analytics suite",
      "All export formats",
      "Loan & EMI management",
      "Custom integrations",
      "Dedicated account manager",
    ],
  },
];

function generateInvoiceNumber() {
  const now = new Date();
  return `FC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .substring(0, 28)
    + "-" + Math.random().toString(36).substring(2, 6);
}

function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .substring(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").substring(0, 4);
  if (digits.length >= 3) return digits.substring(0, 2) + "/" + digits.substring(2);
  return digits;
}

const STEPS = ["Organization", "Subscription", "Payment"];

export default function OwnerOnboarding() {
  const { user } = useUser();
  const { isLoaded, createOrganization, setActive } = useOrganizationList();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);

  const [orgName, setOrgName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("INR");

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "professional" | "enterprise">("professional");

  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const plan = PLANS.find((p) => p.id === selectedPlan)!;
  const amount = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  const currencySymbol = CURRENCIES.find((c) => c.code === currency)?.symbol || "₹";

  const validateStep0 = () => {
    const errs: Record<string, string> = {};
    if (!orgName.trim()) errs.orgName = "Organization name is required.";
    else if (orgName.trim().length < 3) errs.orgName = "Must be at least 3 characters.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    if (!cardHolder.trim()) errs.cardHolder = "Card holder name is required.";
    const rawCard = cardNumber.replace(/\s/g, "");
    if (!rawCard || rawCard.length !== 16) errs.cardNumber = "Enter a valid 16-digit card number.";
    if (!expiry || !expiry.includes("/")) errs.expiry = "Enter a valid expiry (MM/YY).";
    if (!cvv || cvv.length < 3) errs.cvv = "Enter a valid CVV.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    setStep((s) => Math.min(s + 1, 2));
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const handlePayAndLaunch = async () => {
    if (!validateStep2()) return;
    if (!isLoaded || !createOrganization || !user) {
      toast.error("Please wait while we load your account.");
      return;
    }

    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 2400));

      const slug = slugify(orgName);
      const org = await createOrganization({ name: orgName.trim(), slug });

      await setDoc(doc(db, "organizations", org.id), {
        id: org.id,
        organizationId: org.id,
        name: orgName.trim(),
        slug,
        phone: phone.trim(),
        address: address.trim(),
        currency,
        ownerClerkUserId: user.id,
        ownerEmail: user.primaryEmailAddress?.emailAddress || "",
        subscriptionPlanId: selectedPlan,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const membershipDocId = membershipIdFor(org.id, user.id);
      const membershipData = {
        id: membershipDocId,
        organizationId: org.id,
        clerkUserId: user.id,
        clerkRole: "org:owner",
        role: "OWNER",
        organizationName: orgName.trim(),
        fullName: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        name: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.primaryEmailAddress?.emailAddress || "",
        phone: phone.trim(),
        status: "ACTIVE",
        profileCompleted: true,
        actsAsAgent: true,
        collectorEnabled: true,
        assignedArea: "Main Area",
        joinedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "organizationMembers", membershipDocId), membershipData, { merge: true });
      await setDoc(doc(db, "memberships", membershipDocId), membershipData, { merge: true });
      await setDoc(doc(db, "users", user.id), {
        id: user.id,
        name: membershipData.name,
        email: user.primaryEmailAddress?.emailAddress || "",
        role: "organization_owner",
        organizationId: org.id,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const subscriptionRef = doc(collection(db, "subscriptions"));
      const subscriptionId = subscriptionRef.id;
      const invoiceNumber = generateInvoiceNumber();

      const now = new Date();
      const expiresAt = new Date(now);
      if (billingCycle === "monthly") expiresAt.setMonth(expiresAt.getMonth() + 1);
      else expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await setDoc(subscriptionRef, {
        id: subscriptionId,
        organizationId: org.id,
        planId: selectedPlan,
        planName: plan.name,
        billingCycle,
        amount,
        currency,
        status: "active",
        maxAgents: plan.maxAgents,
        maxCustomers: plan.maxCustomers,
        startedAt: serverTimestamp(),
        expiresAt: expiresAt.getTime(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const paymentRef = doc(collection(db, "payments"));
      const paymentId = paymentRef.id;
      const cardLast4 = cardNumber.replace(/\s/g, "").slice(-4);

      await setDoc(paymentRef, {
        id: paymentId,
        organizationId: org.id,
        subscriptionId,
        amount,
        currency,
        billingCycle,
        paymentStatus: "success",
        invoiceNumber,
        cardLast4,
        paidAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      const invoiceRef = doc(collection(db, "invoices"));
      await setDoc(invoiceRef, {
        id: invoiceRef.id,
        organizationId: org.id,
        subscriptionId,
        paymentId,
        invoiceNumber,
        amount,
        currency,
        planName: plan.name,
        billingCycle,
        status: "paid",
        issuedAt: serverTimestamp(),
        paidAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      if (setActive) {
        await setActive({ organization: org.id });
      }

      setSuccess(true);
      await new Promise((r) => setTimeout(r, 1800));
      navigate("/dashboard/owner", { replace: true });
    } catch (err: any) {
      console.error("Onboarding error:", err);
      toast.error(err?.errors?.[0]?.message || err?.message || "Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
          <p className="text-sm text-slate-500">Loading your account…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-violet-50/20">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[-100px] top-[-60px] h-80 w-80 rounded-full bg-sky-200/40 blur-[120px]" />
        <div className="absolute right-[-80px] bottom-[-60px] h-96 w-96 rounded-full bg-violet-200/30 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 text-white font-bold text-sm shadow-lg shadow-sky-300/30">
              FC
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest">FundCircle</p>
              <p className="text-sm font-semibold text-slate-700">Organization Setup</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step ? "bg-emerald-500 text-white" :
                    i === step ? "bg-sky-500 text-white shadow-md shadow-sky-300/40" :
                    "bg-slate-200 text-slate-400"
                  }`}>
                    {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${i === step ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-8 transition-all ${i < step ? "bg-emerald-400" : "bg-slate-200"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl border border-emerald-200 bg-white p-10 text-center shadow-2xl shadow-emerald-200/30"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Organization Created!</h2>
              <p className="text-slate-500 text-sm mb-6">Your workspace is live. Redirecting to your dashboard…</p>
              <div className="flex justify-center">
                <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />
              </div>
            </motion.div>
          ) : step === 0 ? (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40"
            >
              <div className="mb-7">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1 text-xs font-bold text-sky-600 mb-3">
                  <Building2 className="w-3.5 h-3.5" /> Step 1 of 3
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Tell us about your organization</h1>
                <p className="text-sm text-slate-500 mt-1">This information will appear on your reports and invoices.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" />
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => { setOrgName(e.target.value); setErrors((er) => ({ ...er, orgName: "" })); }}
                      placeholder="e.g. Mandya Pigmy Cooperative Bank"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 transition-all ${errors.orgName ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-sky-200 focus:border-sky-400"}`}
                    />
                  </div>
                  {errors.orgName && <p className="mt-1 text-xs text-red-500">{errors.orgName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-200 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main Street, Mandya, Karnataka"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-200 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Currency</label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-200 focus:outline-none transition-all appearance-none"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white px-6 py-3 text-sm font-bold shadow-md shadow-sky-300/40 transition-all active:scale-[0.98]"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ) : step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40"
            >
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600 mb-3">
                  <Sparkles className="w-3.5 h-3.5" /> Step 2 of 3
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Choose your plan</h1>
                <p className="text-sm text-slate-500 mt-1">Start with any plan — you can upgrade anytime.</p>
              </div>

              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${billingCycle === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${billingCycle === "yearly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    Yearly <span className="text-emerald-600 font-bold">−17%</span>
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {PLANS.map((p) => {
                  const Icon = p.icon;
                  const price = billingCycle === "monthly" ? p.monthlyPrice : p.yearlyPrice;
                  const isSelected = selectedPlan === p.id;
                  const colorMap: Record<string, string> = {
                    sky: isSelected ? "border-sky-400 ring-2 ring-sky-200 bg-sky-50/50" : "border-slate-200 hover:border-sky-200",
                    violet: isSelected ? "border-violet-400 ring-2 ring-violet-200 bg-violet-50/50" : "border-slate-200 hover:border-violet-200",
                    amber: isSelected ? "border-amber-400 ring-2 ring-amber-200 bg-amber-50/50" : "border-slate-200 hover:border-amber-200",
                  };
                  const iconMap: Record<string, string> = {
                    sky: "bg-sky-100 text-sky-600",
                    violet: "bg-violet-100 text-violet-600",
                    amber: "bg-amber-100 text-amber-600",
                  };
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlan(p.id)}
                      className={`relative rounded-2xl border p-5 text-left transition-all ${colorMap[p.color]}`}
                    >
                      {p.popular && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-3 py-0.5 text-[10px] font-bold text-white">
                          Popular
                        </div>
                      )}
                      <div className={`mb-3 w-8 h-8 rounded-lg flex items-center justify-center ${iconMap[p.color]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 mb-0.5">{p.name}</p>
                      <div className="flex items-baseline gap-0.5 mb-3">
                        <span className="text-lg font-extrabold text-slate-900">{currencySymbol}{price.toLocaleString()}</span>
                        <span className="text-xs text-slate-400">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                      </div>
                      <ul className="space-y-1">
                        {p.features.slice(0, 3).map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />{f}
                          </li>
                        ))}
                        {p.features.length > 3 && (
                          <li className="text-xs text-slate-400 pl-4">+{p.features.length - 3} more</li>
                        )}
                      </ul>
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-600 px-5 py-3 text-sm font-semibold transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white px-6 py-3 text-sm font-bold shadow-md shadow-violet-300/40 transition-all active:scale-[0.98]"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40"
            >
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 mb-3">
                  <CreditCard className="w-3.5 h-3.5" /> Step 3 of 3 — Payment
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Complete your setup</h1>
                <p className="text-sm text-slate-500 mt-1">Your subscription will be activated instantly.</p>
              </div>

              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                  FC
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{orgName || "Your Organization"}</p>
                  <p className="text-xs text-slate-500">{plan.name} Plan · {billingCycle === "monthly" ? "Monthly" : "Yearly"} billing</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-slate-900">{currencySymbol}{amount.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">/{billingCycle === "monthly" ? "month" : "year"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Card Holder Name</label>
                  <input
                    type="text"
                    value={cardHolder}
                    onChange={(e) => { setCardHolder(e.target.value); setErrors((er) => ({ ...er, cardHolder: "" })); }}
                    placeholder="Name on card"
                    className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 transition-all ${errors.cardHolder ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-sky-200 focus:border-sky-400"}`}
                  />
                  {errors.cardHolder && <p className="mt-1 text-xs text-red-500">{errors.cardHolder}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Card Number</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" />
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => { setCardNumber(formatCardNumber(e.target.value)); setErrors((er) => ({ ...er, cardNumber: "" })); }}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 transition-all font-mono ${errors.cardNumber ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-sky-200 focus:border-sky-400"}`}
                    />
                  </div>
                  {errors.cardNumber && <p className="mt-1 text-xs text-red-500">{errors.cardNumber}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expiry Date</label>
                    <input
                      type="text"
                      value={expiry}
                      onChange={(e) => { setExpiry(formatExpiry(e.target.value)); setErrors((er) => ({ ...er, expiry: "" })); }}
                      placeholder="MM/YY"
                      maxLength={5}
                      className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 transition-all font-mono ${errors.expiry ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-sky-200 focus:border-sky-400"}`}
                    />
                    {errors.expiry && <p className="mt-1 text-xs text-red-500">{errors.expiry}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">CVV</label>
                    <input
                      type="password"
                      value={cvv}
                      onChange={(e) => { setCvv(e.target.value.replace(/\D/g, "").substring(0, 4)); setErrors((er) => ({ ...er, cvv: "" })); }}
                      placeholder="•••"
                      maxLength={4}
                      className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 transition-all font-mono ${errors.cvv ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-sky-200 focus:border-sky-400"}`}
                    />
                    {errors.cvv && <p className="mt-1 text-xs text-red-500">{errors.cvv}</p>}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3">
                <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-xs text-slate-500">This is a demo payment system. No real charges are made.</p>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={handleBack}
                  disabled={processing}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-600 px-5 py-3 text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handlePayAndLaunch}
                  disabled={processing}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 hover:from-sky-600 hover:to-violet-600 text-white px-7 py-3 text-sm font-bold shadow-lg shadow-sky-300/40 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                  ) : (
                    <><Check className="w-4 h-4" /> Pay {currencySymbol}{amount.toLocaleString()} & Launch</>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Secured by Clerk Auth</span>
          <span className="flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" /> Demo payment system</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Multi-tenant isolation</span>
        </div>
      </div>
    </div>
  );
}
