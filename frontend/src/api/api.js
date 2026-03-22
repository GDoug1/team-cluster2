const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost/team-cluster2/backend").replace(/\/$/, "");
function buildEndpointUrl(endpoint, method) {
  if ((method ?? "GET").toUpperCase() !== "GET") {
    return `${BASE_URL}/${endpoint}`;
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  return `${BASE_URL}/${endpoint}${separator}_ts=${Date.now()}`;
}

export async function apiFetch(endpoint, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { ...(options.headers ?? {}) }
    : { "Content-Type": "application/json", ...(options.headers ?? {}) };

  const res = await fetch(buildEndpointUrl(endpoint, method), {
    credentials: "include",
    cache: "no-store",
    ...options,
    headers
  });

  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}