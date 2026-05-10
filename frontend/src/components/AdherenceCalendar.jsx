import { eachDayOfInterval, format, subDays } from "date-fns";
import { motion } from "framer-motion";

const STATUS_COLORS = {
  taken: "bg-emerald-500/80 hover:bg-emerald-500",
  missed: "bg-rose-500/80 hover:bg-rose-500",
  pending: "bg-slate-300/80 hover:bg-slate-300",
  none: "bg-slate-400/90 hover:bg-slate-400",
};

function computeDayStatus(logsByDay, dateKey) {
  const dayLogs = logsByDay.get(dateKey) || [];
  if (!dayLogs.length) {
    // Distinguish "no scheduled doses" from "pending/future".
    return "none";
  }
  if (dayLogs.some((log) => log.status === "missed")) return "missed";
  if (dayLogs.every((log) => log.status === "taken")) return "taken";
  return "pending";
}

function utcDateKeyFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdherenceCalendar({ logs = [] }) {
  const days = eachDayOfInterval({
    start: subDays(new Date(), 29),
    end: new Date(),
  });

  const logsByDay = logs.reduce((map, log) => {
    // scheduled_time is stored in UTC (Z/+00:00). Bucket by UTC day to avoid
    // local timezone shifting dots to the previous/next day.
    const key = utcDateKeyFromIso(log.scheduled_time);
    if (!key) return map;
    const current = map.get(key) || [];
    current.push(log);
    map.set(key, current);
    return map;
  }, new Map());

  const todayKey = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.06)] p-5 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-slate-900">30-day adherence</h3>
          <p className="text-xs md:text-sm text-slate-500">
            Each dot represents all medicines for that day.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-10 gap-1.5 md:gap-2">
        {days.map((date) => {
          const key = format(date, "yyyy-MM-dd");
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
                    {format(date, "dd MMM yyyy")} {isToday ? "(today)" : ""}
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

