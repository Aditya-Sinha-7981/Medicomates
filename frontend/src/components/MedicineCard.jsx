const STATUS_STYLES = {
  taken: { bg: "#e8f8ee", text: "#1f9d53" },
  missed: { bg: "#fdecec", text: "#d93a3a" },
  pending: { bg: "#edf1f7", text: "#52627a" },
};

export default function MedicineCard({ medicine, onMarkTaken }) {
  if (!medicine) return null;

  return (
    <div className="bg-white rounded-[22px] border border-[#e7edf6] shadow-[0_8px_30px_rgba(32,77,139,0.08)] p-[18px]" style={{ marginBottom: 12 }}>
      <div className="flex items-center justify-between gap-[10px]" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: "1.32rem", color: "#1f2937" }}>
          {medicine.name} {medicine.dosage}
        </h3>
        <span style={{ fontSize: "0.82rem", color: "#6b7280", fontWeight: 600 }}>
          {medicine.frequency || "Daily"}
        </span>
      </div>

      <div>
        {(medicine.statuses || []).map((statusItem) => (
          <div
            key={`${medicine.medicine_id}-${statusItem.time}`}
            className="flex items-center justify-between gap-[10px]"
            style={{
              border: "1px solid #edf1f6",
              borderRadius: 12,
              padding: "10px 12px",
              marginBottom: 8,
            }}
          >
            <span style={{ color: "#334155", fontWeight: 600 }}>{statusItem.time}</span>
            <span
              style={{
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "capitalize",
                background: (STATUS_STYLES[statusItem.status] || STATUS_STYLES.pending).bg,
                color: (STATUS_STYLES[statusItem.status] || STATUS_STYLES.pending).text,
              }}
            >
              {statusItem.status}
            </span>
            {statusItem.status !== "taken" ? (
              <button
                type="button"
                onClick={() => onMarkTaken?.(medicine.medicine_id, statusItem.time)}
                className="ml-2 px-3 py-1 rounded-lg bg-[#2a79e8] text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                Mark taken
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
