import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { getCurrentUser, logout } from "../utils/auth";
import { api, endpoints } from "../services/api.js";
import PatientListCard from "../components/PatientListCard";

export default function DoctorDashboard() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 1. Authentication & Role Check Guard
  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (user.role !== "doctor") {
      navigate("/patient", { replace: true });
      return;
    }
  }, [user, navigate]);

  // 2. Data Fetching with Cleanup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        if (!cancelled) setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const dashboard = await api.get(endpoints.dashboard.doctor(user.id));
        const rows = Array.isArray(dashboard?.patients) ? dashboard.patients : [];
        if (!cancelled) setPatients(rows);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load doctor dashboard.");
        
        // Safety catch: If token is expired (401), force log out
        if (err.message.includes("401") || err.message.includes("403")) {
          logout();
          navigate("/login", { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate]);

  // 3. Logout Handler
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Prevent UI flash while redirecting unauthorized users
  if (!user || user.role !== "doctor") return null;

  return (
    <AppShell title="Doctor Panel" subtitle="Patient adherence overview">
      
      {/* Top Banner with Sign Out Button */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Welcome, {user?.full_name || "Doctor"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Review your patients' progress today.</p>
        </div>
        
        <button 
          onClick={handleLogout}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-rose-600"
        >
          Sign out
        </button>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Patients</h2>
        <p className="mt-1 text-sm text-slate-500">
          Real-time adherence snapshot based on today's logged doses.
        </p>
        
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        
        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 text-center animate-pulse">
            Loading patient data...
          </div>
        ) : patients.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {patients.map((patient) => (
              <PatientListCard key={patient.patient_id} patient={patient} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 text-center">
            No patient accounts available yet.
          </div>
        )}
      </section>
    </AppShell>
  );
}