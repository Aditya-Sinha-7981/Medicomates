import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdherenceCalendar from "../components/AdherenceCalendar";
import MedicineCard from "../components/MedicineCard";
import useAuth from "../hooks/useAuth";
import usePatientData from "../hooks/usePatientData";
import BottomNav from "../components/BottomNav";

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { dashboard, doctors, visits, adherenceLogs, loading, error, refresh, markDoseTaken } =
    usePatientData();

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
    return <p className="p-6 text-gray-500">Loading dashboard...</p>;
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

  return (
    <main className="min-h-screen bg-[#f3f6fb] pb-24 md:pb-0 md:pl-24 font-sans text-slate-800">
      <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
        
        {/* Header */}
        <header className="bg-gradient-to-br from-[#1f78f4] to-[#2e88ff] text-white rounded-3xl px-6 py-8 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center shadow-md">
          <div className="mb-4 md:mb-0">
            <p className="m-0 opacity-90 text-sm md:text-base font-medium">Good Morning,</p>
            <h1 className="m-0 mt-1 text-3xl md:text-4xl font-extrabold tracking-tight">
              {dashboard?.profile?.full_name || "Patient"}
            </h1>
            <p className="m-0 mt-2 opacity-95 text-sm md:text-base bg-white/20 inline-block px-3 py-1 rounded-full">
              Weekly adherence: <span className="font-bold">{dashboard?.weekly_percentage ?? "--"}%</span>
            </p>
          </div>
          <button
            className="border-2 border-white/40 text-white hover:bg-white/10 transition-colors h-11 rounded-xl font-semibold px-5"
            onClick={logout}
          >
            Logout
          </button>
        </header>

        {/* Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column (Stats & Schedule) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            <section className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl p-6 text-white bg-[#2a79e8] shadow-sm flex flex-col justify-between">
                <div className="text-sm opacity-90 font-semibold tracking-wide uppercase">Adherence</div>
                <div className="text-4xl font-extrabold mt-2 flex items-baseline gap-2">
                  {dashboard?.weekly_percentage ?? "--"}%
                  <svg className="w-5 h-5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                </div>
              </div>
              <div className="rounded-3xl p-6 text-white bg-[#2fad58] shadow-sm flex flex-col justify-between">
                <div className="text-sm opacity-90 font-semibold tracking-wide uppercase">Doses Today</div>
                <div className="text-4xl font-extrabold mt-2 flex items-baseline gap-2">
                  {takenDoseCount}/{todayDoseCount}
                  <svg className="w-5 h-5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
              </div>
            </section>

            <section className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => navigate("/medicine/new")} className="flex-1 h-14 rounded-2xl bg-[#2a79e8] hover:bg-blue-700 transition-colors text-white text-base font-bold shadow-sm">
                + Add Medicine
              </button>
              <button onClick={() => navigate("/notes")} className="flex-1 border-2 border-[#e2e8f0] bg-white hover:bg-gray-50 transition-colors text-[#334155] h-14 rounded-2xl font-bold shadow-sm">
                Send a note
              </button>
            </section>

            <section className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm p-6 md:p-8">
              <h2 className="m-0 mb-6 text-2xl text-slate-800 font-extrabold flex items-center justify-between">
                Today's Schedule
                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {(dashboard?.todays_medicines || []).length} Medicines
                </span>
              </h2>
              <div className="flex flex-col gap-4">
                {(dashboard?.todays_medicines || []).length ? (
                  dashboard.todays_medicines.map((medicine) => (
                    <MedicineCard
                      key={medicine.medicine_id}
                      medicine={medicine}
                      onMarkTaken={markDoseTaken}
                    />
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    No medicines scheduled for today.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Right Column (Sidebar items on desktop) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            <section className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm p-6 md:p-8">
              <h2 className="m-0 mb-5 text-lg text-slate-800 font-bold">30-Day Adherence</h2>
              <AdherenceCalendar logs={adherenceLogs} />
            </section>

            <section className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm p-6 md:p-8">
              <h2 className="m-0 mb-5 text-lg text-slate-800 font-bold">Connected Doctors</h2>
              {doctors.length ? (
                <ul className="m-0 p-0 flex flex-col gap-3">
                  {doctors.map((doctor) => (
                    <li key={doctor.doctor_id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                        {doctor.full_name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{doctor.full_name}</span>
                        <span className="text-xs text-gray-500">Since {new Date(doctor.connected_at).toLocaleDateString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">No connected doctors yet.</p>
              )}
            </section>

            <section className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm p-6 md:p-8">
              <h2 className="m-0 mb-5 text-lg text-slate-800 font-bold">Recent Visits</h2>
              {recentVisits.length ? (
                <ul className="m-0 p-0 flex flex-col gap-5">
                  {recentVisits.map((visit) => (
                    <li key={visit.id} className="flex flex-col gap-1 border-l-2 border-blue-200 pl-4 relative">
                      <div className="absolute w-2 h-2 rounded-full bg-blue-500 -left-[5px] top-1"></div>
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                        {new Date(visit.visit_date).toLocaleDateString()}
                      </span>
                      <span className="font-bold text-slate-700 text-base">{visit.doctor_name}</span>
                      <span className="text-sm text-gray-600 leading-relaxed mt-1">{visit.summary}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">No visit history yet.</p>
              )}
            </section>

          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
