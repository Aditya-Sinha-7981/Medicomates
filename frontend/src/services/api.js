// Central API service — all fetch calls go through here, never inline fetch in components
const BASE_URL = import.meta.env.VITE_API_URL;

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
});

export const api = {
  get: (path) =>
    fetch(`${BASE_URL}${path}`, { headers: getHeaders() }).then((r) => r.json()),

  post: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  put: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  delete: (path) =>
    fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers: getHeaders(),
    }).then((r) => r.json()),

  upload: (path, formData) =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
      body: formData,
    }).then((r) => r.json()),
};
