import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, HeartPulse, Flame } from "lucide-react";
import { motion } from "framer-motion";
import AppShell from "../components/layout/AppShell";
import AdherenceCalendar from "../components/AdherenceCalendar";
import InsightCard from "../components/InsightCard";
import VisitTimeline from "../components/VisitTimeline";
import { api, endpoints } from "../services/api.js";
import { format } from "date-fns";
import { ADHERENCE_ATTENTION_THRESHOLD } from "../utils/adherenceThreshold";

export default function ReviewerView() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [dashRes, medsRes, visitsRes] = await Promise.all([
          api.get(endpoints.dashboard.reviewer(patientId)),
          api.get(endpoints.medicines.list(patientId)),
          api.get(endpoints.visits.list(patientId))
        ]);
        setDashboard(dashRes);
        setMedicines(Array.isArray(medsRes) ? medsRes : []);
        setVisits(Array.isArray(visitsRes) ? visitsRes : []);
      } catch (err) {
        setError(err.message || "Failed to load patient data.");
      } finally {
        setLoading(false);
      }
    }
    if (patientId) {
      fetchData();
    }
  }, [patientId]);

  const recentVisits = useMemo(() => (visits || []).slice(0, 3), [visits]);
  const todayDoseCount = useMemo(
    () => (dashboard?.todays_medicines || []).reduce(
      (sum, medicine) => sum + (medicine.statuses?.length || 0), 0
    ), [dashboard]
  );
  const takenDoseCount = useMemo(
    () => (dashboard?.todays_medicines || []).reduce(
      (sum, medicine) => sum + (medicine.statuses || []).filter((s) => s.status === "taken").length, 0
    ), [dashboard]
  );

  const weeklyPct = useMemo(() => Number(dashboard?.weekly_percentage ?? 0), [dashboard?.weekly_percentage]);
  const weeklyNeedsAttention = weeklyPct < ADHERENCE_ATTENTION_THRESHOLD;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 p-4 md:p-8">
          <div className="h-36 rounded-3xl bg-slate-200 animate-pulse" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
             <div className="h-24 rounded-3xl bg-slate-200 animate-pulse" />
             <div className="h-24 rounded-3xl bg-slate-200 animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <AppShell title="Reviewer Access" subtitle="Patient Profile">
        <div className="p-6 text-center">
          <p className="text-rose-500 mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
            Go Back
          </button>
        </div>
      </AppShell>
    );
  }

  const todayLabel = format(new Date(), "EEEE, d MMMM");
  const initials = dashboard?.profile?.full_name?.split(" ").map((p) => p.charAt(0)).slice(0, 2).join("") || "PT";

  return (
    <AppShell
      title="Reviewer View"
      subtitle="Read-only access"
      actions={
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      }
    >
      <div className="space-y-6 md:space-y-7">
        <motion.header
          className="relative overflow-hidden rounded-[30px] border border-white/20 bg-gradient-to-br from-brand via-brand-hover to-accent px-5 py-5 text-white shadow-sm md:px-7 md:py-7"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        >
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-lg font-semibold text-white backdrop-blur-sm">
                {initials}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.23em] text-white/80">
                  Viewing • {todayLabel}
                </p>
                <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
                  {dashboard?.profile?.full_name || "Patient"}
                </h1>
                {dashboard?.profile?.allergies && (
                  <p className="mt-2 text-xs md:text-sm text-white/90">
                    Allergies: <span className="font-medium text-white">{dashboard.profile.allergies}</span>
                  </p>
                )}
                <p className="mt-1 flex items-center gap-2 text-xs md:text-sm text-white/90">
                  <HeartPulse className="h-4 w-4" />
                  Read-only reviewer mode
                </p>
              </div>
            </div>
          </div>
        </motion.header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <motion.div
            className={`rounded-3xl border p-4 md:p-5 shadow-sm ${
              weeklyNeedsAttention
                ? "border-rose-200 bg-rose-50/90"
                : "border-slate-100 bg-white/80"
            }`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                weeklyNeedsAttention ? "text-rose-700/90" : "text-slate-500"
              }`}
            >
              Weekly adherence
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span
                className={`text-3xl font-semibold ${
                  weeklyNeedsAttention ? "text-rose-900" : "text-slate-900"
                }`}
              >
                {weeklyPct}%
              </span>
            </div>
          </motion.div>

          <motion.div className="rounded-3xl border border-accent-soft-border bg-accent-soft/80 p-4 shadow-sm md:p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-hover/90">Doses today</p>
            <div className="mt-2 flex items-end gap-2 text-accent-hover">
              <span className="text-3xl font-semibold">{takenDoseCount}/{todayDoseCount}</span>
            </div>
          </motion.div>

          <motion.div className="rounded-3xl border border-amber-100 bg-amber-50/80 p-4 md:p-5 shadow-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800/80 flex items-center gap-1.5"><Flame className="h-3.5 w-3.5" /> Streak</p>
            <div className="mt-2 flex items-end gap-2 text-amber-950">
              <span className="text-3xl font-semibold">{dashboard?.streak?.current ?? 0}</span>
            </div>
          </motion.div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 md:gap-7">
          <div className="flex flex-col gap-5 lg:col-span-8 xl:col-span-8">
            <section className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-sm">
              <h2 className="mb-4 text-sm md:text-base font-semibold text-slate-900 flex items-center justify-between">
                Today's Schedule
                <span className="text-xs font-normal text-slate-500">Read-only</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {dashboard?.todays_medicines?.length > 0 ? (
                  dashboard.todays_medicines.map((med) => (
                    <div key={med.medicine_id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <p className="font-semibold text-slate-800">{med.name}</p>
                      <p className="text-xs text-slate-500">{med.dosage}</p>
                      {med.supply_warning && med.supply_restock_message ? (
                        <p className="mt-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                          {med.supply_restock_message}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {med.statuses.map((s, idx) => (
                          <div key={idx} className={`rounded-full px-2 py-1 text-[11px] font-medium border ${s.status === 'taken' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : s.status === 'missed' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                            {s.time} - {s.status}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-sm text-slate-500">
                    No medicines scheduled for today.
                  </div>
                )}
              </div>
            </section>
            
            <section className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-sm">
              <h2 className="mb-4 text-sm md:text-base font-semibold text-slate-900">All Active Medicines</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {medicines?.length > 0 ? (
                  medicines.map((med) => (
                    <div key={med.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 flex flex-col gap-1">
                       <span className="font-semibold text-sm text-slate-800">{med.name}</span>
                       <span className="text-xs text-slate-500">{med.dosage} • {med.frequency}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No active medicines.</p>
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-4 xl:col-span-4">
            <section className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-sm">
              <AdherenceCalendar logs={dashboard?.adherence_logs || []} medicines={medicines} />
            </section>

            <InsightCard patientId={patientId} />

            <section className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-sm">
              <h2 className="mb-3 text-sm md:text-base font-semibold text-slate-900">Recent visits</h2>
              <VisitTimeline visits={recentVisits} />
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
