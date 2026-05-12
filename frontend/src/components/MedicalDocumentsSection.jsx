import { useCallback, useEffect, useState } from "react";
import { FileText, Trash2, ExternalLink, Loader2, Upload, Pencil, Download } from "lucide-react";
import { api, endpoints } from "../services/api.js";
import { useToast } from "./ui/ToastContext";

/**
 * @param {{ variant: "self" | "patient"; patientId?: string }} props
 * variant "self" — current user's documents (Reports page).
 * variant "patient" — doctor on patient's chart (dedicated page); read-only until Edit per row.
 */
export default function MedicalDocumentsSection({ variant, patientId }) {
  const { showToast } = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [edits, setEdits] = useState({});
  /** @type {string | null} */
  const [editingId, setEditingId] = useState(null);

  const isDoctorChart = variant === "patient";

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
      setEditingId((cur) => {
        if (cur && !next[cur]) return null;
        return cur;
      });
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

  const syncEditFromDoc = (d) => {
    setEdits((prev) => ({
      ...prev,
      [d.id]: { title: d.title || "", notes: d.notes || "" },
    }));
  };

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
      setEditingId(null);
      await load();
    } catch (err) {
      showToast({ message: err.message || "Save failed", variant: "error" });
    }
  };

  const cancelEdit = (d) => {
    setEditingId(null);
    syncEditFromDoc(d);
  };

  const removeDoc = async (id) => {
    if (!window.confirm("Delete this document permanently?")) return;
    try {
      await api.delete(endpoints.documents.remove(id));
      showToast({ message: "Document deleted.", variant: "success" });
      if (editingId === id) setEditingId(null);
      await load();
    } catch (err) {
      showToast({ message: err.message || "Delete failed", variant: "error" });
    }
  };

  const safeDownloadName = (d) => {
    const base = (d.original_filename || d.title || "document").replace(/[^\w.\-]+/g, "_");
    return base.length > 120 ? base.slice(0, 120) : base;
  };

  if (variant === "patient" && !patientId) return null;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Medical documents</h2>
        <p className="text-sm text-slate-500">
          PDF, JPEG, PNG, or WebP (max 20MB). Images are compressed on our server before storage.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 sm:p-5">
        <label className="flex cursor-pointer flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <span className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload a report"}
          </span>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFile}
            disabled={uploading}
          />
          <span className="text-center text-xs text-slate-500 sm:text-left">
            Choose a file — it appears in the list below when complete.
          </span>
        </label>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No documents yet. Upload one above.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
          {docs.map((d) => {
            const isEditing = editingId === d.id;
            return (
              <li key={d.id} className="p-3 sm:p-3.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900" title={d.original_filename}>
                          {d.original_filename}
                        </p>
                        {!isEditing ? (
                          <p className="mt-0.5 truncate text-xs text-slate-600">
                            {d.title?.trim() ? (
                              <span title={d.title}>{d.title}</span>
                            ) : (
                              <span className="text-slate-400">No title yet — click Edit to add</span>
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                    <a
                      href={d.secure_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 sm:text-xs"
                    >
                      <ExternalLink className="h-3 w-3" /> Open
                    </a>
                    <a
                      href={d.secure_url}
                      download={safeDownloadName(d)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 sm:text-xs"
                    >
                      <Download className="h-3 w-3" /> Download
                    </a>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveMeta(d.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 sm:text-xs"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelEdit(d)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 sm:text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDoc(d.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 sm:text-xs"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            syncEditFromDoc(d);
                            setEditingId(d.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 sm:text-xs"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        {!isDoctorChart ? (
                          <button
                            type="button"
                            onClick={() => removeDoc(d.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 sm:text-xs"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
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
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Notes</label>
                      <textarea
                        value={edits[d.id]?.notes ?? ""}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [d.id]: { ...prev[d.id], notes: e.target.value },
                          }))
                        }
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        placeholder="Optional context for your care team"
                      />
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
