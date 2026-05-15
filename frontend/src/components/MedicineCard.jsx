import { CheckCircle2, Clock3, Pill, Undo2 } from "lucide-react";
import { motion } from "framer-motion";
import CriticalBadge from "./CriticalBadge";

const STATUS_STYLES = {
  taken: {
    pill: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  },
  missed: {
    pill: "bg-rose-50 text-rose-700 border-rose-100",
    icon: <Clock3 className="h-4 w-4 text-rose-500" />,
  },
  pending: {
    pill: "bg-slate-50 text-slate-700 border-slate-100",
    icon: <Clock3 className="h-4 w-4 text-slate-500" />,
  },
};

export default function MedicineCard({
  medicine,
  onMarkTaken,
  onToggleTaken,
  onEdit,
  onCancel,
  isCancelling,
}) {
  if (!medicine) return null;

  const nextDose = (medicine.statuses || []).find((s) => s.status !== "taken");

  return (
    <motion.article
      className={`group rounded-3xl border bg-white/80 px-4 py-4 md:px-5 md:py-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.08)] ${
        medicine.is_critical
          ? "border-rose-200/80 ring-1 ring-rose-100"
          : "border-slate-100"
      }`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-3 md:gap-4">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Pill className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm md:text-base font-semibold text-slate-900">
                  {medicine.name}{" "}
                  <span className="text-slate-500 font-normal">{medicine.dosage}</span>
                </h3>
                <CriticalBadge show={medicine.is_critical} />
              </div>
              <p className="text-xs md:text-[13px] text-slate-500">
                {medicine.frequency || "Scheduled dose"}
              </p>
              {medicine.supply_warning && medicine.supply_restock_message ? (
                <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 border border-amber-100">
                  {medicine.supply_restock_message}
                </p>
              ) : null}
            </div>
            {nextDose ? (
              <p className="text-[11px] md:text-xs text-slate-500 flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                Next at <span className="font-medium text-slate-700">{nextDose.time}</span>
              </p>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {(medicine.statuses || []).map((statusItem) => {
              const style = STATUS_STYLES[statusItem.status] || STATUS_STYLES.pending;
              return (
                <div
                  key={`${medicine.medicine_id}-${statusItem.time}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] md:text-xs font-medium ${style.pill}`}
                >
                  {style.icon}
                  <span className="text-slate-700">{statusItem.time}</span>
                  <span className="capitalize">{statusItem.status}</span>
                  {statusItem.status !== "taken" ? (
                    <button
                      type="button"
                      onClick={() => onMarkTaken?.(medicine.medicine_id, statusItem.time)}
                      className="ml-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      Mark taken
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleTaken?.(medicine.medicine_id, statusItem.time)}
                      className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white/50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <Undo2 className="h-2.5 w-2.5" />
                      Undo
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 disabled:opacity-50"
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

