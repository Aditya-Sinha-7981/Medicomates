import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function PatientListCard({ patient, index = 0 }) {
  const weekly = Number(patient?.weekly_percentage ?? 0);
  const needsAttention = weekly < 60;

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
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
          {weekly}%
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Weekly adherence with scheduled doses.
      </p>
      {needsAttention ? (
        <span className="mt-3 inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
          Needs attention
        </span>
      ) : (
        <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          Stable
        </span>
      )}
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
