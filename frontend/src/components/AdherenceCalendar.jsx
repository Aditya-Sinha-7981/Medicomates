import { eachDayOfInterval, format, subDays } from "date-fns";

const cellColor = (status) => {
  if (status === "taken") return "#c9efd7";
  if (status === "missed") return "#ffd1d1";
  return "#dbe5f2";
};

function computeDayStatus(logsByDay, dateKey) {
  const dayLogs = logsByDay.get(dateKey) || [];
  if (!dayLogs.length) {
    const isFuture = new Date(dateKey) > new Date();
    return isFuture ? "pending" : "missed";
  }
  if (dayLogs.some((log) => log.status === "missed")) return "missed";
  if (dayLogs.every((log) => log.status === "taken")) return "taken";
  return "pending";
}

export default function AdherenceCalendar({ logs = [] }) {
  const days = eachDayOfInterval({
    start: subDays(new Date(), 29),
    end: new Date(),
  });

  const logsByDay = logs.reduce((map, log) => {
    const key = format(new Date(log.scheduled_time), "yyyy-MM-dd");
    const current = map.get(key) || [];
    current.push(log);
    map.set(key, current);
    return map;
  }, new Map());

  return (
    <div className="bg-white rounded-[22px] border border-[#e7edf6] shadow-[0_8px_30px_rgba(32,77,139,0.08)] p-[18px]">
      <h3 style={{ margin: "0 0 14px", fontSize: "1.5rem", color: "#1f2937" }}>30-Day Adherence</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {days.map((date) => {
          const key = format(date, "yyyy-MM-dd");
          const status = computeDayStatus(logsByDay, key);
          return (
            <div
              key={key}
              title={`${format(date, "dd MMM yyyy")} - ${status}`}
              style={{
                background: cellColor(status),
                height: 28,
                width: "100%",
                minWidth: 26,
                borderRadius: 999,
                border: "1px solid #e5edf8",
              }}
            />
          );
        })}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 14, fontSize: 12, color: "#64748b" }}>
        <span>Green: taken</span>
        <span>Red: missed</span>
        <span>Grey: pending</span>
      </div>
    </div>
  );
}
