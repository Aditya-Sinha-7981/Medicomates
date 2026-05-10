export default function VisitTimeline({ visits }) {
  const rows = Array.isArray(visits) ? visits : [];

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Visit timeline</h2>
      {rows.length ? (
        <ul className="mt-4 space-y-3">
          {rows.map((visit) => (
            <li
              key={visit.id}
              className="relative border-l-2 border-sky-100 pl-4 text-sm text-slate-700"
            >
              <span className="absolute left-[-5px] top-1 h-2 w-2 rounded-full bg-sky-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-500">
                {visit?.visit_date ? new Date(visit.visit_date).toLocaleDateString() : "Unknown date"}
              </p>
              <p className="mt-0.5 font-semibold">{visit?.doctor_name || "Doctor"}</p>
              <p className="text-[13px] text-slate-500">{visit?.summary || "No summary available."}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No visits recorded yet.</p>
      )}
    </section>
  );
}
