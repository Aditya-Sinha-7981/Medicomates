/** Small pill for medicines marked is_critical in the database. */
export default function CriticalBadge({ show, className = "" }) {
  if (!show) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-800 ${className}`}
      title="Critical medication — missed doses may trigger a phone call"
    >
      Critical
    </span>
  );
}
