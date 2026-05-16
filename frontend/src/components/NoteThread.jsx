export default function NoteThread({ notes, currentRole, otherPartyName, emptyLabel }) {
  const rows = Array.isArray(notes) ? notes : [];

  return (
    <div className="h-[320px] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
      {rows.length ? (
        <div className="space-y-2.5">
          {rows.map((note) => {
            const isMine = note.sender_role === currentRole;
            const isUrgent = Boolean(note.is_urgent);
            return (
              <div
                key={note.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  isMine
                    ? "ml-auto bg-brand text-white"
                    : "bg-white border text-slate-700"
                } ${isUrgent && !isMine ? "border-rose-300 border-l-4 border-l-rose-500" : isUrgent && isMine ? "ring-1 ring-rose-300/60" : isMine ? "" : "border-slate-200"}`}
              >
                <p className="text-[11px] font-semibold opacity-85 mb-1 flex items-center gap-1.5">
                  <span>{isMine ? "You" : otherPartyName || "Care team"}</span>
                  {isUrgent ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                        isMine ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      Urgent
                    </span>
                  ) : null}
                </p>
                <p>{note.message}</p>
                <p className="mt-1 text-[10px] opacity-80">
                  {note.created_at ? new Date(note.created_at).toLocaleString() : ""}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{emptyLabel || "No messages yet."}</p>
      )}
    </div>
  );
}
