import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarIcon, Clock4 } from "lucide-react";
import { motion } from "framer-motion";
import AppShell from "../components/layout/AppShell";

import { getCurrentUser } from "../utils/auth";

const MEDICINES_KEY = "medicomates_medicines";

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

export default function MedicineForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const editMedicine = location.state?.medicine || null;
  const isEdit = !!editMedicine;

  const [formData, setFormData] = useState(() => {
    if (editMedicine) return editMedicine;
    const user = getCurrentUser();
    return { ...defaultForm, patient_id: user?.id || "" };
  });

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTimeChange = (index, value) => {
    const newTimes = [...formData.reminder_times];
    newTimes[index] = value;
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
    setFormData((prev) => ({ ...prev, reminder_times: newTimes }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = getCurrentUser();
      if (!user) {
        throw new Error("Please log in again");
      }

      const medicines = JSON.parse(localStorage.getItem(MEDICINES_KEY) || "[]");
      const payload = {
        id: editMedicine?.id || editMedicine?.medicine_id || `med_${Date.now()}`,
        patient_id: formData.patient_id || user.id,
        name: formData.name.trim(),
        dosage: formData.dosage.trim(),
        frequency: formData.frequency.trim(),
        reminder_times: formData.reminder_times,
        notes: formData.notes?.trim() || "",
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        is_active: true,
        created_at: editMedicine?.created_at || new Date().toISOString(),
      };

      if (isEdit) {
        const updated = medicines.map((medicine) =>
          medicine.id === payload.id ? payload : medicine
        );
        localStorage.setItem(MEDICINES_KEY, JSON.stringify(updated));
      } else {
        medicines.push(payload);
        localStorage.setItem(MEDICINES_KEY, JSON.stringify(medicines));
      }

      navigate("/patient");
    } catch (err) {
      setError(err.message || "Failed to save medicine");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title={isEdit ? "Edit Medicine" : "Add Medicine"} subtitle="Medication schedule setup">
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
                Keep details clear so reminders feel effortless for the patient.
              </p>
            </div>
            <button
              onClick={() => navigate("/patient")}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50/60 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Back to dashboard
            </button>
          </div>

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
                disabled={loading}
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
