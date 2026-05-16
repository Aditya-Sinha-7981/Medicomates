import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { getCurrentUser } from "../utils/auth";
import { api, endpoints } from "../services/api.js";
import NoteThread from "../components/NoteThread";

const TAB_NORMAL = "normal";
const TAB_URGENT = "urgent";

export default function Notes() {
  const [searchParams] = useSearchParams();
  const currentUser = getCurrentUser();
  const isDoctor = currentUser?.role === "doctor";
  const currentUserId = currentUser?.id;
  const initialPatientId = searchParams.get("patientId") || "";
  const initialDoctorId = searchParams.get("doctorId") || "";
  const initialTab = searchParams.get("tab") === TAB_URGENT ? TAB_URGENT : TAB_NORMAL;

  const [counterparts, setCounterparts] = useState([]);
  const [patientId, setPatientId] = useState(isDoctor ? initialPatientId : currentUserId || "");
  const [doctorId, setDoctorId] = useState(isDoctor ? currentUserId || initialDoctorId : "");
  const [notes, setNotes] = useState([]);
  const [messageTab, setMessageTab] = useState(initialTab);
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
      if (initialDoctorId && arr.some((d) => d.doctor_id === initialDoctorId)) {
        return initialDoctorId;
      }
      if (prev && arr.some((d) => d.doctor_id === prev)) return prev;
      return arr[0]?.doctor_id || "";
    });
  }, [currentUserId, isDoctor, initialDoctorId]);

  const loadThread = useCallback(async () => {
    if (!patientId || !doctorId) {
      setNotes([]);
      return;
    }
    const thread = await api.get(endpoints.notes.thread(patientId, doctorId));
    setNotes(Array.isArray(thread) ? thread : []);
  }, [patientId, doctorId]);

  const markRead = useCallback(
    async (scope) => {
      if (!patientId || !doctorId) return;
      try {
        await api.put(endpoints.notes.markRead(patientId, doctorId, scope), {});
      } catch {
        /* non-blocking */
      }
    },
    [patientId, doctorId]
  );

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
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load chat");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, doctorId, loadThread]);

  useEffect(() => {
    if (!patientId || !doctorId) return;
    markRead(messageTab);
  }, [messageTab, patientId, doctorId, markRead]);

  const visibleNotes = useMemo(
    () =>
      notes.filter((n) =>
        messageTab === TAB_URGENT ? Boolean(n.is_urgent) : !n.is_urgent
      ),
    [notes, messageTab]
  );

  const emptyLabel =
    messageTab === TAB_URGENT
      ? "No urgent messages yet."
      : "No normal messages yet. Start with a quick update.";

  const sendNote = async () => {
    if (!text.trim() || !doctorId || !patientId) return;
    setSending(true);
    setError("");
    try {
      await api.post(endpoints.notes.create(), {
        patient_id: patientId,
        doctor_id: doctorId,
        message: text.trim(),
        is_urgent: messageTab === TAB_URGENT,
      });
      setText("");
      await loadThread();
      await markRead(messageTab);
    } catch (e) {
      setError(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (!currentUserId) {
    return (
      <AppShell title="Chat" subtitle="Secure async communication with your care team">
        <p className="text-sm text-slate-600">Please sign in to use chat.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Chat" subtitle="Secure async communication with your care team">
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

          <div className="mt-3 flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setMessageTab(TAB_NORMAL)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                messageTab === TAB_NORMAL
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Normal Messages
            </button>
            <button
              type="button"
              onClick={() => setMessageTab(TAB_URGENT)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                messageTab === TAB_URGENT
                  ? "bg-white text-rose-700 shadow-sm ring-1 ring-rose-200"
                  : "text-slate-600 hover:text-rose-700"
              }`}
            >
              Urgent Messages
            </button>
          </div>

          {error ? (
            <p className="mt-2 text-sm text-rose-600">{error}</p>
          ) : null}
          <div className="mt-4">
            {!doctorId ? (
              <p className="text-sm text-slate-500">Select a conversation to view messages.</p>
            ) : (
              <NoteThread
                notes={visibleNotes}
                currentRole={currentUser?.role}
                otherPartyName={
                  counterparts.find((entry) =>
                    isDoctor ? entry.patient_id === patientId : entry.doctor_id === doctorId
                  )?.full_name
                }
                emptyLabel={emptyLabel}
              />
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                messageTab === TAB_URGENT
                  ? "Write an urgent message…"
                  : "Write your message..."
              }
              disabled={!doctorId || sending}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendNote}
              disabled={!doctorId || sending || !text.trim()}
              className={`inline-flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                messageTab === TAB_URGENT
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-brand hover:bg-brand-hover"
              }`}
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
