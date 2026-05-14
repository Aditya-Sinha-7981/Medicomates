export default function NoteThread({ notes, currentRole, otherPartyName }) {
  const rows = Array.isArray(notes) ? notes : [];

  return (
    <div className="h-[320px] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
      {rows.length ? (
        <div className="space-y-2.5">
          {rows.map((note) => {
            const isMine = note.sender_role === currentRole;
            return (
              <div
                key={note.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  isMine
                    ? "ml-auto bg-brand text-white"
                    : "bg-white border border-slate-200 text-slate-700"
                }`}
              >
                <p className="text-[11px] font-semibold opacity-85 mb-1">
                  {isMine ? "You" : otherPartyName || "Care team"}
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
        <p className="text-sm text-slate-500">
          No notes yet. Start with a quick update.
        </p>
      )}
    </div>
  );
}
