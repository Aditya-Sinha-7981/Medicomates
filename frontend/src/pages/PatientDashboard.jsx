import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { HeartPulse, LogOut, Sparkles, UserPlus2, ClipboardList } from "lucide-react";
import AdherenceCalendar from "../components/AdherenceCalendar";
import MedicineCard from "../components/MedicineCard";
import useAuth from "../hooks/useAuth";
import usePatientData from "../hooks/usePatientData";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/ToastContext";
import AppShell from "../components/layout/AppShell";

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const {
    dashboard,
    doctors,
    visits,
    adherenceLogs,
    loading,
    error,
    refresh,
    markDoseTaken,
    markDoseUntaken,
    cancelMedicine,
  } = usePatientData();
  const { showToast } = useToast();

  const [cancelTarget, setCancelTarget] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [untakeTarget, setUntakeTarget] = useState(null);

  const recentVisits = useMemo(() => (visits || []).slice(0, 3), [visits]);
  const todayDoseCount = useMemo(
    () =>
      (dashboard?.todays_medicines || []).reduce(
        (sum, medicine) => sum + (medicine.statuses?.length || 0),
        0
      ),
    [dashboard]
  );
  const takenDoseCount = useMemo(
    () =>
      (dashboard?.todays_medicines || []).reduce(
        (sum, medicine) =>
          sum +
          (medicine.statuses || []).filter((statusItem) => statusItem.status === "taken").length,
        0
      ),
    [dashboard]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 p-4 md:p-8">
          <div className="h-36 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="h-24 rounded-3xl bg-slate-100 animate-pulse" />
            <div className="h-24 rounded-3xl bg-slate-100 animate-pulse" />
            <div className="h-24 rounded-3xl bg-slate-100 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="h-64 rounded-3xl bg-slate-100 animate-pulse md:col-span-2" />
            <div className="h-64 rounded-3xl bg-slate-100 animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={refresh} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  const todayLabel = format(new Date(), "EEEE, d MMMM");
  const initials =
    dashboard?.profile?.full_name
      ?.split(" ")
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join("") || "PT";

  const handleConfirmCancel = () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    cancelMedicine(cancelTarget.id);
    setIsCancelling(false);
    setCancelTarget(null);
    showToast({
      message: "Medicine cancelled for future reminders.",
      variant: "success",
    });
  };

  const handleUntakeConfirmed = () => {
    if (!untakeTarget) return;
    markDoseUntaken(untakeTarget.medicineId, untakeTarget.time);
    showToast({
      message: "Dose marked as not taken.",
      variant: "success",
    });
    setUntakeTarget(null);
  };

  return (
    <AppShell
      title="Patient Dashboard"
      subtitle={todayLabel}
      actions={
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      }
    >
      <div className="space-y-6 md:space-y-7">
          <motion.header
            className="relative overflow-hidden rounded-[30px] border border-sky-100 bg-gradient-to-br from-sky-600 via-sky-500 to-sky-700 px-5 py-5 md:px-7 md:py-7 text-white shadow-[0_26px_70px_rgba(15,23,42,0.65)]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3 md:gap-4">
                <div className="flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-2xl bg-sky-50/15 text-lg font-semibold text-sky-50 backdrop-blur-sm border border-sky-200/30">
                  {initials}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.23em] text-sky-100/80">
                    Today • {todayLabel}
                  </p>
                  <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
                    Good to see you, {dashboard?.profile?.full_name || "patient"}
                  </h1>
                  <p className="mt-1 flex items-center gap-2 text-xs md:text-sm text-sky-50/90">
                    <HeartPulse className="h-4 w-4" />
                    <span>
                      Small, consistent doses make the biggest difference. We’ll keep track for you.
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="rounded-2xl bg-sky-50/15 px-3 py-2 text-[11px] md:text-xs text-sky-50 shadow-sm shadow-sky-900/30 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    Weekly adherence:{" "}
                    <span className="font-semibold">
                      {dashboard?.weekly_percentage ?? 0}
                      %
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </motion.header>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <motion.div
              className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Weekly adherence
              </p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-semibold text-slate-900">
                  {dashboard?.weekly_percentage ?? 0}%
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Based on all doses taken vs. scheduled in the last 30 days.
              </p>
            </motion.div>

            <motion.div
              className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4 md:p-5 shadow-[0_14px_40px_rgba(4,120,87,0.20)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700/80">
                Doses today
              </p>
              <div className="mt-2 flex items-end gap-2 text-emerald-800">
                <span className="text-3xl font-semibold">
                  {takenDoseCount}/{todayDoseCount}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-emerald-800/80">
                Tap “Mark taken” once the dose is completed to keep this accurate.
              </p>
            </motion.div>

            <motion.div
              className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Today&apos;s focus
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Stay close to your usual routine. If a time doesn’t work anymore, update your
                schedule so reminders feel natural.
              </p>
            </motion.div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="flex flex-col gap-5 lg:col-span-8">
              <section className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => navigate("/medicine/new")}
                  className="flex-1 rounded-full bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_45px_rgba(37,99,235,0.55)] transition hover:bg-sky-700"
                >
                  + Add medicine
                </button>
                <button
                  onClick={() => navigate("/notes")}
                  className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Message my doctor
                </button>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white/80 p-5 md:p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base md:text-lg font-semibold text-slate-900">
                    Today&apos;s schedule
                  </h2>
                  <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                    {(dashboard?.todays_medicines || []).length} medicine
                    {((dashboard?.todays_medicines || []).length || 0) === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {(dashboard?.todays_medicines || []).length ? (
                    dashboard.todays_medicines.map((medicine) => (
                      <MedicineCard
                        key={medicine.medicine_id}
                        medicine={medicine}
                        onMarkTaken={markDoseTaken}
                        onToggleTaken={(medicineId, time) =>
                          setUntakeTarget({ medicineId, time, name: medicine.name })
                        }
                        onCancel={() =>
                          setCancelTarget({ id: medicine.medicine_id, name: medicine.name })
                        }
                        isCancelling={isCancelling && cancelTarget?.id === medicine.medicine_id}
                      />
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No medicines scheduled for today. When you add a plan, it will appear here
                      with gentle reminders.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="flex flex-col gap-5 lg:col-span-4">
              <section className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <AdherenceCalendar logs={adherenceLogs} />
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <h2 className="mb-3 text-sm md:text-base font-semibold text-slate-900">
                  Connected doctors
                </h2>
                {doctors.length ? (
                  <ul className="space-y-3">
                    {doctors.map((doctor) => (
                      <li
                        key={doctor.doctor_id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3.5 py-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-sm font-semibold text-sky-700">
                          {doctor.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {doctor.full_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Connected since{" "}
                            {new Date(doctor.connected_at).toLocaleDateString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-[13px] text-slate-500">
                    <div className="mb-2 flex items-center gap-2 font-medium text-slate-700">
                      <UserPlus2 className="h-4 w-4 text-slate-400" />
                      No connected doctors yet
                    </div>
                    Connect with your doctor to share adherence updates and notes.
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <h2 className="mb-3 text-sm md:text-base font-semibold text-slate-900">
                  Recent visits
                </h2>
                {recentVisits.length ? (
                  <ul className="space-y-3">
                    {recentVisits.map((visit) => (
                      <li
                        key={visit.id}
                        className="relative border-l-2 border-sky-100 pl-4 text-sm text-slate-700"
                      >
                        <span className="absolute left-[-5px] top-1 h-2 w-2 rounded-full bg-sky-500" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-500">
                          {new Date(visit.visit_date).toLocaleDateString()}
                        </p>
                        <p className="mt-0.5 font-semibold">{visit.doctor_name}</p>
                        <p className="text-[13px] text-slate-500">{visit.summary}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-[13px] text-slate-500">
                    <div className="mb-2 flex items-center gap-2 font-medium text-slate-700">
                      <ClipboardList className="h-4 w-4 text-slate-400" />
                      No visits yet
                    </div>
                    Your visit history will appear after your care team logs consultations.
                  </div>
                )}
              </section>
            </div>
          </div>
      </div>

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel medicine?"
      >
        <p className="text-sm text-slate-600">
          This will stop future reminders for{" "}
          <span className="font-semibold">{cancelTarget?.name}</span>. Past doses will stay in your
          history.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setCancelTarget(null)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Keep medicine
          </button>
          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={isCancelling}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
          >
            {isCancelling ? "Cancelling..." : "Cancel medicine"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!untakeTarget}
        onClose={() => setUntakeTarget(null)}
        title="Mark as not taken?"
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to mark this dose of{" "}
          <span className="font-semibold">{untakeTarget?.name}</span> as not taken?
        </p>
        <p className="mt-2 text-xs text-slate-500">
          This is useful if you tapped &ldquo;Mark taken&rdquo; by mistake.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setUntakeTarget(null)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Keep as taken
          </button>
          <button
            type="button"
            onClick={handleUntakeConfirmed}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Mark as not taken
          </button>
        </div>
      </Modal>
    </AppShell>
  );
}
