import { useState, useEffect, useCallback } from "react";
import { getCurrentUser } from "../utils/auth";
import { api, endpoints } from "../services/api.js";

const OVERLAY_KEY = "medicomates_dose_overlay";
const CANCELLED_KEY = "medicomates_cancelled_medicines";

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getDateKey = (date) => date.toISOString().slice(0, 10);

/** HH:mm in UTC — matches naive `reminder_times` / status `time` strings when API uses Z timestamps */
const utcTimeFromIso = (iso) => {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const readOverlay = () => safeParse(localStorage.getItem(OVERLAY_KEY), []);
const writeOverlay = (entries) =>
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(entries));

const readCancelled = () => safeParse(localStorage.getItem(CANCELLED_KEY), []);
const writeCancelled = (entries) =>
  localStorage.setItem(CANCELLED_KEY, JSON.stringify(entries));

function applyDashboardOverlay(dashboard, patientId) {
  if (!dashboard) return dashboard;
  const overlay = readOverlay().filter((o) => o.patient_id === patientId);
  const cancelledIds = new Set(
    readCancelled()
      .filter((c) => c.patient_id === patientId)
      .map((c) => c.medicine_id)
  );
  const todayKey = getDateKey(new Date());

  const todays_medicines = (dashboard.todays_medicines || [])
    .filter((m) => !cancelledIds.has(m.medicine_id))
    .map((m) => ({
      ...m,
      statuses: (m.statuses || []).map((s) => {
        const ov = overlay.find(
          (o) =>
            o.medicine_id === m.medicine_id &&
            o.date === todayKey &&
            o.time === s.time
        );
        if (ov) {
          return {
            time: s.time,
            status: "taken",
            confirmed_at: ov.confirmed_at,
          };
        }
        return s;
      }),
    }));

  return { ...dashboard, todays_medicines };
}

/**
 * @param {Array<Record<string, unknown>>} logs
 * @param {string} patientId
 */
function applyAdherenceOverlay(logs, patientId) {
  const overlay = readOverlay().filter((o) => o.patient_id === patientId);
  return logs.map((log) => {
    const dateKey = new Date(log.scheduled_time).toISOString().slice(0, 10);
    const timeStr = utcTimeFromIso(log.scheduled_time);
    const ov = overlay.find(
      (o) =>
        o.medicine_id === log.medicine_id &&
        o.date === dateKey &&
        o.time === timeStr
    );
    if (ov) {
      return {
        ...log,
        status: "taken",
        confirmed_at: ov.confirmed_at,
      };
    }
    return log;
  });
}

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
    if (!user?.id) {
      setError("No user logged in");
      setLoading(false);
      return;
    }

    try {
      const patientId = user.id;
      const [dashboardRaw, doctors, visits, adherenceLogsRaw] = await Promise.all([
        api.get(endpoints.dashboard.patient(patientId)),
        api.get(endpoints.connections.doctorsForPatient(patientId)),
        api.get(endpoints.visits.list(patientId)),
        api.get(endpoints.adherence.logs(patientId, 30)),
      ]);

      const dashboard = applyDashboardOverlay(dashboardRaw, patientId);
      const adherenceLogs = applyAdherenceOverlay(
        Array.isArray(adherenceLogsRaw) ? adherenceLogsRaw : [],
        patientId
      );

      setData({
        dashboard,
        doctors: Array.isArray(doctors) ? doctors : [],
        visits: Array.isArray(visits) ? visits : [],
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

      const overlay = readOverlay();
      const dateKey = getDateKey(new Date());
      const nextEntry = {
        patient_id: user.id,
        medicine_id: medicineId,
        date: dateKey,
        time,
        confirmed_at: new Date().toISOString(),
      };
      const filtered = overlay.filter(
        (o) =>
          !(
            o.patient_id === user.id &&
            o.medicine_id === medicineId &&
            o.date === dateKey &&
            o.time === time
          )
      );
      filtered.push(nextEntry);
      writeOverlay(filtered);
      loadData();
    },
    [loadData]
  );

  const markDoseUntaken = useCallback(
    (medicineId, time) => {
      const user = getCurrentUser();
      if (!user) return;

      const dateKey = getDateKey(new Date());
      const filtered = readOverlay().filter(
        (o) =>
          !(
            o.patient_id === user.id &&
            o.medicine_id === medicineId &&
            o.date === dateKey &&
            o.time === time
          )
      );
      writeOverlay(filtered);
      loadData();
    },
    [loadData]
  );

  const cancelMedicine = useCallback(
    (medicineId) => {
      const user = getCurrentUser();
      if (!user) return;

      const cancelled = readCancelled();
      const exists = cancelled.some(
        (c) => c.patient_id === user.id && c.medicine_id === medicineId
      );
      if (!exists) {
        cancelled.push({ patient_id: user.id, medicine_id: medicineId });
        writeCancelled(cancelled);
      }
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
