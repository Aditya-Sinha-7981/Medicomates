import { useMemo } from "react";
import { useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getDateKey = (date) => date.toISOString().slice(0, 10);

export default function PatientProfile() {
  const { patientId } = useParams();
  const users = safeParse(localStorage.getItem("medicomates_users"), []);
  const medicines = safeParse(localStorage.getItem("medicomates_medicines"), []);
  const doseLogs = safeParse(localStorage.getItem("medicomates_dose_logs"), []);

  const patient = users.find((entry) => entry.id === patientId);

  const patientMeds = useMemo(
    () =>
      medicines.filter(
        (medicine) => medicine.patient_id === patientId && medicine.is_active !== false
      ),
    [medicines, patientId]
  );

  const todayKey = getDateKey(new Date());
  const takenToday = doseLogs.filter(
    (log) => log.patient_id === patientId && log.date === todayKey && log.status === "taken"
  ).length;

  const totalToday = patientMeds.reduce((sum, med) => sum + (med.reminder_times?.length || 0), 0);

  return (
    <AppShell title="Patient Profile" subtitle="Medication and adherence summary">
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{patient?.full_name || "Patient"}</h2>
        <p className="mt-1 text-sm text-slate-500">{patient?.email || "No email available"}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Active medicines</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{patientMeds.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Taken today</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{takenToday}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Scheduled today</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalToday}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Current medicine plan</h3>
          {patientMeds.length ? (
            <ul className="mt-3 space-y-2">
              {patientMeds.map((medicine) => (
                <li key={medicine.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">
                    {medicine.name} <span className="font-normal text-slate-500">{medicine.dosage}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {medicine.frequency} • {(medicine.reminder_times || []).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No active medicines.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

