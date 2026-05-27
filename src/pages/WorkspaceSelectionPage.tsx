import { Building2, Users, Wallet } from "lucide-react";

export default function WorkspaceSelectionPage() {
  const handleSelectRole = (roleId: string) => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("preferredLoginRole", roleId);
        window.location.href = "/sign-in";
      }
    } catch (error) {
      console.error("Error selecting role:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold text-slate-950">Choose Your Workspace</h1>
            <p className="mt-3 text-lg text-slate-600">
              Select the workspace role you want to access.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-100">
                <Building2 className="h-6 w-6 text-sky-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Owner</h2>
              <p className="mt-2 text-sm text-slate-600">
                Manage organization operations, collectors, customers, analytics, and savings workflows.
              </p>
              <button
                onClick={() => handleSelectRole("owner")}
                className="mt-5 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
              >
                Continue to Sign In
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Pigmy Collector</h2>
              <p className="mt-2 text-sm text-slate-600">
                Access customer collections, daily visits, assigned areas, and collection workflows.
              </p>
              <button
                onClick={() => handleSelectRole("pigmy_collector")}
                className="mt-5 w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
              >
                Continue to Sign In
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                <Wallet className="h-6 w-6 text-violet-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Customer</h2>
              <p className="mt-2 text-sm text-slate-600">
                Track savings history, payment activity, and collection records.
              </p>
              <button
                onClick={() => handleSelectRole("customer")}
                className="mt-5 w-full rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
              >
                Continue to Sign In
              </button>
            </div>
          </div>

          <div className="mt-12 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-slate-600">
              Need to create a new organization? Click <span className="font-semibold">Get Started</span> from the landing page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
