import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { getCurrentUser } from "../utils/auth";
import { api, endpoints } from "../services/api.js";

function sortByConnectedAt(rows) {
  return [...rows].sort((a, b) => {
    const ta = a.connected_at ? Date.parse(a.connected_at) : 0;
    const tb = b.connected_at ? Date.parse(b.connected_at) : 0;
    return tb - ta;
  });
}

export default function ReviewingListPage() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (user.role !== "patient") {
      navigate("/doctor", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id || user.role !== "patient") return;
      setLoading(true);
      setError("");
      try {
        const list = await api.get(endpoints.connections.reviewing());
        if (cancelled) return;
        setRows(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load list.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, navigate]);

  const sorted = useMemo(() => sortByConnectedAt(rows), [rows]);

  if (!user || user.role !== "patient") return null;

  return (
    <AppShell
      title="People I'm reviewing"
      subtitle="Read-only access for each connected patient"
      actions={
        <button
          type="button"
          onClick={() => navigate("/patient")}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Back to dashboard
        </button>
      }
    >
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 animate-pulse">
          Loading…
        </div>
      ) : sorted.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((pat) => (
            <div
              key={pat.patient_id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-brand-soft-border bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-sm font-semibold text-slate-800">
                  {(pat.full_name || "P").charAt(0)}
                </div>
                <p className="truncate text-sm font-semibold text-slate-900">{pat.full_name}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/review/${pat.patient_id}`)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          You are not reviewing anyone yet. When a patient adds you as their reviewer, they will
          appear here.
        </p>
      )}
    </AppShell>
  );
}
