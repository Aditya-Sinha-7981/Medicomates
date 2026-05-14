/**
 * Wall-clock times in reminder_times / dashboard statuses follow the backend
 * scheduler timezone (see backend/config.py SCHEDULER_TIMEZONE and dashboard.py).
 * Calendar dots bucket by UTC calendar day of scheduled_time — same as AdherenceCalendar.
 *
 * Set VITE_SCHEDULER_TIMEZONE to the same IANA zone as the backend (e.g. Asia/Kolkata).
 *
 * Dedupe keys use UTC day + nearest reminder slot so duplicate rows (e.g. 02:30Z vs 08:00Z
 * both mapping to 08:00 IST) collapse to one per calendar dot.
 */
export const SCHEDULER_IANA =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SCHEDULER_TIMEZONE) ||
  "Asia/Kolkata";

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD in UTC — must match AdherenceCalendar bucketing. */
export function utcDateKeyFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Calendar parts for `instantMs` interpreted in `ianaTimeZone`. */
export function zonedParts(instantMs, ianaTimeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaTimeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(instantMs));
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "0";
  return {
    y: Number(get("year")),
    mo: Number(get("month")),
    day: Number(get("day")),
    h: Number(get("hour")),
    mi: Number(get("minute")),
    sec: Number(get("second")),
  };
}

/** YYYY-MM-DD for the instant in the scheduler zone (dashboard "today"). */
export function schedulerDateKeyFromIso(iso, ianaTimeZone = SCHEDULER_IANA) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = zonedParts(d.getTime(), ianaTimeZone);
  return `${p.y}-${pad2(p.mo)}-${pad2(p.day)}`;
}

/** HH:mm wall clock in the scheduler zone. */
export function schedulerHmFromIso(iso, ianaTimeZone = SCHEDULER_IANA) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = zonedParts(d.getTime(), ianaTimeZone);
  return `${pad2(p.h)}:${pad2(p.mi)}`;
}

function parseHmToMinutes(hm) {
  const [h, m] = String(hm).trim().split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function formatMinutesToHm(total) {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function normalizeReminderHm(rt) {
  const p = parseHmToMinutes(rt);
  if (p == null) return String(rt).trim();
  return formatMinutesToHm(p);
}

function circularDistMinutes(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1440 - d);
}

/**
 * Map scheduler-zone wall time to the nearest reminder_times entry (24h circular).
 * `logIso` breaks ties using UTC hour (e.g. 21:00Z evening vs 02:30Z spill).
 */
export function snapHmToClosestReminderSlot(rawHm, reminderTimes, logIso) {
  const cur = parseHmToMinutes(rawHm);
  if (cur == null || !reminderTimes?.length) return rawHm;

  const targets = reminderTimes
    .map((rt) => normalizeReminderHm(rt))
    .filter((x) => parseHmToMinutes(x) != null);
  if (!targets.length) return rawHm;

  const utcH = Number.isNaN(Date.parse(logIso)) ? 12 : new Date(logIso).getUTCHours();

  let best = targets[0];
  let bestBt = parseHmToMinutes(best);
  let bestD = circularDistMinutes(cur, bestBt);

  for (let i = 1; i < targets.length; i++) {
    const nm = targets[i];
    const t = parseHmToMinutes(nm);
    if (t == null) continue;
    const d = circularDistMinutes(cur, t);
    if (d < bestD) {
      bestD = d;
      best = nm;
      bestBt = t;
    } else if (d === bestD && bestBt != null) {
      if (utcH >= 12) {
        if (t > bestBt) {
          best = nm;
          bestBt = t;
        }
      } else if (t < bestBt) {
        best = nm;
        bestBt = t;
      }
    }
  }
  return best;
}

export function schedulerSlotKeyFromLog(log, ianaTimeZone = SCHEDULER_IANA) {
  if (!log?.scheduled_time || log.medicine_id == null || log.medicine_id === "") return null;
  const day = utcDateKeyFromIso(log.scheduled_time);
  const hm = schedulerHmFromIso(log.scheduled_time, ianaTimeZone);
  if (!day || !hm) return null;
  return `${String(log.medicine_id)}|${day}|${hm}`;
}

/**
 * Dedupe key: UTC calendar day (matches dots) + medicine + nearest reminder slot
 * in scheduler TZ (merges 02:30Z vs 08:00Z IST-morning duplicates).
 */
export function dedupeSlotKeyFromLog(log, medicines, ianaTimeZone = SCHEDULER_IANA) {
  const utcDay = utcDateKeyFromIso(log.scheduled_time);
  const rawHm = schedulerHmFromIso(log.scheduled_time, ianaTimeZone);
  if (!utcDay || !rawHm || log.medicine_id == null || log.medicine_id === "") return null;

  const medReminders = new Map();
  for (const m of medicines || []) {
    const id = String(m.id ?? m.medicine_id ?? "");
    if (!id) continue;
    medReminders.set(id, Array.isArray(m.reminder_times) ? m.reminder_times : []);
  }
  const rts = medReminders.get(String(log.medicine_id));
  const hm = rts?.length
    ? snapHmToClosestReminderSlot(rawHm, rts, log.scheduled_time)
    : rawHm;
  return `${String(log.medicine_id)}|${utcDay}|${hm}`;
}

export function dedupeAdherenceLogsBySchedulerSlot(logs, ianaTimeZone = SCHEDULER_IANA) {
  return dedupeAdherenceLogsForPatient(logs, null, ianaTimeZone);
}

export function dedupeAdherenceLogsForPatient(
  logs,
  medicines,
  ianaTimeZone = SCHEDULER_IANA
) {
  const list = Array.isArray(logs) ? logs : [];
  const score = (log) =>
    (log?.id != null && !String(log.id).startsWith("synthetic") ? 4 : 0) +
    (log?.confirmed_at ? 2 : 0);

  const keyOf = (log) =>
    medicines?.length
      ? dedupeSlotKeyFromLog(log, medicines, ianaTimeZone)
      : schedulerSlotKeyFromLog(log, ianaTimeZone);

  const bestByKey = new Map();
  for (const log of list) {
    const key = keyOf(log);
    if (!key) continue;
    const prev = bestByKey.get(key);
    if (!prev || score(log) > score(prev)) bestByKey.set(key, log);
  }

  const out = [];
  const seen = new Set();
  for (const log of list) {
    const key = keyOf(log);
    if (!key) {
      out.push(log);
      continue;
    }
    if (seen.has(key)) continue;
    const winner = bestByKey.get(key);
    if (!winner) continue;
    seen.add(key);
    out.push(winner);
  }
  const seenIds = new Set();
  return out.filter((log) => {
    const id = log?.id;
    if (id == null || id === "") return true;
    if (seenIds.has(String(id))) return false;
    seenIds.add(String(id));
    return true;
  });
}

export function todayYmdInSchedulerTz(now = new Date(), ianaTimeZone = SCHEDULER_IANA) {
  return schedulerDateKeyFromIso(now.toISOString(), ianaTimeZone);
}
