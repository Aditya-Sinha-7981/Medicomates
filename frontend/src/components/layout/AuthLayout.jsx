import HealthcareLogo from "../branding/HealthcareLogo";

export default function AuthLayout({ children }) {
  return (
    <main className="min-h-screen bg-[#e9eef7] px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 items-center gap-6 md:grid-cols-2">
          <section className="rounded-[22px] border border-slate-100 bg-white/85 p-4 shadow-sm md:hidden">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                <HealthcareLogo iconClassName="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">MedicoMates</p>
                <p className="text-xs text-slate-500">Healthcare Dashboard</p>
              </div>
            </div>
          </section>
          <section className="hidden rounded-2xl border border-slate-100 bg-white p-8 shadow-sm md:flex md:flex-col md:justify-between">
            <div>
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                <HealthcareLogo iconClassName="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">MedicoMates</h1>
              <p className="mt-2 text-sm text-slate-500">
                Calm, readable medication care dashboards for patients and doctors.
              </p>
            </div>
            <p className="text-xs text-slate-400">Designed for clarity, consistency, and trust.</p>
          </section>
          <section className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.10)] md:col-start-2 md:p-8">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}

