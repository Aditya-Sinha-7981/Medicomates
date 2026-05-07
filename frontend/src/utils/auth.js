import { BASE_URL, endpoints } from "../services/api.js";

const AUTH_KEY = "medicomates_user";
const AUTH_TOKEN_KEY = "auth_token";

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
export async function login(email, password) {
  const normalizedEmail = email.trim();
  const res = await fetch(`${BASE_URL}${endpoints.auth.login()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail, password }),
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
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getCurrentUser() {
  return safeParse(localStorage.getItem(AUTH_KEY), null);
}
