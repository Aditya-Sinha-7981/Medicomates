import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { getCurrentUser } from "../utils/auth";
import { api, endpoints } from "../services/api.js";
import InsightCard from "../components/InsightCard";
import VisitTimeline from "../components/VisitTimeline";
import NoteThread from "../components/NoteThread";

export default function PatientProfile() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [baseLoaded, setBaseLoaded] = useState(false);
  const [error, setError] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [visits, setVisits] = useState([]);
  const [notes, setNotes] = useState([]);
  const [profile, setProfile] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!patientId || !currentUser?.id) {
        if (!cancelled) setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      setBaseLoaded(false);
      try {
        const [medicinesRes, visitsRes, notesRes, dashboardRes] =
          await Promise.all([
          api.get(endpoints.medicines.list(patientId)),
          api.get(endpoints.visits.list(patientId)),
          api.get(endpoints.notes.thread(patientId, currentUser.id)),
          api.get(endpoints.dashboard.patient(patientId)),
        ]);
        if (cancelled) return;
        setMedicines(Array.isArray(medicinesRes) ? medicinesRes : []);
        setVisits(Array.isArray(visitsRes) ? visitsRes : []);
        setNotes(Array.isArray(notesRes) ? notesRes : []);
        setProfile(dashboardRes?.profile || {});
        setBaseLoaded(true);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load patient profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, currentUser?.id]);

  const patientName = useMemo(() => {
    if (profile?.full_name) return profile.full_name;
    const fromNotes = notes.find((note) => note?.patient_name)?.patient_name;
    if (fromNotes) return fromNotes;
    return `Patient ${String(patientId || "").slice(0, 6)}`;
  }, [notes, patientId, profile?.full_name]);

  const allergies = useMemo(() => {
    return profile?.allergies || "Not provided";
  }, [profile?.allergies]);

  return (
    <AppShell title="Patient Profile" subtitle="Medication and adherence summary">
      {loading ? (
        <p className="text-sm text-slate-500">Loading patient profile...</p>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{patientName}</h2>
                <p className="mt-1 text-sm text-slate-500">Allergies: {allergies}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigate("/medicine/new", {
                    state: { patientId, doctorMode: true, returnTo: `/patient/${patientId}` },
                  })
                }
                className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                + Add Medicine
              </button>
            </div>
          </section>

          <InsightCard patientId={patientId} enabled={baseLoaded} />

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Current medicines</h2>
            {medicines.length ? (
              <ul className="mt-3 space-y-2.5">
                {medicines.map((medicine) => (
                  <li
                    key={medicine.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {medicine.name}{" "}
                        <span className="font-normal text-slate-500">{medicine.dosage}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {medicine.frequency} • {(medicine.reminder_times || []).join(", ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/medicines", {
                          state: {
                            medicine,
                            patientId,
                            doctorMode: true,
                            returnTo: `/patient/${patientId}`,
                          },
                        })
                      }
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No active medicines.</p>
            )}
          </section>

          <VisitTimeline visits={visits} />

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Notes</h2>
            <p className="mt-1 text-xs text-slate-500">
              Use the full notes page to send replies.
            </p>
            <div className="mt-3">
              <NoteThread
                notes={notes}
                currentRole={currentUser?.role}
                otherPartyName={patientName}
              />
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

