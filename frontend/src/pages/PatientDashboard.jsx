import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { HeartPulse, LogOut, Sparkles, UserPlus2, ClipboardList, Flame, CheckCircle2, XCircle, Clock, Eye, Search, Users } from "lucide-react";
import AdherenceCalendar from "../components/AdherenceCalendar";
import MedicineCard from "../components/MedicineCard";
import useAuth from "../hooks/useAuth";
import usePatientData from "../hooks/usePatientData";
import { api, endpoints } from "../services/api.js";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/ToastContext";
import AppShell from "../components/layout/AppShell";
import AppReadyScreen from "../components/layout/AppReadyScreen";
import { ADHERENCE_ATTENTION_THRESHOLD } from "../utils/adherenceThreshold";

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const {
    dashboard,
    medicines,
    doctors,
    visits,
    adherenceLogs,
    loading,
    error,
    refresh,
    markDoseTaken,
    markDoseUntaken,
    cancelMedicine,
    incomingRequests,
    outgoingRequests,
    reviewers,
    reviewing,
  } = usePatientData();
  const { showToast } = useToast();

  const [cancelTarget, setCancelTarget] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [untakeTarget, setUntakeTarget] = useState(null);

  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

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

  const weeklyPct = useMemo(() => Number(dashboard?.weekly_percentage ?? 0), [dashboard?.weekly_percentage]);
  const weeklyNeedsAttention = weeklyPct < ADHERENCE_ATTENTION_THRESHOLD;

  const reviewingSorted = useMemo(() => {
    const list = Array.isArray(reviewing) ? reviewing : [];
    return [...list].sort((a, b) => {
      const ta = a.connected_at ? Date.parse(a.connected_at) : 0;
      const tb = b.connected_at ? Date.parse(b.connected_at) : 0;
      return tb - ta;
    });
  }, [reviewing]);

  const reviewingPreview = useMemo(() => reviewingSorted.slice(0, 4), [reviewingSorted]);



  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={refresh} className="rounded-lg bg-brand px-4 py-2 text-white hover:bg-brand-hover">
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

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await cancelMedicine(cancelTarget.id);
      setCancelTarget(null);
      showToast({
        message: "Medicine cancelled for future reminders.",
        variant: "success",
      });
    } catch (err) {
      showToast({
        message: err.message || "Failed to cancel medicine.",
        variant: "error",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAcceptRequest = async (id) => {
    try {
      await api.put(endpoints.connections.acceptRequest(id));
      showToast({ message: "Request accepted.", variant: "success" });
      refresh();
    } catch (err) {
      showToast({ message: err.message || "Failed to accept request.", variant: "error" });
    }
  };

  const handleRejectRequest = async (id) => {
    try {
      await api.put(endpoints.connections.rejectRequest(id));
      showToast({ message: "Request rejected.", variant: "success" });
      refresh();
    } catch (err) {
      showToast({ message: err.message || "Failed to reject request.", variant: "error" });
    }
  };

  const handleSearchReviewer = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setIsSearching(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const res = await api.get(endpoints.connections.search(searchEmail.trim(), "reviewer"));
      setSearchResult(res);
    } catch (err) {
      setSearchError(err.message || "User not found or cannot be added.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendReviewerRequest = async () => {
    if (!searchResult) return;
    setSendingRequest(true);
    try {
      await api.post(endpoints.connections.request(), {
        to_email: searchEmail.trim(),
        type: "reviewer"
      });
      setSearchResult(null);
      setSearchEmail("");
      showToast({ message: "Reviewer request sent.", variant: "success" });
      refresh();
    } catch (err) {
      setSearchError(err.message || "Failed to send request.");
    } finally {
      setSendingRequest(false);
    }
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
    <AppReadyScreen isReady={!loading}>
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
            className="relative overflow-hidden rounded-[30px] border border-white/20 bg-gradient-to-br from-brand via-brand-hover to-accent px-5 py-5 text-white shadow-[0_26px_70px_rgba(15,23,42,0.65)] md:px-7 md:py-7"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3 md:gap-4">
                <div className="flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-lg font-semibold text-white backdrop-blur-sm">
                  {initials}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.23em] text-white/80">
                    Today • {todayLabel}
                  </p>
                  <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
                    Good to see you, {dashboard?.profile?.full_name || "patient"}
                  </h1>
                  {dashboard?.profile?.allergies ? (
                    <p className="mt-2 text-xs md:text-sm text-white/90">
                      Allergies:{" "}
                      <span className="font-medium text-white">{dashboard.profile.allergies}</span>
                    </p>
                  ) : null}
                  <p className="mt-1 flex items-center gap-2 text-xs md:text-sm text-white/90">
                    <HeartPulse className="h-4 w-4" />
                    <span>
                      Small, consistent doses make the biggest difference. We’ll keep track for you.
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div
                  className={`rounded-2xl px-3 py-2 text-[11px] md:text-xs shadow-sm shadow-black/25 flex items-center gap-1.5 ${
                    weeklyNeedsAttention
                      ? "bg-rose-500/30 text-rose-50 ring-1 ring-rose-200/50"
                      : "bg-white/15 text-white"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Weekly adherence:{" "}
                    <span className="font-semibold">
                      {weeklyPct}%
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </motion.header>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <motion.div
              className={`rounded-3xl border p-4 md:p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)] ${
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
              <p className={`mt-2 text-[11px] ${weeklyNeedsAttention ? "text-rose-800/90" : "text-slate-400"}`}>
                From your dashboard summary (this week vs. scheduled doses).
              </p>
            </motion.div>

            <motion.div
              className="rounded-3xl border border-accent-soft-border bg-accent-soft/80 p-4 shadow-[0_14px_40px_rgba(4,120,87,0.15)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(4,120,87,0.2)] md:p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-hover/90">
                Doses today
              </p>
              <div className="mt-2 flex items-end gap-2 text-accent-hover">
                <span className="text-3xl font-semibold">
                  {takenDoseCount}/{todayDoseCount}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-accent-hover/85">
                Tap “Mark taken” once the dose is completed to keep this accurate.
              </p>
            </motion.div>

            <motion.div
              className="rounded-3xl border border-amber-100 bg-amber-50/80 p-4 md:p-5 shadow-[0_14px_40px_rgba(180,83,9,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(180,83,9,0.18)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800/80 flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" />
                Streak
              </p>
              <div className="mt-2 flex items-end gap-2 text-amber-950">
                <span className="text-3xl font-semibold">
                  {dashboard?.streak?.current ?? 0}
                </span>
                <span className="text-sm font-medium text-amber-800/90 pb-1">
                  best {dashboard?.streak?.best ?? 0}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-amber-900/80">
                Consecutive days with all scheduled doses confirmed.
              </p>
            </motion.div>

            <motion.div
              className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.10)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Last week
              </p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-semibold text-slate-900">
                  {dashboard?.last_week_percentage ?? 0}%
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Compare with this week&apos;s{" "}
                <span className="font-semibold text-slate-800">
                  {dashboard?.weekly_percentage ?? 0}%
                </span>{" "}
                to spot trends early.
              </p>
            </motion.div>
          </section>

          {reviewingSorted.length > 0 ? (
            <section className="rounded-3xl border border-brand-soft-border bg-gradient-to-br from-brand-soft via-white to-accent-soft/50 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 md:text-lg">
                      People I&apos;m reviewing
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Latest connections first. Use <span className="font-medium">Reviewing</span> in the
                      nav for the full list.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-col sm:items-end">
                  <span className="inline-flex w-fit shrink-0 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-slate-800">
                    Showing {Math.min(4, reviewingSorted.length)} of {reviewingSorted.length}
                  </span>
                  <Link
                    to="/reviewing"
                    className="text-xs font-semibold text-brand hover:text-brand-hover sm:text-right"
                  >
                    View all
                  </Link>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {reviewingPreview.map((pat) => (
                  <div
                    key={pat.patient_id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-brand-soft-border bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-sm font-semibold text-slate-800">
                        {(pat.full_name || "P").charAt(0)}
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-900">{pat.full_name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/review/${pat.patient_id}`)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="flex flex-col gap-5 lg:col-span-8">
              <section className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => navigate("/medicine/new")}
                  className="flex-1 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-brand-glow transition-all duration-300 hover:bg-brand-hover hover:scale-[1.02] active:scale-[0.98]"
                >
                  + Add medicine
                </button>
                <button
                  onClick={() => navigate("/notes")}
                  className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98]"
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
                    dashboard.todays_medicines.map((medicine, index) => (
                      <motion.div
                        key={medicine.medicine_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
                      >
                        <MedicineCard
                        medicine={medicine}
                        onMarkTaken={(medicineId, time) => {
                          markDoseTaken(medicineId, time);
                          showToast({
                            message: "Dose marked as taken.",
                            variant: "success",
                          });
                        }}
                        onToggleTaken={(medicineId, time) =>
                          setUntakeTarget({ medicineId, time, name: medicine.name })
                        }
                        onEdit={() => {
                          const fullMedicine = (medicines || []).find(
                            (entry) => entry.id === medicine.medicine_id
                          );
                          navigate("/medicines", {
                            state: { medicine: fullMedicine || medicine },
                          });
                        }}
                        onCancel={() =>
                          setCancelTarget({ id: medicine.medicine_id, name: medicine.name })
                        }
                        isCancelling={isCancelling && cancelTarget?.id === medicine.medicine_id}
                      />
                      </motion.div>
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
                <AdherenceCalendar
                  logs={adherenceLogs}
                  medicines={medicines}
                  todaysMedicines={dashboard?.todays_medicines}
                />
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <h2 className="mb-3 text-sm md:text-base font-semibold text-slate-900 flex items-center gap-2">
                  Pending Requests
                  {incomingRequests?.length > 0 && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600">
                      {incomingRequests.length}
                    </span>
                  )}
                </h2>
                {incomingRequests?.length > 0 ? (
                  <ul className="space-y-3">
                    {incomingRequests.map((req) => (
                      <li
                        key={req.id}
                        className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {req.from_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Wants to connect as your {req.type === "doctor_patient" ? "doctor" : "reviewer"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAcceptRequest(req.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Decline
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-[13px] text-slate-500">
                    No pending requests.
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <h2 className="mb-3 text-sm md:text-base font-semibold text-slate-900">
                  Connected doctors
                </h2>
                {doctors?.length > 0 ? (
                  <ul className="space-y-3">
                    {doctors.map((doctor) => (
                      <li
                        key={doctor.doctor_id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3.5 py-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-soft text-sm font-semibold text-brand">
                          {(doctor.full_name || "D").charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {doctor.full_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Connected since{" "}
                            {doctor.connected_at
                              ? new Date(doctor.connected_at).toLocaleDateString()
                              : "recently"}
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
                  My Reviewers
                </h2>
                <div className="mb-4">
                  <form onSubmit={handleSearchReviewer} className="flex gap-2">
                    <input 
                      type="email"
                      placeholder="Add reviewer by email..."
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand focus:outline-none"
                    />
                    <button 
                      type="submit"
                      disabled={isSearching}
                      className="rounded-xl bg-brand px-3 py-2 text-white hover:bg-brand-hover disabled:opacity-60"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </form>
                  {searchError && <p className="mt-2 text-xs text-rose-600">{searchError}</p>}
                  {searchResult && (
                    <div className="mt-3 rounded-xl border border-brand-soft-border bg-brand-soft p-3">
                      <p className="text-sm font-semibold">{searchResult.full_name}</p>
                      <button 
                        onClick={handleSendReviewerRequest}
                        disabled={sendingRequest}
                        className="mt-2 w-full rounded-lg bg-slate-900 py-1.5 text-xs text-white"
                      >
                        {sendingRequest ? "Sending..." : "Send Request"}
                      </button>
                    </div>
                  )}
                </div>

                {reviewers?.length > 0 && (
                  <ul className="space-y-3 mb-4">
                    {reviewers.map((rev) => (
                      <li key={rev.reviewer_id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent-soft text-sm font-semibold text-accent-hover">
                          {(rev.full_name || "R").charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{rev.full_name}</p>
                          <p className="text-[11px] text-slate-500">Reviewer</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                
                {outgoingRequests?.filter(req => req.type === 'reviewer').length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Pending Sent Requests</p>
                    <ul className="space-y-2">
                      {outgoingRequests.filter(req => req.type === 'reviewer').map(req => (
                        <li key={req.id} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                          <span>{req.to_name}</span>
                          <span className="flex items-center gap-1 text-amber-600"><Clock className="h-3 w-3"/> Pending</span>
                        </li>
                      ))}
                    </ul>
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
                        className="relative border-l-2 border-brand-soft-border pl-4 text-sm text-slate-700"
                      >
                        <span className="absolute left-[-5px] top-1 h-2 w-2 rounded-full bg-accent" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
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
    </AppReadyScreen>
  );
}
