import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ADHERENCE_ATTENTION_THRESHOLD } from "../utils/adherenceThreshold";

export default function PatientListCard({ patient, index = 0 }) {
  const weekly = Number(patient?.weekly_percentage ?? 0);
  const needsAttention = weekly < ADHERENCE_ATTENTION_THRESHOLD;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -2, scale: 1.01 }}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-800">{patient?.full_name || "Unknown patient"}</p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            needsAttention
              ? "bg-rose-100 text-rose-800 ring-1 ring-rose-200/80"
              : "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80"
          }`}
        >
          {weekly}%
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Adherence with scheduled doses over the last 30 days.
      </p>
      <div className="mt-3">
        <Link
          to={`/patient/${patient?.patient_id}`}
          className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          View profile
        </Link>
      </div>
    </motion.div>
  );
}
