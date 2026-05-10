import { BASE_URL, endpoints } from "../services/api.js";

const AUTH_KEY = "medicomates_user";
const AUTH_TOKEN_KEY = "auth_token";

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isJwtExpired(token) {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return false;
  // Consider expired if we're past exp (in seconds). Add small clock skew.
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec >= exp - 5;
}

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

async function parseJsonResponse(res) {
  const contentType = res.headers.get("content-type");
  const isJson = contentType?.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const detail = data.error ?? data.message;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(data.detail)
          ? data.detail.map((d) => d.msg || d).join(", ")
          : typeof data.detail === "string"
            ? data.detail
            : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

const toSessionUser = (payload, emailFallback) => ({
  id: payload.id,
  name: payload.full_name,
  full_name: payload.full_name,
  email: emailFallback?.trim?.()?.toLowerCase?.() || "",
  role: payload.role,
});

/**
 * @param {{ full_name: string, email: string, password: string, role?: string }} form
 */
export async function registerUser(form) {
  const res = await fetch(`${BASE_URL}${endpoints.auth.register()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: form.email.trim(),
      password: form.password,
      role: form.role || "patient",
      full_name: form.full_name.trim(),
    }),
  });
  return parseJsonResponse(res);
}

/**
 * @returns {Promise<{ id: string, full_name: string, name: string, email: string, role: string }>}
 */
// CHANGE 1: Added 'role' as a parameter (with a default fallback of "patient")
export async function login(email, password, role = "patient") {
  const normalizedEmail = email.trim();
  const res = await fetch(`${BASE_URL}${endpoints.auth.login()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // CHANGE 2: Added 'role' to the body being sent to the server
    body: JSON.stringify({ email: normalizedEmail, password, role }),
  });
  const data = await parseJsonResponse(res);
  const sessionUser = toSessionUser(data, normalizedEmail);
  
  localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  localStorage.setItem(AUTH_KEY, JSON.stringify(sessionUser));
  return sessionUser;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAuthToken() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;
  // Fix: if token is expired (or corrupted), clear local session so the app
  // routes to /login instead of repeatedly calling Supabase with bad JWT.
  if (isJwtExpired(token)) {
    logout();
    return null;
  }
  return token;
}

export function getCurrentUser() {
  return safeParse(localStorage.getItem(AUTH_KEY), null);
}