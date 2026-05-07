import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";

import { getCurrentUser } from "../utils/auth";

const MEDICINES_KEY = "medicomates_medicines";

const defaultForm = {
  patient_id: "",
  name: "",
  dosage: "",
  frequency: "",
  reminder_times: ["08:00"],
  notes: "",
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
    <main className="min-h-screen bg-[#f3f6fb] pb-24 md:pb-0 md:pl-24 font-sans text-slate-800 flex items-center justify-center">
      <div className="w-full max-w-4xl mx-auto p-4 md:p-8">
        <div className="bg-white rounded-[32px] shadow-sm border border-[#e2e8f0] p-6 md:p-10">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h1 className="m-0 text-3xl font-extrabold text-slate-800">
              {isEdit ? "Edit Medicine" : "Add Medicine"}
            </h1>
            <button
              onClick={() => navigate("/patient")}
              className="text-gray-500 hover:text-gray-800 font-semibold self-start md:self-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>

          {error && <p className="text-red-500 bg-red-50 p-4 rounded-xl mb-6 font-medium">{error}</p>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Medicine Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter medicine name"
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-4 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#2a79e8] focus:bg-white transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Dosage</label>
                <input
                  type="text"
                  name="dosage"
                  value={formData.dosage}
                  onChange={handleChange}
                  required
                  placeholder="Enter dosage"
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-4 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#2a79e8] focus:bg-white transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Frequency</label>
                <input
                  type="text"
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                  required
                  placeholder="Enter frequency"
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-4 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#2a79e8] focus:bg-white transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Notes (Optional)</label>
                <input
                  type="text"
                  name="notes"
                  value={formData.notes || ""}
                  onChange={handleChange}
                  placeholder="e.g. take after food"
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-4 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#2a79e8] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Reminder Times</label>
              <div className="flex flex-col gap-3">
                {formData.reminder_times.map((time, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => handleTimeChange(index, e.target.value)}
                      required
                      className="flex-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-4 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#2a79e8] focus:bg-white transition-all"
                    />
                    {formData.reminder_times.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTime(index)}
                        className="w-[52px] h-[52px] bg-red-50 text-red-500 rounded-xl font-bold flex items-center justify-center hover:bg-red-100 transition-colors"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTime}
                className="mt-2 text-[#2a79e8] font-bold text-sm bg-blue-50 px-4 py-2.5 rounded-lg self-start hover:bg-blue-100 transition-colors"
              >
                + Add Another Time
              </button>
            </div>

            <div className="mt-8">
              <button type="submit" disabled={loading} className="w-full md:w-auto md:px-12 h-14 rounded-2xl bg-[#2a79e8] text-white text-lg font-bold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
                {loading ? "Saving..." : isEdit ? "Update Medicine" : "Save Medicine"}
              </button>
            </div>
          </form>

        </div>
      </div>
      <BottomNav />
    </main>
  );
}
