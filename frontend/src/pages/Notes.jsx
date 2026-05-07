import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { getCurrentUser } from "../utils/auth";
import { api, endpoints } from "../services/api.js";

export default function Notes() {
  const currentUser = getCurrentUser();
  const patientId = currentUser?.id;

  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadDoctors = useCallback(async () => {
    if (!patientId) return;
    const list = await api.get(endpoints.connections.doctorsForPatient(patientId));
    const arr = Array.isArray(list) ? list : [];
    setDoctors(arr);
    setDoctorId((prev) => {
      if (prev && arr.some((d) => d.doctor_id === prev)) return prev;
      return arr[0]?.doctor_id || "";
    });
  }, [patientId]);

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
      if (!patientId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        await loadDoctors();
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load doctors");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, loadDoctors]);

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

  if (!patientId) {
    return (
      <AppShell title="Notes" subtitle="Secure async communication with your care team">
        <p className="text-sm text-slate-600">Please sign in as a patient to use notes.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Notes" subtitle="Secure async communication with your care team">
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-900">Doctor</h2>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : doctors.length ? (
            <select
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              {doctors.map((doctor) => (
                <option key={doctor.doctor_id} value={doctor.doctor_id}>
                  {doctor.full_name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No connected doctors yet. Ask your care team to connect your account.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Conversation</h2>
          {error ? (
            <p className="mt-2 text-sm text-rose-600">{error}</p>
          ) : null}
          <div className="mt-4 h-[320px] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
            {!doctorId ? (
              <p className="text-sm text-slate-500">Select a connected doctor to view messages.</p>
            ) : notes.length ? (
              <div className="space-y-2.5">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      note.sender_role === currentUser?.role
                        ? "ml-auto bg-blue-600 text-white"
                        : "bg-white border border-slate-200 text-slate-700"
                    }`}
                  >
                    <p>{note.message}</p>
                    <p className="mt-1 text-[10px] opacity-80">
                      {new Date(note.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No notes yet. Start with a quick update for your doctor.
              </p>
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
