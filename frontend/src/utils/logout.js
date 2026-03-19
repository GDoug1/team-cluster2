import { apiFetch } from "../api/api";

export async function logout() {
  try {
    await apiFetch("auth/logout.php", { method: "POST" });
  } catch (error) {
    console.error("Logout failed", error);
  }

  localStorage.removeItem("teamClusterUser");
  sessionStorage.clear();
  window.location.replace("/login");
}
