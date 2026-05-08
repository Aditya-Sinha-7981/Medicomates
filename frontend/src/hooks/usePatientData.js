import { useState, useEffect, useCallback } from "react";
import { getCurrentUser } from "../utils/auth";
import { api, endpoints } from "../services/api.js";

const OVERLAY_KEY = "medicomates_dose_overlay";
const UNTAKEN_KEY = "medicomates_dose_untaken_overlay";
const CANCELLED_KEY = "medicomates_cancelled_medicines";
const LOCAL_MEDICINES_KEY = "medicomates_local_medicines";

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getDateKey = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

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

const readUntakenOverlay = () => safeParse(localStorage.getItem(UNTAKEN_KEY), []);
const writeUntakenOverlay = (entries) =>
  localStorage.setItem(UNTAKEN_KEY, JSON.stringify(entries));

const readCancelled = () => safeParse(localStorage.getItem(CANCELLED_KEY), []);
const writeCancelled = (entries) =>
  localStorage.setItem(CANCELLED_KEY, JSON.stringify(entries));

const readLocalMedicines = () => safeParse(localStorage.getItem(LOCAL_MEDICINES_KEY), []);
const writeLocalMedicines = (entries) =>
  localStorage.setItem(LOCAL_MEDICINES_KEY, JSON.stringify(entries));

function isMedicineActiveForToday(medicine, todayKey) {
  if (!medicine || medicine.is_active === false) return false;
  if (medicine.start_date && medicine.start_date > todayKey) return false;
  if (medicine.end_date && medicine.end_date < todayKey) return false;
  return true;
}

function buildFallbackStatus(timeStr) {
  const now = new Date();
  const [hour, minute] = String(timeStr || "00:00")
    .split(":")
    .map((value) => Number(value || 0));
  const scheduledToday = new Date(now);
  scheduledToday.setHours(hour, minute, 0, 0);
  return scheduledToday <= now ? "missed" : "pending";
}

function mergeMedicinesForPatient(patientId, apiMedicines) {
  const fromApi = Array.isArray(apiMedicines) ? apiMedicines : [];
  const fromLocal = readLocalMedicines().filter((m) => m.patient_id === patientId);
  const byId = new Map();
  [...fromApi, ...fromLocal].forEach((medicine) => {
    const medId = medicine?.id || medicine?.medicine_id;
    if (!medId) return;
    byId.set(medId, { ...medicine, id: medId });
  });
  return Array.from(byId.values());
}

function applyDashboardOverlay(dashboard, patientId) {
  if (!dashboard) return dashboard;
  const overlay = readOverlay().filter((o) => o.patient_id === patientId);
  const untakenOverlay = readUntakenOverlay().filter((o) => o.patient_id === patientId);
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
        const untaken = untakenOverlay.find(
          (o) =>
            o.medicine_id === m.medicine_id &&
            o.date === todayKey &&
            o.time === s.time
        );
        if (untaken) {
          return {
            ...s,
            status: buildFallbackStatus(s.time),
            confirmed_at: null,
          };
        }
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

function mergeTodaysScheduleFromMedicines(dashboard, medicines, patientId) {
  const baseDashboard = dashboard || {};
  const todayKey = getDateKey(new Date());
  const cancelledIds = new Set(
    readCancelled()
      .filter((c) => c.patient_id === patientId)
      .map((c) => c.medicine_id)
  );
  const overlay = readOverlay().filter((o) => o.patient_id === patientId && o.date === todayKey);
  const untakenOverlay = readUntakenOverlay().filter(
    (o) => o.patient_id === patientId && o.date === todayKey
  );

  const existing = Array.isArray(baseDashboard.todays_medicines)
    ? baseDashboard.todays_medicines.filter((m) => !cancelledIds.has(m.medicine_id))
    : [];
  const existingIds = new Set(existing.map((m) => m.medicine_id));

  const extras = (medicines || [])
    .filter((m) => !cancelledIds.has(m.id))
    .filter((m) => !existingIds.has(m.id))
    .filter((m) => isMedicineActiveForToday(m, todayKey))
    .map((medicine) => {
      const reminderTimes = Array.isArray(medicine.reminder_times)
        ? medicine.reminder_times
        : [];
      const statuses = reminderTimes.map((time) => {
        const untaken = untakenOverlay.find(
          (entry) => entry.medicine_id === medicine.id && entry.time === time
        );
        if (untaken) {
          return { time, status: buildFallbackStatus(time), confirmed_at: null };
        }
        const taken = overlay.find((entry) => entry.medicine_id === medicine.id && entry.time === time);
        if (taken) {
          return { time, status: "taken", confirmed_at: taken.confirmed_at };
        }
        return { time, status: buildFallbackStatus(time), confirmed_at: null };
      });

      return {
        medicine_id: medicine.id,
        name: medicine.name,
        dosage: medicine.dosage,
        frequency: medicine.frequency,
        reminder_times: reminderTimes,
        statuses,
      };
    });

  return {
    ...baseDashboard,
    todays_medicines: [...existing, ...extras],
  };
}

/**
 * @param {Array<Record<string, unknown>>} logs
 * @param {string} patientId
 */
function applyAdherenceOverlay(logs, patientId) {
  const overlay = readOverlay().filter((o) => o.patient_id === patientId);
  const untakenOverlay = readUntakenOverlay().filter((o) => o.patient_id === patientId);
  return logs.map((log) => {
    const dateKey = getDateKey(new Date(log.scheduled_time));
    const timeStr = utcTimeFromIso(log.scheduled_time);
    const untaken = untakenOverlay.find(
      (o) =>
        o.medicine_id === log.medicine_id &&
        o.date === dateKey &&
        o.time === timeStr
    );
    if (untaken) {
      return {
        ...log,
        status: buildFallbackStatus(timeStr),
        confirmed_at: null,
      };
    }
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
    medicines: [],
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
      const [dashboardRes, medicinesRes, doctorsRes, visitsRes, adherenceRes] =
        await Promise.allSettled([
          api.get(endpoints.dashboard.patient(patientId)),
          api.get(endpoints.medicines.list(patientId)),
          api.get(endpoints.connections.doctorsForPatient(patientId)),
          api.get(endpoints.visits.list(patientId)),
          api.get(endpoints.adherence.logs(patientId, 30)),
        ]);

      if (dashboardRes.status === "rejected") {
        throw dashboardRes.reason;
      }

      const dashboardRaw = dashboardRes.value;
      const medicinesApi = medicinesRes.status === "fulfilled" ? medicinesRes.value : [];
      const medicines = mergeMedicinesForPatient(patientId, medicinesApi);
      const doctors = doctorsRes.status === "fulfilled" ? doctorsRes.value : [];
      const visits = visitsRes.status === "fulfilled" ? visitsRes.value : [];
      const adherenceLogsRaw =
        adherenceRes.status === "fulfilled" ? adherenceRes.value : [];

      const dashboardWithOverlay = applyDashboardOverlay(dashboardRaw, patientId);
      const dashboard = mergeTodaysScheduleFromMedicines(
        dashboardWithOverlay,
        medicines,
        patientId
      );
      const adherenceLogs = applyAdherenceOverlay(
        Array.isArray(adherenceLogsRaw) ? adherenceLogsRaw : [],
        patientId
      );

      setData({
        dashboard,
        medicines: Array.isArray(medicines) ? medicines : [],
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
    // Defer first load to avoid sync state updates inside effect body.
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
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
      const untakenFiltered = readUntakenOverlay().filter(
        (o) =>
          !(
            o.patient_id === user.id &&
            o.medicine_id === medicineId &&
            o.date === dateKey &&
            o.time === time
          )
      );
      writeUntakenOverlay(untakenFiltered);

      setData((prev) => {
        const todays = prev.dashboard?.todays_medicines || [];
        const nextTodays = todays.map((medicine) => {
          if (medicine.medicine_id !== medicineId) return medicine;
          return {
            ...medicine,
            statuses: (medicine.statuses || []).map((statusItem) =>
              statusItem.time === time
                ? {
                    ...statusItem,
                    status: "taken",
                    confirmed_at: nextEntry.confirmed_at,
                  }
                : statusItem
            ),
          };
        });
        return {
          ...prev,
          dashboard: prev.dashboard
            ? { ...prev.dashboard, todays_medicines: nextTodays }
            : prev.dashboard,
        };
      });
    },
    []
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
      const untaken = readUntakenOverlay();
      const untakenEntry = {
        patient_id: user.id,
        medicine_id: medicineId,
        date: dateKey,
        time,
      };
      const untakenFiltered = untaken.filter(
        (o) =>
          !(
            o.patient_id === user.id &&
            o.medicine_id === medicineId &&
            o.date === dateKey &&
            o.time === time
          )
      );
      untakenFiltered.push(untakenEntry);
      writeUntakenOverlay(untakenFiltered);

      setData((prev) => {
        const now = new Date();
        const nextTodays = (prev.dashboard?.todays_medicines || []).map((medicine) => {
          if (medicine.medicine_id !== medicineId) return medicine;
          return {
            ...medicine,
            statuses: (medicine.statuses || []).map((statusItem) => {
              if (statusItem.time !== time) return statusItem;
              const [hour, minute] = statusItem.time.split(":").map(Number);
              const scheduledToday = new Date(now);
              scheduledToday.setHours(hour, minute, 0, 0);
              const revertedStatus = scheduledToday <= now ? "missed" : "pending";
              return {
                ...statusItem,
                status: revertedStatus,
                confirmed_at: null,
              };
            }),
          };
        });
        return {
          ...prev,
          dashboard: prev.dashboard
            ? { ...prev.dashboard, todays_medicines: nextTodays }
            : prev.dashboard,
        };
      });
    },
    []
  );

  const cancelMedicine = useCallback(
    async (medicineId) => {
      const user = getCurrentUser();
      if (!user) return;

      const cancelledBefore = readCancelled();
      const exists = cancelledBefore.some(
        (c) => c.patient_id === user.id && c.medicine_id === medicineId
      );
      const cancelledAfter = exists
        ? cancelledBefore
        : [...cancelledBefore, { patient_id: user.id, medicine_id: medicineId }];

      writeCancelled(cancelledAfter);
      const localMedicinesBefore = readLocalMedicines();
      const localMedicinesAfter = localMedicinesBefore.filter((m) => m.id !== medicineId);
      writeLocalMedicines(localMedicinesAfter);
      setData((prev) => ({
        ...prev,
        medicines: (prev.medicines || []).filter((m) => m.id !== medicineId),
        dashboard: prev.dashboard
          ? {
              ...prev.dashboard,
              todays_medicines: (prev.dashboard.todays_medicines || []).filter(
                (m) => m.medicine_id !== medicineId
              ),
            }
          : prev.dashboard,
      }));

      try {
        await api.delete(endpoints.medicines.remove(medicineId));
      } catch (err) {
        writeCancelled(cancelledBefore);
        writeLocalMedicines(localMedicinesBefore);
        loadData();
        throw err;
      }
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
