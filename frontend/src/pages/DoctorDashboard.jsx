import { useMemo } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { getCurrentUser } from "../utils/auth";

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getDateKey = (date) => date.toISOString().slice(0, 10);

export default function DoctorDashboard() {
  const user = getCurrentUser();
  const users = safeParse(localStorage.getItem("medicomates_users"), []);
  const medicines = safeParse(localStorage.getItem("medicomates_medicines"), []);
  const doseLogs = safeParse(localStorage.getItem("medicomates_dose_logs"), []);

  const patients = users.filter((entry) => entry.role === "patient");
  const todayKey = getDateKey(new Date());

  const patientStats = useMemo(
    () =>
      patients.map((patient) => {
        const patientMeds = medicines.filter(
          (medicine) => medicine.patient_id === patient.id && medicine.is_active !== false
        );
        const totalToday = patientMeds.reduce(
          (sum, med) => sum + (med.reminder_times?.length || 0),
          0
        );
        const takenToday = doseLogs.filter(
          (log) =>
            log.patient_id === patient.id && log.date === todayKey && log.status === "taken"
        ).length;
        const adherence = totalToday ? Math.round((takenToday / totalToday) * 100) : 0;
        return { ...patient, adherence, totalToday, takenToday };
      }),
    [doseLogs, medicines, patients, todayKey]
  );

  return (
    <AppShell title={`Dr. ${user?.full_name || "Dashboard"}`} subtitle="Patient adherence overview">
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Patients</h2>
        <p className="mt-1 text-sm text-slate-500">
          Real-time adherence snapshot based on today&apos;s logged doses.
        </p>

        {patientStats.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {patientStats.map((patient) => (
              <div key={patient.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">{patient.full_name}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {patient.adherence}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {patient.takenToday}/{patient.totalToday} doses taken today
                </p>
                <Link
                  to={`/patient-profile/${patient.id}`}
                  className="mt-3 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  View profile
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No patient accounts available yet.
          </div>
        )}
      </section>
    </AppShell>
  );
}

