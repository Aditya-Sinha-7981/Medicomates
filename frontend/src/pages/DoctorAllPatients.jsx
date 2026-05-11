import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import PatientListCard from "../components/PatientListCard";
import { getCurrentUser, logout } from "../utils/auth";
import { api, endpoints } from "../services/api.js";

function sortPatientsByConnectedAt(patients) {
  return [...patients].sort((a, b) => {
    const ta = a.connected_at ? Date.parse(a.connected_at) : 0;
    const tb = b.connected_at ? Date.parse(b.connected_at) : 0;
    return tb - ta;
  });
}

export default function DoctorAllPatients() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (user.role !== "doctor") {
      navigate("/patient", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id || user.role !== "doctor") return;
      setLoading(true);
      setError("");
      try {
        const dashboard = await api.get(endpoints.dashboard.doctor(user.id));
        if (cancelled) return;
        const list = Array.isArray(dashboard?.patients) ? dashboard.patients : [];
        setPatients(sortPatientsByConnectedAt(list));
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load patients.");
          if (String(err.message).includes("401") || String(err.message).includes("403")) {
            logout();
            navigate("/login", { replace: true });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, navigate]);

  const sorted = useMemo(() => sortPatientsByConnectedAt(patients), [patients]);

  if (!user || user.role !== "doctor") return null;

  return (
    <AppShell
      title="All patients"
      subtitle="Everyone connected to your practice"
      actions={
        <button
          type="button"
          onClick={() => navigate("/doctor")}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Back to dashboard
        </button>
      }
    >
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 animate-pulse">
          Loading…
        </div>
      ) : sorted.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((patient, index) => (
            <PatientListCard key={patient.patient_id} patient={patient} index={index} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No connected patients yet.
        </p>
      )}
    </AppShell>
  );
}
