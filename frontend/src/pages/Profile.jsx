import BottomNav from "../components/BottomNav";
import useAuth from "../hooks/useAuth";
import { getCurrentUser } from "../utils/auth";

export default function Profile() {
  const { logout } = useAuth();
  const user = getCurrentUser();

  return (
    <main className="min-h-screen bg-[#f3f6fb] pb-24 md:pb-0 md:pl-24 font-sans text-slate-800">
      <div className="w-full max-w-3xl mx-auto p-4 md:p-8">
        <section className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm p-6 md:p-8">
          <h1 className="m-0 text-3xl font-extrabold text-slate-800">Profile</h1>
          <p className="text-gray-500 mt-2">Your account information</p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Name</div>
              <div className="text-lg font-bold text-slate-800 mt-1">
                {user?.full_name || user?.name || "-"}
              </div>
            </div>
            <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Email</div>
              <div className="text-lg font-bold text-slate-800 mt-1">{user?.email || "-"}</div>
            </div>
            <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Role</div>
              <div className="text-lg font-bold text-slate-800 mt-1">{user?.role || "-"}</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="mt-8 h-12 rounded-xl px-6 bg-[#2a79e8] text-white font-bold hover:bg-blue-700 transition-colors"
          >
            Logout
          </button>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
