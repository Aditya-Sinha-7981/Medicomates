import { useState, useEffect, useCallback } from "react";
import { getCurrentUser } from "../utils/auth";

const MEDICINES_KEY = "medicomates_medicines";
const DOSE_LOGS_KEY = "medicomates_dose_logs";

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getDateKey = (date) => date.toISOString().slice(0, 10);
const getTimestampForDose = (dateKey, time) => new Date(`${dateKey}T${time}:00`).toISOString();

const readMedicines = () => safeParse(localStorage.getItem(MEDICINES_KEY), []);
const readDoseLogs = () => safeParse(localStorage.getItem(DOSE_LOGS_KEY), []);
const writeMedicines = (medicines) =>
  localStorage.setItem(MEDICINES_KEY, JSON.stringify(medicines));
const writeDoseLogs = (doseLogs) =>
  localStorage.setItem(DOSE_LOGS_KEY, JSON.stringify(doseLogs));

const resolveDoseStatus = ({ logEntry, scheduledDate, isToday }) => {
  if (logEntry?.status === "taken") return "taken";
  if (isToday) {
    return scheduledDate <= new Date() ? "missed" : "pending";
  }
  return scheduledDate < new Date() ? "missed" : "pending";
};

export default function usePatientData() {
  const [data, setData] = useState({
    dashboard: null,
    doctors: [],
    visits: [],
    adherenceLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const user = getCurrentUser();
    if (!user) {
      setError("No user logged in");
      setLoading(false);
      return;
    }

    try {
      const medicines = readMedicines().filter(
        (medicine) => medicine.patient_id === user.id && medicine.is_active !== false
      );
      const doseLogs = readDoseLogs().filter((log) => log.patient_id === user.id);

      const now = new Date();
      const todayKey = getDateKey(now);

      const todaysMedicines = medicines.map((medicine) => {
        const statuses = (medicine.reminder_times || []).map((time) => {
          const scheduledDate = new Date(`${todayKey}T${time}:00`);
          const logEntry = doseLogs.find(
            (log) =>
              log.medicine_id === medicine.id &&
              log.date === todayKey &&
              log.time === time
          );

          return {
            time,
            status: resolveDoseStatus({ logEntry, scheduledDate, isToday: true }),
            confirmed_at: logEntry?.confirmed_at || null,
          };
        });

        return {
          medicine_id: medicine.id,
          id: medicine.id,
          name: medicine.name,
          dosage: medicine.dosage,
          frequency: medicine.frequency,
          reminder_times: medicine.reminder_times || [],
          is_active: medicine.is_active !== false,
          statuses,
        };
      });

      const adherenceLogs = [];
      for (let dayOffset = 29; dayOffset >= 0; dayOffset -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - dayOffset);
        const dateKey = getDateKey(date);

        medicines.forEach((medicine) => {
          (medicine.reminder_times || []).forEach((time) => {
            const scheduledDate = new Date(`${dateKey}T${time}:00`);
            const logEntry = doseLogs.find(
              (log) =>
                log.medicine_id === medicine.id &&
                log.date === dateKey &&
                log.time === time
            );
            adherenceLogs.push({
              id: `${medicine.id}-${dateKey}-${time}`,
              medicine_id: medicine.id,
              medicine_name: medicine.name,
              scheduled_time: getTimestampForDose(dateKey, time),
              confirmed_at: logEntry?.confirmed_at || null,
              status: resolveDoseStatus({
                logEntry,
                scheduledDate,
                isToday: dateKey === todayKey,
              }),
            });
          });
        });
      }

      const takenDoses = adherenceLogs.filter((log) => log.status === "taken").length;
      const totalScheduledDoses = adherenceLogs.length;
      const weeklyPercentage =
        totalScheduledDoses === 0
          ? 0
          : Math.round((takenDoses / totalScheduledDoses) * 100);

      setData({
        dashboard: {
          profile: { full_name: user.full_name || user.name || user.email },
          weekly_percentage: weeklyPercentage,
          todays_medicines: todaysMedicines,
        },
        doctors: [],
        visits: [],
        adherenceLogs,
      });
    } catch (err) {
      setError(err.message || "Failed to load patient data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markDoseTaken = useCallback(
    (medicineId, time) => {
      const user = getCurrentUser();
      if (!user) return;

      const doseLogs = readDoseLogs();
      const dateKey = getDateKey(new Date());
      const existingIndex = doseLogs.findIndex(
        (log) =>
          log.patient_id === user.id &&
          log.medicine_id === medicineId &&
          log.date === dateKey &&
          log.time === time
      );
      const nextEntry = {
        patient_id: user.id,
        medicine_id: medicineId,
        date: dateKey,
        time,
        status: "taken",
        confirmed_at: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        doseLogs[existingIndex] = nextEntry;
      } else {
        doseLogs.push(nextEntry);
      }

      writeDoseLogs(doseLogs);
      loadData();
    },
    [loadData]
  );

  const markDoseUntaken = useCallback(
    (medicineId, time) => {
      const user = getCurrentUser();
      if (!user) return;

      const doseLogs = readDoseLogs().filter(
        (log) =>
          !(
            log.patient_id === user.id &&
            log.medicine_id === medicineId &&
            log.date === getDateKey(new Date()) &&
            log.time === time
          )
      );
      writeDoseLogs(doseLogs);
      loadData();
    },
    [loadData]
  );

  const cancelMedicine = useCallback(
    (medicineId) => {
      const user = getCurrentUser();
      if (!user) return;

      const medicines = readMedicines();
      const updatedMedicines = medicines.map((medicine) => {
        if (medicine.id === medicineId && medicine.patient_id === user.id) {
          return { ...medicine, is_active: false };
        }
        return medicine;
      });

      writeMedicines(updatedMedicines);
      loadData();
    },
    [loadData]
  );

  return {
    ...data,
    loading,
    error,
    refresh: loadData,
    markDoseTaken,
    markDoseUntaken,
    cancelMedicine,
  };
}
