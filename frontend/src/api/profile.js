import { apiFetch } from "./api";

export async function fetchMyProfile() {
  const response = await apiFetch("api/shared/profile.php");
  return response?.profile ?? null;
}

export async function saveMyProfile(profile) {
  const response = await apiFetch("api/shared/profile.php", {
    method: "PUT",
    body: JSON.stringify(profile)
  });

  return response?.profile ?? null;
}
