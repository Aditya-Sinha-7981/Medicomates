import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { getCurrentUser } from "../utils/auth";
import { api, endpoints } from "../services/api.js";
import NoteThread from "../components/NoteThread";

export default function Notes() {
  const [searchParams] = useSearchParams();
  const currentUser = getCurrentUser();
  const isDoctor = currentUser?.role === "doctor";
  const currentUserId = currentUser?.id;
  const initialPatientId = searchParams.get("patientId") || "";
  const initialDoctorId = searchParams.get("doctorId") || "";

  const [counterparts, setCounterparts] = useState([]);
  const [patientId, setPatientId] = useState(isDoctor ? initialPatientId : currentUserId || "");
  const [doctorId, setDoctorId] = useState(isDoctor ? currentUserId || initialDoctorId : "");
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadCounterparts = useCallback(async () => {
    if (!currentUserId) return;
    if (isDoctor) {
      const list = await api.get(endpoints.connections.patientsForDoctor(currentUserId));
      const arr = Array.isArray(list) ? list : [];
      setCounterparts(arr);
      setPatientId((prev) => {
        if (prev && arr.some((p) => p.patient_id === prev)) return prev;
        return arr[0]?.patient_id || "";
      });
      setDoctorId(currentUserId);
      return;
    }
    const list = await api.get(endpoints.connections.doctorsForPatient(currentUserId));
    const arr = Array.isArray(list) ? list : [];
    setCounterparts(arr);
    setPatientId(currentUserId);
    setDoctorId((prev) => {
      if (prev && arr.some((d) => d.doctor_id === prev)) return prev;
      return arr[0]?.doctor_id || "";
    });
  }, [currentUserId, isDoctor]);

  const loadThread = useCallback(async () => {
    if (!patientId || !doctorId) {
      setNotes([]);
      return;
    }
    const thread = await api.get(endpoints.notes.thread(patientId, doctorId));
    setNotes(Array.isArray(thread) ? thread : []);
  }, [patientId, doctorId]);

  const markRead = useCallback(async () => {
    if (!patientId || !doctorId) return;
    try {
      await api.put(endpoints.notes.markRead(patientId, doctorId), {});
    } catch {
      /* non-blocking */
    }
  }, [patientId, doctorId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUserId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        await loadCounterparts();
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load connected users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, loadCounterparts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!patientId || !doctorId) return;
      setError("");
      try {
        await loadThread();
        await markRead();
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load notes");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, doctorId, loadThread, markRead]);

  const sendNote = async () => {
    if (!text.trim() || !doctorId || !patientId) return;
    setSending(true);
    setError("");
    try {
      await api.post(endpoints.notes.create(), {
        patient_id: patientId,
        doctor_id: doctorId,
        message: text.trim(),
      });
      setText("");
      await loadThread();
    } catch (e) {
      setError(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (!currentUserId) {
    return (
      <AppShell title="Notes" subtitle="Secure async communication with your care team">
        <p className="text-sm text-slate-600">Please sign in to use notes.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Notes" subtitle="Secure async communication with your care team">
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-900">
            {isDoctor ? "Patient" : "Doctor"}
          </h2>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : counterparts.length ? (
            <select
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
              value={isDoctor ? patientId : doctorId}
              onChange={(e) => {
                if (isDoctor) {
                  setPatientId(e.target.value);
                } else {
                  setDoctorId(e.target.value);
                }
              }}
            >
              {counterparts.map((entry) => (
                <option
                  key={isDoctor ? entry.patient_id : entry.doctor_id}
                  value={isDoctor ? entry.patient_id : entry.doctor_id}
                >
                  {entry.full_name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {isDoctor
                ? "No connected patients yet."
                : "No connected doctors yet. Ask your care team to connect your account."}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Conversation</h2>
          {error ? (
            <p className="mt-2 text-sm text-rose-600">{error}</p>
          ) : null}
          <div className="mt-4">
            {!doctorId ? (
              <p className="text-sm text-slate-500">Select a conversation to view messages.</p>
            ) : (
              <NoteThread
                notes={notes}
                currentRole={currentUser?.role}
                otherPartyName={
                  counterparts.find((entry) =>
                    isDoctor ? entry.patient_id === patientId : entry.doctor_id === doctorId
                  )?.full_name
                }
              />
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your message..."
              disabled={!doctorId || sending}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendNote}
              disabled={!doctorId || sending || !text.trim()}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
