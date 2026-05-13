import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { api, endpoints } from "../services/api.js";
import { Skeleton } from "./ui/Skeleton";

export default function InsightCard({ patientId, enabled = true }) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!enabled || !patientId) return;
      setLoading(true);
      setError(false);
      try {
        const result = await api.get(endpoints.dashboard.insight(patientId));
        if (!cancelled) setInsight(result?.insight || "");
      } catch {
        if (!cancelled) {
          setError(true);
          setInsight("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, patientId]);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h2 className="text-base font-semibold text-slate-900">AI insight</h2>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
          Local + Gemini
        </span>
      </div>
      {loading ? (
        <div className="mt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <p className="mt-3 text-xs text-slate-500">Analyzing 30 days of data...</p>
        </div>
      ) : error ? (
        <p className="mt-3 text-sm text-slate-500">Insight unavailable right now.</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-700">
            {insight || "Insight unavailable right now."}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            For informational purposes only. Not medical advice.
          </p>
        </>
      )}
    </section>
  );
}
