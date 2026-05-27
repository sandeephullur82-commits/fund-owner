import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  Wallet,
  BarChart3,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Layers,
  Lock,
  Clock3,
  Globe,
  Database,
} from "lucide-react";

const featureItems = [
  { title: "Real-time Collection Tracking", icon: BarChart3 },
  { title: "Multi-Tenant Organizations", icon: Layers },
  { title: "Clerk Authentication", icon: ShieldCheck },
  { title: "Firestore Sync", icon: Database },
  { title: "Agent Management", icon: Users },
  { title: "Customer Wallet Tracking", icon: Wallet },
  { title: "Daily Collection Analytics", icon: Sparkles },
  { title: "Mobile Friendly", icon: Globe },
  { title: "Offline Ready", icon: Clock3 },
];

const workflowSteps = [
  "Organization Registration",
  "Create Organization",
  "Invite Agents",
  "Invite Customers",
  "Daily Collections",
  "Realtime Sync",
  "Analytics Dashboard",
  "Settlement Reports",
];

const trustMetrics = [
  { label: "Organizations", value: "1.2K+" },
  { label: "Agents", value: "8.4K+" },
  { label: "Collections", value: "95K+" },
  { label: "Transactions", value: "420K+" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const handleNavbarSignIn = () => {
    navigate("/sign-in");
  };

  const handleRoleCardLogin = (_role: string) => {
    navigate("/sign-in");
  };

  const handleSignupIntent = () => {
    navigate("/sign-up");
  };

  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[580px] overflow-hidden">
        <div className="absolute left-[-140px] top-10 h-64 w-64 rounded-full bg-sky-200/60 blur-[120px]" />
        <div className="absolute right-[-120px] top-32 h-72 w-72 rounded-full bg-violet-200/60 blur-[140px]" />
        <div className="absolute left-[35%] top-16 h-72 w-72 rounded-full bg-slate-100/90 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-20 px-4 py-10 sm:px-6 lg:px-10">
        <header className="relative z-10 flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white/90 px-6 py-5 shadow-xl shadow-slate-200/60 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-3xl bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-lg shadow-sky-200/40">
              FC
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500">FundCircle</p>
              <p className="text-base font-semibold text-slate-950">Enterprise collection platform</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-5 text-sm text-slate-600">
            {[
              { label: "Features", href: "#features" },
              { label: "Pricing", href: "#pricing" },
              { label: "About", href: "#workflow" },
              { label: "Contact", href: "#footer" },
            ].map((item) => (
              <a key={item.label} href={item.href} className="transition hover:text-slate-900">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleNavbarSignIn}
              className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Sign In
            </button>
            <button
              onClick={handleSignupIntent}
              className="rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-200/40 transition hover:brightness-105"
            >
              Get Started
            </button>
          </div>
        </header>

        <main className="relative z-10 flex flex-col gap-20">
          <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100/80 px-4 py-2 text-sm text-slate-700">
                <Sparkles className="h-4 w-4 text-sky-500" />
                Premium workflow for modern collections
              </div>

              <div className="max-w-2xl space-y-6">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Modern Pigmy Collection Platform for Financial Organizations
                </h1>
                <p className="text-lg leading-8 text-slate-600 sm:text-xl">
                  Manage pigmy collections, customers, collectors, analytics, and savings operations in one real-time platform.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  onClick={handleSignupIntent}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-sky-200/40 transition hover:brightness-105"
                >
                  Start Free Trial
                </button>
                <button
                  onClick={handleNavbarSignIn}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Sign In
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Realtime stats", value: "99.9% uptime" },
                  { label: "Collection speed", value: "+42% efficiency" },
                  { label: "Agent retention", value: "8.4k active" },
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm shadow-slate-200/40">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-xl font-semibold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              className="relative mx-auto w-full max-w-3xl"
            >
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-sky-100 via-white to-violet-100 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
                <div className="absolute right-6 top-6 h-16 w-16 rounded-full bg-sky-100/80 blur-3xl" />
                <div className="absolute left-6 top-24 h-24 w-24 rounded-full bg-violet-100/80 blur-3xl" />
                <div className="relative rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5 shadow-sm shadow-slate-200/40">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">FundCircle Dashboard</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">Collection performance</p>
                    </div>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">Live</span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.75rem] bg-white p-5 shadow-sm shadow-slate-200/40">
                      <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
                        <span>Collection graph</span>
                        <span className="text-sky-600">+24%</span>
                      </div>
                      <div className="h-40 rounded-[1.5rem] bg-gradient-to-br from-sky-50 to-violet-50" />
                    </div>
                    <div className="space-y-4">
                      {[
                        { label: "Live collections", value: "62" },
                        { label: "Pending visits", value: "14" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-[1.75rem] bg-white p-5 shadow-sm shadow-slate-200/40">
                          <p className="text-sm text-slate-500">{item.label}</p>
                          <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    {[
                      { name: "Agent activity", value: "18" },
                      { name: "Transactions", value: "3.7K" },
                      { name: "Savings", value: "?128K" },
                    ].map((stat) => (
                      <div key={stat.name} className="rounded-[1.75rem] bg-slate-50 px-4 py-4 text-center shadow-sm shadow-slate-200/40">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{stat.name}</p>
                        <p className="mt-3 text-xl font-semibold text-slate-950">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          <section id="roles" className="space-y-8">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.35em] text-sky-500">Choose Your Workspace</p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">Select the role that fits your team.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                FundCircle uses a single Clerk authentication gateway for every workspace, keeping your organization, agents, and customers on the same secure platform.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  role: "owner",
                  title: "Owner",
                  subtitle: "Organization Management Portal",
                  description: "Manage pigmy collectors, customers, savings collections, analytics, and organization operations.",
                  icon: Building2,
                  gradient: "from-sky-500 to-blue-300",
                  cta: "Login",
                },
                {
                  role: "pigmy_collector",
                  title: "Pigmy Collector",
                  subtitle: "Field Collection Workspace",
                  description: "Track customer collections, daily visits, pending payments, and assigned collection areas.",
                  icon: Users,
                  gradient: "from-indigo-400 to-violet-300",
                  cta: "Login",
                },
                {
                  role: "customer",
                  title: "Customer",
                  subtitle: "Customer Savings Portal",
                  description: "Track savings history, payment records, daily collections, and financial progress.",
                  icon: Wallet,
                  gradient: "from-violet-300 to-fuchsia-300",
                  cta: "Login",
                },
              ].map((card) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40 transition hover:-translate-y-1 hover:border-slate-300"
                >
                  <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.gradient}`} />
                  <div className="relative flex h-full flex-col gap-5">
                    <div className={`inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br ${card.gradient} text-white shadow-lg shadow-slate-200/40`}>
                      <card.icon className="h-7 w-7" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-semibold text-slate-950">{card.title}</h3>
                      <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{card.subtitle}</p>
                      <p className="text-sm leading-6 text-slate-600">{card.description}</p>
                    </div>
                    <div className="mt-auto flex flex-col gap-3">
                      <button
                        onClick={() => handleRoleCardLogin(card.role)}
                        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105"
                      >
                        {card.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </button>
                      {card.role === "owner" && (
                        <button
                          onClick={handleSignupIntent}
                          className="inline-flex justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                        >
                          Register Organization
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section id="features" className="space-y-8">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.35em] text-sky-500">Features</p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">Everything your finance team needs to move faster.</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {featureItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.45, delay: index * 0.05 }}
                    className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40 transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-50 text-sky-600 shadow-sm shadow-slate-200/40">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                  </motion.div>
                );
              })}
            </div>
          </section>

          <section id="workflow" className="space-y-8">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.35em] text-sky-500">Platform Flow</p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">Enterprise workflow designed for daily collections.</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40">
                <div className="relative pl-10">
                  <div className="absolute left-5 top-4 h-full w-1 rounded-full bg-slate-200/50" />
                  {workflowSteps.map((step, index) => (
                    <div key={step} className="relative mb-8 flex items-start gap-4 last:mb-0">
                      <div className="relative z-10 mt-1 h-5 w-5 rounded-full bg-sky-100 ring-1 ring-sky-200" />
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{step}</p>
                        <p className="mt-1 text-sm text-slate-500">Step {index + 1} in the FundCircle flow.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-5 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 shadow-lg shadow-slate-200/40">
                <div className="rounded-[1.75rem] bg-white p-6 shadow-sm shadow-slate-200/40">
                  <p className="text-sm uppercase tracking-[0.35em] text-sky-500">How it works</p>
                  <h3 className="mt-4 text-2xl font-semibold text-slate-950">Fast onboarding for modern finance teams.</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    From organization setup to agent and customer onboarding, FundCircle keeps every collection step synced with Clerk and Firestore for secure enterprise operations.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { label: "Secure login", icon: Lock },
                    { label: "Realtime sync", icon: ShieldCheck },
                    { label: "Fast reporting", icon: BarChart3 },
                    { label: "Cloud ready", icon: Globe },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-4 rounded-3xl bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
                      <item.icon className="h-6 w-6 text-sky-500" />
                      <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="trust" className="space-y-8">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.35em] text-sky-500">Trust</p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">Built on trusted enterprise security and cloud infrastructure.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                FundCircle combines Clerk authentication, Firestore persistence, and secure cloud sync to power your financial collection operations at scale.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { title: "Enterprise Security", icon: ShieldCheck },
                { title: "Cloud Infrastructure", icon: Database },
                { title: "Multi-device Support", icon: Globe },
              ].map((item) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5 }}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-50 text-sky-600 shadow-sm shadow-slate-200/40">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Secure by design with modern authentication and enterprise-grade operational intelligence.
                  </p>
                </motion.div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {trustMetrics.map((metric) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45 }}
                  className="rounded-[1.75rem] bg-white p-6 text-center shadow-lg shadow-slate-200/40"
                >
                  <p className="text-3xl font-semibold text-slate-950">{metric.value}</p>
                  <p className="mt-3 text-sm uppercase tracking-[0.24em] text-slate-500">{metric.label}</p>
                </motion.div>
              ))}
            </div>
          </section>

          <section id="cta" className="rounded-[2.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-sky-50 p-8 shadow-lg shadow-slate-200/40">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.35em] text-sky-500">Start Managing Collections Smarter</p>
                <h2 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">Start Managing Collections Smarter</h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                  Launch your enterprise collection workflow with secure Clerk authentication, Firestore sync, and polished agent/customer experiences.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleSignupIntent}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-sky-200/40 transition hover:brightness-105"
                >
                  Create Organization
                </button>
                <button
                  onClick={() => window.alert("Book a demo with FundCircle team")}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Book Demo
                </button>
              </div>
            </div>
          </section>
        </main>

        <footer id="footer" className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/40">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-sky-500">FundCircle</p>
              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">
                Simple pigmy collection workflow for daily savings, designed for enterprise teams and modern financial operations.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-950">Product</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>Features</li>
                <li>Integrations</li>
                <li>Security</li>
                <li>Updates</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-950">Company</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>About</li>
                <li>Careers</li>
                <li>Press</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-950">Support</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>Help Center</li>
                <li>Documentation</li>
                <li>Terms</li>
                <li>Privacy</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-500">
            � 2026 FundCircle
          </div>
        </footer>
      </div>
    </div>
  );
}
