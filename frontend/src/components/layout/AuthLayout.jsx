export default function AuthLayout({ children }) {
  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="hidden rounded-2xl border border-slate-100 bg-white p-8 shadow-sm md:flex md:flex-col md:justify-between">
            <div>
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 2h6v4h4v6h-4v4H9v-4H5V6h4z" />
                  <path d="M12 8c-1.6-2-4-1.7-5.1-.2-1.3 1.8-.7 4.1.8 5.6L12 17l4.3-3.6c1.5-1.5 2.1-3.8.8-5.6-1.1-1.5-3.5-1.8-5.1.2Z" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">MedicoMates</h1>
              <p className="mt-2 text-sm text-slate-500">
                Calm, readable medication care dashboards for patients and doctors.
              </p>
            </div>
            <p className="text-xs text-slate-400">Designed for clarity, consistency, and trust.</p>
          </section>
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}

