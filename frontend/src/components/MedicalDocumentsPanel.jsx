import { useCallback, useEffect, useState } from "react";
import { FileText, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { api, endpoints } from "../services/api.js";
import { useToast } from "./ui/ToastContext";

/**
 * @param {{ variant: "self" | "patient"; patientId?: string }} props
 * variant "self" — current user's documents (profile).
 * variant "patient" — doctor viewing connected patient; patientId required.
 */
export default function MedicalDocumentsPanel({ variant, patientId }) {
  const { showToast } = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [edits, setEdits] = useState({});

  const listPath =
    variant === "patient" && patientId
      ? endpoints.documents.patient(patientId)
      : endpoints.documents.me();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.get(listPath);
      setDocs(Array.isArray(rows) ? rows : []);
      const next = {};
      (Array.isArray(rows) ? rows : []).forEach((d) => {
        next[d.id] = { title: d.title || "", notes: d.notes || "" };
      });
      setEdits(next);
    } catch (err) {
      showToast({ message: err.message || "Could not load documents", variant: "error" });
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [listPath, showToast]);

  useEffect(() => {
    if (variant === "patient" && !patientId) return;
    load();
  }, [variant, patientId, load]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showToast({ message: "File must be 20MB or smaller.", variant: "error" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (variant === "patient" && patientId) {
        fd.append("patient_id", patientId);
      }
      await api.upload(endpoints.documents.upload(), fd);
      showToast({ message: "Document uploaded.", variant: "success" });
      await load();
    } catch (err) {
      showToast({ message: err.message || "Upload failed", variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  const saveMeta = async (id) => {
    const row = edits[id];
    if (!row?.title?.trim()) {
      showToast({ message: "Title is required.", variant: "error" });
      return;
    }
    try {
      await api.patch(endpoints.documents.update(id), {
        title: row.title.trim(),
        notes: row.notes?.trim() || null,
      });
      showToast({ message: "Saved.", variant: "success" });
      await load();
    } catch (err) {
      showToast({ message: err.message || "Save failed", variant: "error" });
    }
  };

  const removeDoc = async (id) => {
    if (!window.confirm("Delete this document permanently?")) return;
    try {
      await api.delete(endpoints.documents.remove(id));
      showToast({ message: "Document deleted.", variant: "success" });
      await load();
    } catch (err) {
      showToast({ message: err.message || "Delete failed", variant: "error" });
    }
  };

  if (variant === "patient" && !patientId) return null;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Medical documents</h2>
          <p className="text-sm text-slate-500">
            PDF, JPEG, PNG, or WebP (max 20MB). Images are compressed on our server before storage.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {uploading ? "Uploading…" : "Upload"}
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFile} disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No documents yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {docs.map((d) => (
            <li key={d.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="truncate max-w-[200px]">{d.original_filename}</span>
                </div>
                <div className="flex gap-2">
                  <a
                    href={d.secure_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                  <button
                    type="button"
                    onClick={() => removeDoc(d.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Title</label>
                  <input
                    type="text"
                    value={edits[d.id]?.title ?? ""}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [d.id]: { ...prev[d.id], title: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Notes</label>
                  <textarea
                    value={edits[d.id]?.notes ?? ""}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [d.id]: { ...prev[d.id], notes: e.target.value },
                      }))
                    }
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Optional context for your care team"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => saveMeta(d.id)}
                className="mt-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Save title & notes
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
