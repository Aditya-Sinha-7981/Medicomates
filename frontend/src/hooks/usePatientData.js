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

const utcDateKeyFromIso = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function normalizeDoctors(rawDoctors) {
  if (!Array.isArray(rawDoctors)) return [];
  return rawDoctors
    .filter((entry) => entry && entry.doctor_id)
    .map((entry) => ({
      ...entry,
      full_name: entry.full_name || "Doctor",
      connected_at: entry.connected_at || null,
    }));
}

function normalizeVisits(rawVisits) {
  if (!Array.isArray(rawVisits)) return [];
  return rawVisits
    .filter((visit) => visit && visit.id)
    .map((visit) => ({
      ...visit,
      doctor_name: visit.doctor_name || "Care team",
      summary: visit.summary || "Visit activity recorded",
      visit_date: visit.visit_date || new Date().toISOString(),
    }));
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

function buildSyntheticTodayLogs(dashboard, patientId, existingLogs) {
  const todays = dashboard?.todays_medicines || [];
  if (!todays.length) return [];

  const todayLocal = new Date();
  const todayUtcKey = utcDateKeyFromIso(todayLocal.toISOString());
  const existingTodayByMedicine = new Set(
    (Array.isArray(existingLogs) ? existingLogs : [])
      .filter((log) => utcDateKeyFromIso(log?.scheduled_time) === todayUtcKey)
      .map((log) => log?.medicine_id)
      .filter(Boolean)
  );

  const synthetic = [];
  for (const med of todays) {
    const medId = med?.medicine_id;
    if (!medId) continue;
    // If we already have real logs for this medicine today, don't invent duplicates.
    if (existingTodayByMedicine.has(medId)) continue;
    for (const s of med?.statuses || []) {
      const timeStr = String(s?.time || "");
      const [hh, mm] = timeStr.split(":").map((v) => Number(v));
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
      const scheduledLocal = new Date(todayLocal);
      scheduledLocal.setHours(hh, mm, 0, 0);
      synthetic.push({
        id: `synthetic-${medId}-${timeStr}`,
        medicine_id: medId,
        medicine_name: med?.name,
        scheduled_time: scheduledLocal.toISOString(),
        confirmed_at: s?.confirmed_at ?? null,
        status: s?.status || "pending",
      });
    }
  }
  return synthetic;
}

export default function usePatientData() {
  const [data, setData] = useState({
    dashboard: null,
    medicines: [],
    doctors: [],
    visits: [],
    adherenceLogs: [],
    incomingRequests: [],
    outgoingRequests: [],
    reviewers: [],
    reviewing: [],
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
      const [
        dashboardRes, medicinesRes, doctorsRes, visitsRes, adherenceRes,
        incomingRes, outgoingRes, reviewersRes, reviewingRes
      ] = await Promise.allSettled([
          api.get(endpoints.dashboard.patient(patientId)),
          api.get(endpoints.medicines.list(patientId)),
          api.get(endpoints.connections.doctorsForPatient(patientId)),
          api.get(endpoints.visits.list(patientId)),
          api.get(endpoints.adherence.logs(patientId, 30)),
          api.get(endpoints.connections.incomingRequests()),
          api.get(endpoints.connections.outgoingRequests()),
          api.get(endpoints.connections.reviewersForPatient(patientId)),
          api.get(endpoints.connections.reviewing()),
        ]);

      if (dashboardRes.status === "rejected") {
        throw dashboardRes.reason;
      }

      const dashboardRaw = dashboardRes.value;
      const medicinesApi = medicinesRes.status === "fulfilled" ? medicinesRes.value : [];
      const medicines = mergeMedicinesForPatient(patientId, medicinesApi);
      const doctorsRaw = doctorsRes.status === "fulfilled" ? doctorsRes.value : [];
      const visitsRaw = visitsRes.status === "fulfilled" ? visitsRes.value : [];
      const adherenceLogsRaw =
        adherenceRes.status === "fulfilled" ? adherenceRes.value : [];
      const incomingRaw = incomingRes.status === "fulfilled" ? incomingRes.value : [];
      const outgoingRaw = outgoingRes.status === "fulfilled" ? outgoingRes.value : [];
      const reviewersRaw = reviewersRes.status === "fulfilled" ? reviewersRes.value : [];
      const reviewingRaw = reviewingRes.status === "fulfilled" ? reviewingRes.value : [];

      const doctors = normalizeDoctors(doctorsRaw);
      const visits = normalizeVisits(visitsRaw);

      const dashboardWithOverlay = applyDashboardOverlay(dashboardRaw, patientId);
      const dashboard = mergeTodaysScheduleFromMedicines(
        dashboardWithOverlay,
        medicines,
        patientId
      );
      const baseLogs = Array.isArray(adherenceLogsRaw) ? adherenceLogsRaw : [];
      const syntheticToday = buildSyntheticTodayLogs(dashboard, patientId, baseLogs);
      const adherenceLogs = applyAdherenceOverlay([...baseLogs, ...syntheticToday], patientId);

      setData({
        dashboard,
        medicines: Array.isArray(medicines) ? medicines : [],
        doctors,
        visits,
        adherenceLogs,
        incomingRequests: Array.isArray(incomingRaw) ? incomingRaw : [],
        outgoingRequests: Array.isArray(outgoingRaw) ? outgoingRaw : [],
        reviewers: Array.isArray(reviewersRaw) ? reviewersRaw : [],
        reviewing: Array.isArray(reviewingRaw) ? reviewingRaw : [],
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
    async (medicineId, time) => {
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

      // Persist to backend (updates the existing adherence_logs row for today/time).
      try {
        await api.post(endpoints.adherence.mark(), {
          patient_id: user.id,
          medicine_id: medicineId,
          time,
          taken: true,
        });
        // Pull fresh streak + adherenceLogs so calendar/streak update immediately.
        loadData();
      } catch {
        // Non-blocking: keep local optimistic state so the patient UX stays smooth.
        // The email confirm flow remains the primary source of truth.
      }
    },
    [loadData]
  );

  const markDoseUntaken = useCallback(
    async (medicineId, time) => {
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

      try {
        await api.post(endpoints.adherence.mark(), {
          patient_id: user.id,
          medicine_id: medicineId,
          time,
          taken: false,
        });
        loadData();
      } catch {
        /* non-blocking */
      }
    },
    [loadData]
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
