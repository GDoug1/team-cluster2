import { apiFetch } from "./api";

export async function fetchAnnouncements() {
  return apiFetch("api/shared/announcements.php");
}

export async function createAnnouncement(payload) {
  return apiFetch("api/shared/save_announcement.php", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...payload })
  });
}

export async function updateAnnouncement(payload) {
  return apiFetch("api/shared/save_announcement.php", {
    method: "POST",
    body: JSON.stringify({ action: "update", ...payload })
  });
}

export async function deleteAnnouncement(announcementId) {
  return apiFetch("api/shared/save_announcement.php", {
    method: "POST",
    body: JSON.stringify({ action: "delete", announcement_id: announcementId })
  });
}
