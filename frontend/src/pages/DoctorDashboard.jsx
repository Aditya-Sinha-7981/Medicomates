import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus2, Clock, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { getCurrentUser, logout } from "../utils/auth";
import { api, endpoints } from "../services/api.js";
import PatientListCard from "../components/PatientListCard";
import AppReadyScreen from "../components/layout/AppReadyScreen";

export default function DoctorDashboard() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [urgentNotes, setUrgentNotes] = useState([]);

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

  // 2. Data Fetching
  const fetchDashboard = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const [dashboard, outgoing, urgent] = await Promise.all([
        api.get(endpoints.dashboard.doctor(user.id)),
        api.get(endpoints.connections.outgoingRequests()),
        api.get(endpoints.notes.urgentInboxForDoctor(user.id)).catch(() => []),
      ]);
      setPatients(Array.isArray(dashboard?.patients) ? dashboard.patients : []);
      setOutgoingRequests(Array.isArray(outgoing) ? outgoing : []);
      setUrgentNotes(Array.isArray(urgent) ? urgent : []);
    } catch (err) {
      setError(err.message || "Failed to load doctor dashboard.");
      if (err.message.includes("401") || err.message.includes("403")) {
        logout();
        navigate("/login", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user?.id, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setIsSearching(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const res = await api.get(endpoints.connections.search(searchEmail.trim(), "doctor_patient"));
      setSearchResult(res);
    } catch (err) {
      setSearchError(err.message || "User not found.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult) return;
    setSendingRequest(true);
    try {
      await api.post(endpoints.connections.request(), {
        to_email: searchEmail.trim(),
        type: "doctor_patient"
      });
      setSearchResult(null);
      setSearchEmail("");
      // refresh lists
      fetchDashboard();
    } catch (err) {
      setSearchError(err.message || "Failed to send request.");
    } finally {
      setSendingRequest(false);
    }
  };

  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => {
      const ta = a.connected_at ? Date.parse(a.connected_at) : 0;
      const tb = b.connected_at ? Date.parse(b.connected_at) : 0;
      return tb - ta;
    });
  }, [patients]);

  const previewPatients = sortedPatients.slice(0, 4);
  const totalPatients = sortedPatients.length;

  if (!user || user.role !== "doctor") return null;

  return (
    <AppReadyScreen isReady={!loading}>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/80 to-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              Urgent Patient Messages
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Unread urgent notes from your patients. Open in Notes to reply.
            </p>
            <div className="mt-4 space-y-2">
              {urgentNotes.length ? (
                urgentNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex flex-col gap-2 rounded-xl border border-rose-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {note.patient_name || "Patient"}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600 line-clamp-2">{note.message}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {note.created_at
                          ? new Date(note.created_at).toLocaleString()
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link
                        to={`/notes?patientId=${note.patient_id}&tab=urgent`}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        Open chat
                      </Link>
                      <Link
                        to={`/patient/${note.patient_id}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Profile
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No urgent messages right now.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Recent patients</h2>
              {totalPatients > 0 ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                  <span>
                    Showing {Math.min(4, totalPatients)} of {totalPatients}
                  </span>
                  <Link
                    to="/doctor/patients"
                    className="font-semibold text-brand hover:text-brand-hover"
                  >
                    View all
                  </Link>
                </div>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Latest connections first. Open <span className="font-medium text-slate-600">Patients</span>{" "}
              in the sidebar for the full list.
            </p>
            
            {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
            
            {patients.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {previewPatients.map((patient, index) => (
                  <PatientListCard key={patient.patient_id} patient={patient} index={index} />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 text-center">
                No patient accounts available yet.
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Find Patient Panel */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Find Patient</h2>
            <p className="mt-1 text-sm text-slate-500 mb-4">
              Connect with a patient by email.
            </p>
            
            <form onSubmit={handleSearch} className="flex gap-2">
              <input 
                type="email"
                placeholder="Patient email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                required
              />
              <button 
                type="submit"
                disabled={isSearching}
                className="rounded-xl bg-brand px-3 py-2 text-white shadow-sm hover:bg-brand-hover disabled:opacity-60"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>

            {searchError && (
              <p className="mt-3 text-sm text-rose-600">{searchError}</p>
            )}

            {searchResult && (
              <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 font-semibold">
                    {searchResult.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{searchResult.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{searchResult.role}</p>
                  </div>
                </div>
                <button 
                  onClick={handleSendRequest}
                  disabled={sendingRequest}
                  className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <UserPlus2 className="h-4 w-4" />
                  {sendingRequest ? "Sending..." : "Send Request"}
                </button>
              </div>
            )}
          </section>

          {/* Outgoing Requests Panel */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              Pending Requests
              {outgoingRequests.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {outgoingRequests.length}
                </span>
              )}
            </h2>
            
            <div className="mt-4 space-y-3">
              {outgoingRequests.length > 0 ? (
                outgoingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{req.to_name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Sent {new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                      <Clock className="h-3 w-3" />
                      Pending
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">No pending requests sent.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
    </AppReadyScreen>
  );
}