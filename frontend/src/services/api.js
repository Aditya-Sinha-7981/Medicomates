// Central API service — all fetch calls go through here, never inline fetch in components
export const BASE_URL = import.meta.env.VITE_API_URL || "";

const AUTH_TOKEN_KEY = "auth_token";

const authHeadersJson = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}`,
});

const authHeadersMultipart = () => ({
  Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ""}`,
});

/**
 * @param {Response} res
 * @returns {Promise<unknown>}
 */
async function handleResponse(res) {
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

export const endpoints = {
  auth: {
    register: () => "/api/auth/register",
    login: () => "/api/auth/login",
  },
  dashboard: {
    patient: (patientId) => `/api/dashboard/patient/${patientId}`,
    doctor: (doctorId) => `/api/dashboard/doctor/${doctorId}`,
    insight: (patientId) => `/api/dashboard/insight/${patientId}`,
    reviewer: (patientId) => `/api/dashboard/reviewer/${patientId}`,
  },
  medicines: {
    list: (patientId) => `/api/medicines/${patientId}`,
    create: () => "/api/medicines",
    confirm: () => "/api/medicines/confirm",
    update: (medicineId) => `/api/medicines/${medicineId}`,
    remove: (medicineId) => `/api/medicines/${medicineId}`,
  },
  adherence: {
    logs: (patientId, days = 30) => `/api/adherence/${patientId}?days=${days}`,
    summary: (patientId) => `/api/adherence/${patientId}/summary`,
    mark: () => "/api/adherence/mark",
  },
  connections: {
    doctorsForPatient: (patientId) => `/api/connections/doctors/${patientId}`,
    patientsForDoctor: (doctorId) => `/api/connections/patients/${doctorId}`,
    reviewersForPatient: (patientId) => `/api/connections/reviewers/${patientId}`,
    reviewing: () => `/api/connections/reviewing`,
    search: (email, type) => `/api/connections/search?email=${encodeURIComponent(email)}&type=${type}`,
    request: () => `/api/connections/request`,
    incomingRequests: () => `/api/connections/requests/incoming`,
    outgoingRequests: () => `/api/connections/requests/outgoing`,
    acceptRequest: (id) => `/api/connections/requests/${id}/accept`,
    rejectRequest: (id) => `/api/connections/requests/${id}/reject`,
  },
  notes: {
    thread: (patientId, doctorId) => `/api/notes/${patientId}/${doctorId}`,
    create: () => "/api/notes",
    markRead: (patientId, doctorId) => `/api/notes/read/${patientId}/${doctorId}`,
  },
  visits: {
    list: (patientId) => `/api/visits/${patientId}`,
  },
  ocr: () => "/api/ocr",
  documents: {
    upload: () => "/api/documents/upload",
    me: () => "/api/documents/me",
    patient: (patientId) => `/api/documents/patient/${patientId}`,
    update: (id) => `/api/documents/${id}`,
    remove: (id) => `/api/documents/${id}`,
  },
};

export const api = {
  get: (path) =>
    fetch(`${BASE_URL}${path}`, { headers: authHeadersJson() }).then(handleResponse),

  post: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: authHeadersJson(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  put: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: authHeadersJson(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  delete: (path) =>
    fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers: authHeadersJson(),
    }).then(handleResponse),

  patch: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: authHeadersJson(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  upload: (path, formData) =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: authHeadersMultipart(),
      body: formData,
    }).then(handleResponse),
};
