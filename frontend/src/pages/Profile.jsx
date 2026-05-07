import AppShell from "../components/layout/AppShell";
import useAuth from "../hooks/useAuth";
import { getCurrentUser } from "../utils/auth";
import { Mail, Shield } from "lucide-react";

export default function Profile() {
  const { logout } = useAuth();
  const user = getCurrentUser();

  return (
    <AppShell title="Profile" subtitle="Your account details">
      <div className="max-w-3xl">
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Personal Information</h2>
          <p className="mt-1 text-sm text-slate-500">Used for dashboard personalization.</p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Name</p>
              <p className="mt-1 text-base font-semibold text-slate-800">
                {user?.full_name || user?.name || "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                Email
              </p>
              <p className="mt-1 text-base font-semibold text-slate-800">{user?.email || "-"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                Role
              </p>
              <p className="mt-1 text-base font-semibold text-slate-800 capitalize">{user?.role || "-"}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="mt-8 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Logout
          </button>
        </section>
      </div>
    </AppShell>
  );
}
