import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarIcon, Clock4, FileImage } from "lucide-react";
import { motion } from "framer-motion";
import AppShell from "../components/layout/AppShell";
import { getCurrentUser } from "../utils/auth";
import { api, endpoints } from "../services/api.js";
import { useToast } from "../components/ui/ToastContext";

const LOCAL_MEDICINES_KEY = "medicomates_local_medicines";

const defaultForm = {
  patient_id: "",
  name: "",
  dosage: "",
  frequency: "",
  reminder_times: ["08:00"],
  notes: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
};

const normalizeOcrField = (value) => {
  if (value == null || value === "null") return "";
  return String(value).trim();
};

const normalizeTimeValue = (t) => {
  if (!t || typeof t !== "string") return "08:00";
  return t.length >= 5 ? t.slice(0, 5) : t;
};

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const readLocalMedicines = () => safeParse(localStorage.getItem(LOCAL_MEDICINES_KEY), []);
const writeLocalMedicines = (entries) =>
  localStorage.setItem(LOCAL_MEDICINES_KEY, JSON.stringify(entries));

function buildInitialForm(editMedicine, user, patientIdFromState) {
  if (editMedicine) {
    return {
      patient_id: patientIdFromState || editMedicine.patient_id || user?.id || "",
      name: editMedicine.name || "",
      dosage: editMedicine.dosage || "",
      frequency: editMedicine.frequency || "",
      reminder_times:
        editMedicine.reminder_times?.length > 0
          ? editMedicine.reminder_times.map(normalizeTimeValue)
          : ["08:00"],
      notes: editMedicine.notes || "",
      start_date: editMedicine.start_date || defaultForm.start_date,
      end_date: editMedicine.end_date || "",
    };
  }
  return { ...defaultForm, patient_id: patientIdFromState || user?.id || "" };
}

export default function MedicineForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingSafety, setPendingSafety] = useState(null);

  const editMedicine = location.state?.medicine || null;
  const isEdit = !!editMedicine;
  const doctorMode = Boolean(location.state?.doctorMode);
  const returnTo = location.state?.returnTo || "/patient";
  const patientIdFromState = location.state?.patientId || "";

  const [formData, setFormData] = useState(() =>
    buildInitialForm(editMedicine, getCurrentUser(), patientIdFromState)
  );

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTimeChange = (index, value) => {
    const newTimes = [...formData.reminder_times];
    newTimes[index] = normalizeTimeValue(value);
    setFormData((prev) => ({ ...prev, reminder_times: newTimes }));
  };

  const addTime = () => {
    setFormData((prev) => ({
      ...prev,
      reminder_times: [...prev.reminder_times, "08:00"],
    }));
  };

  const removeTime = (index) => {
    const newTimes = formData.reminder_times.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, reminder_times: newTimes.length ? newTimes : ["08:00"] }));
  };

  const handleOcrFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", file);
      const result = await api.upload(endpoints.ocr(), body);
      const first = Array.isArray(result) ? result[0] : null;
      if (!first) {
        throw new Error("Could not read prescription. Try again or enter details manually.");
      }
      setFormData((prev) => ({
        ...prev,
        name: normalizeOcrField(first.name) || prev.name,
        dosage: normalizeOcrField(first.dosage) || prev.dosage,
        frequency: normalizeOcrField(first.frequency) || prev.frequency,
        notes: normalizeOcrField(first.notes) || prev.notes,
        reminder_times:
          Array.isArray(first.reminder_times) && first.reminder_times.length > 0
            ? first.reminder_times.map(normalizeTimeValue)
            : prev.reminder_times,
      }));
      showToast({
        message: "Prescription details extracted. Please review before saving.",
        variant: "success",
      });
    } catch (err) {
      const msg =
        err?.message?.includes("PDF")
          ? "PDF upload is not available yet. Please upload a JPG or PNG image."
          : err.message || "OCR failed";
      setError(msg);
      showToast({
        message: msg,
        variant: "error",
      });
    } finally {
      setOcrLoading(false);
    }
  };

  const buildMedicinePayload = () => {
    const user = getCurrentUser();
    if (!user) {
      throw new Error("Please log in again");
    }
    const patientId = patientIdFromState || formData.patient_id || user.id;
    const normalizedTimes = formData.reminder_times.map(normalizeTimeValue).filter(Boolean);
    const hasDuplicateTimes = new Set(normalizedTimes).size !== normalizedTimes.length;
    if (!normalizedTimes.length) {
      throw new Error("Please add at least one reminder time.");
    }
    if (hasDuplicateTimes) {
      throw new Error("Reminder times must be unique.");
    }
    if (formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
      throw new Error("End date cannot be earlier than start date.");
    }
    return {
      patient_id: patientId,
      name: formData.name.trim(),
      dosage: formData.dosage.trim(),
      frequency: formData.frequency.trim(),
      reminder_times: normalizedTimes,
      start_date: formData.start_date || null,
      end_date: formData.end_date?.trim() ? formData.end_date.trim() : null,
      notes: formData.notes?.trim() ? formData.notes.trim() : null,
      doctor_id: doctorMode && user.role === "doctor" ? user.id : null,
    };
  };

  const finalizeAfterCreate = (body, created) => {
    const local = readLocalMedicines();
    const createdId =
      created?.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = local.filter((m) => m.id !== createdId);
    next.push({ ...body, id: createdId, is_active: true });
    writeLocalMedicines(next);
    showToast({ message: "Medicine added successfully.", variant: "success" });
    navigate(returnTo);
  };

  const handleConfirmSafety = async () => {
    if (!pendingSafety) return;
    const snapshot = pendingSafety;
    setLoading(true);
    setError("");
    try {
      const ack = [];
      if (snapshot.warnings?.some((w) => w.type === "allergy")) {
        ack.push("allergy");
      }
      if (snapshot.interactions?.length) {
        ack.push("interaction");
      }
      const created = await api.post(endpoints.medicines.confirm(), {
        ...snapshot.medicine_data,
        rxcui: snapshot.rxcui ?? null,
        acknowledged_warnings: ack,
      });
      setPendingSafety(null);
      finalizeAfterCreate(snapshot.medicine_data, created);
    } catch (err) {
      setError(err.message || "Failed to save medicine");
      showToast({ message: err.message || "Failed to save medicine", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const body = buildMedicinePayload();

      if (isEdit) {
        const user = getCurrentUser();
        if (!user) {
          throw new Error("Please log in again");
        }
        const medicineId = editMedicine.medicine_id || editMedicine.id;
        await api.put(endpoints.medicines.update(medicineId), body);
        const local = readLocalMedicines();
        const next = local.filter((m) => m.id !== medicineId);
        next.push({ ...editMedicine, ...body, id: medicineId, is_active: true });
        writeLocalMedicines(next);
        showToast({ message: "Medicine updated successfully.", variant: "success" });
        navigate(returnTo);
        return;
      }

      const created = await api.post(endpoints.medicines.create(), body);
      if (created?.status === "warnings") {
        setPendingSafety({
          warnings: created.warnings || [],
          interactions: created.interactions || [],
          medicine_data: created.medicine_data,
          rxcui: created.rxcui ?? null,
        });
        return;
      }
      finalizeAfterCreate(body, created);
    } catch (err) {
      setError(err.message || "Failed to save medicine");
      showToast({
        message: err.message || "Failed to save medicine",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title={isEdit ? "Edit Medicine" : "Add Medicine"} subtitle="Medication schedule setup">
      {pendingSafety ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="safety-modal-title"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-200 bg-white p-5 shadow-xl">
            <h2 id="safety-modal-title" className="text-lg font-semibold text-slate-900">
              Safety check — please review
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              The drug database flagged a possible issue. You can cancel or add this medicine anyway
              after confirming you have reviewed the information.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {pendingSafety.warnings?.length ? (
                <li>
                  <p className="font-semibold text-amber-900">Allergies / verification</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
                    {pendingSafety.warnings.map((w, i) => (
                      <li key={`w-${i}`}>{w.message}</li>
                    ))}
                  </ul>
                </li>
              ) : null}
              {pendingSafety.interactions?.length ? (
                <li>
                  <p className="font-semibold text-amber-900">Drug interactions</p>
                  <ul className="mt-1 list-disc space-y-2 pl-5 text-slate-700">
                    {pendingSafety.interactions.map((it, i) => (
                      <li key={`i-${i}`}>
                        <span className="font-medium">
                          {it.drug1} + {it.drug2}
                        </span>
                        : {it.description}
                        {it.severity ? (
                          <span className="text-slate-500"> ({it.severity})</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ) : null}
            </ul>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingSafety(null)}
                disabled={loading}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel — do not add
              </button>
              <button
                type="button"
                onClick={handleConfirmSafety}
                disabled={loading}
                className="rounded-full bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? "Saving…" : "I understand, add anyway"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full max-w-4xl">
        <motion.div
          className="rounded-[30px] border border-slate-100 bg-white/80 shadow-[0_22px_60px_rgba(15,23,42,0.08)] p-5 md:p-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
                Medication plan
              </p>
              <h1 className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {isEdit ? "Edit medicine" : "Add new medicine"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Upload a prescription photo to prefill fields, then review before saving.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(returnTo)}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50/60 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Back to dashboard
            </button>
          </div>

          <section className="mb-6 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 md:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
                  <FileImage className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Prescription OCR</p>
                  <p className="text-xs text-slate-600">
                    JPG or PNG (max 10MB). Results are prefilled only — always confirm before saving.
                  </p>
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-50">
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleOcrFile} />
                {ocrLoading ? "Reading…" : "Upload prescription"}
              </label>
            </div>
          </section>

          {error ? (
            <p className="mb-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-7">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Medicine name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter medicine name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm md:text-base text-slate-900 outline-none ring-0 transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Dosage
                </label>
                <input
                  type="text"
                  name="dosage"
                  value={formData.dosage}
                  onChange={handleChange}
                  required
                  placeholder="Enter dosage"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm md:text-base text-slate-900 outline-none ring-0 transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Frequency
                </label>
                <input
                  type="text"
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                  required
                  placeholder="Enter frequency"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm md:text-base text-slate-900 outline-none ring-0 transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  name="notes"
                  value={formData.notes || ""}
                  onChange={handleChange}
                  placeholder="Any special instruction for this medicine"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm md:text-base text-slate-900 outline-none ring-0 transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Start date
                </label>
                <div className="relative">
                  <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date || ""}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-9 pr-3.5 py-3 text-sm md:text-base text-slate-900 outline-none ring-0 transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  End date (optional)
                </label>
                <div className="relative">
                  <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date || ""}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-9 pr-3.5 py-3 text-sm md:text-base text-slate-900 outline-none ring-0 transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Leave blank if this medicine is part of an ongoing plan.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Reminder times
                  </label>
                  <p className="text-[11px] md:text-xs text-slate-400">
                    Set one or more times that work with the patient’s routine.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {formData.reminder_times.map((time, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Clock4 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => handleTimeChange(index, e.target.value)}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-9 pr-3.5 py-3 text-sm md:text-base text-slate-900 outline-none ring-0 transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                    {formData.reminder_times.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeTime(index)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100"
                      >
                        <span className="text-lg leading-none">×</span>
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addTime}
                className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
              >
                <span className="text-base leading-none">+</span>
                Add another time
              </button>
            </section>

            <div className="pt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <p className="text-[11px] md:text-xs text-slate-400">
                You can always adjust times later if the patient’s routine changes.
              </p>
              <button
                type="submit"
                disabled={loading || ocrLoading}
                className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 md:px-8 py-3 text-sm md:text-base font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.45)] transition hover:bg-sky-700 disabled:opacity-60"
              >
                {loading ? "Saving..." : isEdit ? "Update medicine" : "Save medicine"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AppShell>
  );
}
