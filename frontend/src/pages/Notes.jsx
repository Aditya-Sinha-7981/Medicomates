import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { getCurrentUser } from "../utils/auth";

const NOTES_KEY = "medicomates_notes";
const USERS_KEY = "medicomates_users";

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export default function Notes() {
  const currentUser = getCurrentUser();
  const [text, setText] = useState("");
  const [notes, setNotes] = useState(() => safeParse(localStorage.getItem(NOTES_KEY), []));
  const users = safeParse(localStorage.getItem(USERS_KEY), []);

  const doctorUsers = users.filter((user) => user.role === "doctor");
  const [doctorId, setDoctorId] = useState(doctorUsers[0]?.id || "");

  const thread = useMemo(
    () =>
      notes.filter(
        (note) =>
          note.patient_id === currentUser?.id &&
          note.doctor_id === doctorId
      ),
    [notes, currentUser?.id, doctorId]
  );

  const sendNote = () => {
    if (!text.trim() || !doctorId || !currentUser) return;
    const next = {
      id: `note_${Date.now()}`,
      patient_id: currentUser.id,
      doctor_id: doctorId,
      sender_role: currentUser.role,
      message: text.trim(),
      is_read: false,
      created_at: new Date().toISOString(),
    };
    const updated = [...notes, next];
    setNotes(updated);
    localStorage.setItem(NOTES_KEY, JSON.stringify(updated));
    setText("");
  };

  return (
    <AppShell title="Notes" subtitle="Secure async communication with your care team">
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-900">Doctor</h2>
          {doctorUsers.length ? (
            <select
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              {doctorUsers.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.full_name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No doctors registered yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Conversation</h2>
          <div className="mt-4 h-[320px] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
            {thread.length ? (
              <div className="space-y-2.5">
                {thread.map((note) => (
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
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
            />
            <button
              onClick={sendNote}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
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

