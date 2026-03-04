const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL
  || `${window.location.protocol}//${window.location.hostname}/team-cluster/backend`;

function buildEndpointUrl(endpoint, method) {
  if ((method ?? "GET").toUpperCase() !== "GET") {
    return `${API_BASE_URL}/${endpoint}`;
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  rreturn `${API_BASE_URL}/${endpoint}${separator}_ts=${Date.now()}`;
}

export async function apiFetch(endpoint, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const res = await fetch(buildEndpointUrl(endpoint, method), {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}