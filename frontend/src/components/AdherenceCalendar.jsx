import { motion } from "framer-motion";
import { dedupeAdherenceLogsBySchedulerSlot } from "../utils/schedulerTime.js";

const STATUS_COLORS = {
  taken: "bg-emerald-500/80 hover:bg-emerald-500",
  missed: "bg-rose-500/80 hover:bg-rose-500",
  pending: "bg-slate-300/80 hover:bg-slate-300",
  none: "bg-slate-400/90 hover:bg-slate-400",
};

/** YYYY-MM-DD for the instant in UTC (matches adherence_logs.scheduled_time bucketing). */
function utcDateKeyFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Last `count` UTC calendar days ending today (UTC), oldest first — each item `{ key, date }` for tooltips. */
function utcCalendarDays(count = 30) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const days = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(y, m, d - i));
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    days.push({ key: `${yyyy}-${mm}-${dd}`, date });
  }
  return days;
}

function utcTodayKey() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Match backend compute_status: taken if confirmed; else missed if past due in UTC. */
function effectiveLogStatus(log) {
  const s = log?.status;
  if (s === "taken" || s === "missed" || s === "pending") return s;
  if (log?.confirmed_at != null && log.confirmed_at !== "") return "taken";
  const t = Date.parse(log?.scheduled_time);
  if (Number.isNaN(t)) return "pending";
  return t < Date.now() ? "missed" : "pending";
}

function computeDayStatus(logsByDay, dateKey) {
  const dayLogs = logsByDay.get(dateKey) || [];
  if (!dayLogs.length) return "none";
  const normalized = dayLogs.map(effectiveLogStatus);
  // Day still in progress: if a future dose is pending, don't paint the whole day red
  // while an earlier slot was missed (evening not due yet).
  if (normalized.some((x) => x === "pending") && normalized.some((x) => x === "missed")) {
    return "pending";
  }
  if (normalized.some((x) => x === "missed")) return "missed";
  if (normalized.every((x) => x === "taken")) return "taken";
  return "pending";
}

function formatUtcTooltip(utcDate) {
  return utcDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function AdherenceCalendar({ logs = [] }) {
  const days = utcCalendarDays(30);
  const todayKey = utcTodayKey();
  const normalizedLogs = dedupeAdherenceLogsBySchedulerSlot(logs);

  const logsByDay = normalizedLogs.reduce((map, log) => {
    const key = utcDateKeyFromIso(log.scheduled_time);
    if (!key) return map;
    const current = map.get(key) || [];
    current.push(log);
    map.set(key, current);
    return map;
  }, new Map());

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.06)] p-5 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-slate-900">30-day adherence</h3>
          <p className="text-xs md:text-sm text-slate-500">
            Each dot is one UTC day (matches dose timestamps). Hover a dot for details.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-10 gap-1.5 md:gap-2">
        {days.map(({ key, date }) => {
          const status = computeDayStatus(logsByDay, key);
          const count = (logsByDay.get(key) || []).length;
          const isToday = key === todayKey;

          return (
            <motion.div
              key={key}
              className={`relative h-5 md:h-6 w-full rounded-xl border border-slate-200/70 ${STATUS_COLORS[status]}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15, delay: 0.01 }}
            >
              <div className="group absolute inset-0 cursor-default">
                <div className="absolute inset-0 rounded-xl" />
                <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-max -translate-x-1/2 rounded-2xl bg-slate-900 px-3 py-2 text-[11px] md:text-xs text-slate-100 shadow-lg/30 group-hover:block">
                  <div className="font-medium">
                    {formatUtcTooltip(date)} {isToday ? "(today UTC)" : ""}
                  </div>
                  <div className="mt-0.5 capitalize text-slate-300">
                    Status: {status === "none" ? "no doses" : status}
                  </div>
                  <div className="text-slate-400">
                    {count ? `${count} scheduled dose${count > 1 ? "s" : ""}` : "No doses"}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] md:text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-emerald-500" /> Taken
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-rose-500" /> Missed
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-slate-300" /> Pending / future
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-slate-400" /> No doses
        </div>
      </div>
    </div>
  );
}
