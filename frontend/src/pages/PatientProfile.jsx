import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/ToastContext";
import { getCurrentUser } from "../utils/auth";
import { api, endpoints } from "../services/api.js";
import CriticalBadge from "../components/CriticalBadge";
import InsightCard from "../components/InsightCard";
import VisitTimeline from "../components/VisitTimeline";
import NoteThread from "../components/NoteThread";
import AppReadyScreen from "../components/layout/AppReadyScreen";

export default function PatientProfile() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const currentUser = getCurrentUser();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [baseLoaded, setBaseLoaded] = useState(false);
  const [error, setError] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [visits, setVisits] = useState([]);
  const [notes, setNotes] = useState([]);
  const [profile, setProfile] = useState({});
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const loadAll = useCallback(async () => {
    if (!patientId || !currentUser?.id) return;
    setLoading(true);
    setError("");
    setBaseLoaded(false);
    try {
      const [medicinesRes, visitsRes, notesRes, dashboardRes] = await Promise.all([
        api.get(endpoints.medicines.list(patientId)),
        api.get(endpoints.visits.list(patientId)),
        api.get(endpoints.notes.thread(patientId, currentUser.id)),
        api.get(endpoints.dashboard.patient(patientId)),
      ]);
      setMedicines(Array.isArray(medicinesRes) ? medicinesRes : []);
      setVisits(Array.isArray(visitsRes) ? visitsRes : []);
      setNotes(Array.isArray(notesRes) ? notesRes : []);
      setProfile(dashboardRes?.profile || {});
      setBaseLoaded(true);
    } catch (err) {
      setError(err.message || "Failed to load patient profile.");
    } finally {
      setLoading(false);
    }
  }, [patientId, currentUser?.id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const patientName = useMemo(() => {
    if (profile?.full_name) return profile.full_name;
    const fromNotes = notes.find((note) => note?.patient_name)?.patient_name;
    if (fromNotes) return fromNotes;
    return `Patient ${String(patientId || "").slice(0, 6)}`;
  }, [notes, patientId, profile?.full_name]);

  const allergies = useMemo(() => {
    return profile?.allergies || "Not provided";
  }, [profile?.allergies]);

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoveLoading(true);
    try {
      await api.delete(endpoints.medicines.remove(removeTarget.id));
      showToast({ message: "Medicine removed from plan.", variant: "success" });
      setRemoveTarget(null);
      await loadAll();
    } catch (err) {
      showToast({ message: err.message || "Failed to remove medicine.", variant: "error" });
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <AppReadyScreen isReady={!loading}>
    <AppShell title="Patient Profile" subtitle="Medication and adherence summary">
      {error ? (
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
                className="inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                + Add Medicine
              </button>
            </div>
          </section>

          <InsightCard patientId={patientId} enabled={baseLoaded} />

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Medical documents</h2>
            <p className="mt-1 text-sm text-slate-500">
              View, upload, and edit patient reports.
            </p>
            <Link
              to={`/patient/${patientId}/documents`}
              state={{ patientName }}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
            >
              Open medical documents
            </Link>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Current medicines</h2>
            {medicines.length ? (
              <ul className="mt-3 space-y-2.5">
                {medicines.map((medicine) => (
                  <li
                    key={medicine.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                        <span>
                          {medicine.name}{" "}
                          <span className="font-normal text-slate-500">{medicine.dosage}</span>
                        </span>
                        <CriticalBadge show={medicine.is_critical} />
                      </p>
                      <p className="text-xs text-slate-500">
                        {medicine.frequency} • {(medicine.reminder_times || []).join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                      <button
                        type="button"
                        onClick={() => setRemoveTarget({ id: medicine.id, name: medicine.name })}
                        className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No active medicines.</p>
            )}
          </section>

          <VisitTimeline visits={visits} />

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Chat</h2>
            <p className="mt-1 text-xs text-slate-500">
              Use the full chat page to send replies.
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

      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove medicine?">
        <p className="text-sm text-slate-600">
          Remove <span className="font-semibold">{removeTarget?.name}</span> from this patient&apos;s active plan?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRemoveTarget(null)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmRemove}
            disabled={removeLoading}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {removeLoading ? "Removing…" : "Remove"}
          </button>
        </div>
      </Modal>
    </AppShell>
    </AppReadyScreen>
  );
}
