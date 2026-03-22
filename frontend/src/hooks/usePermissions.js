import { useEffect, useState } from "react";
import { apiFetch } from "../api/api";

export default function usePermissions() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
      if (mounted) {
        setLoading(true);
      }

      try {
        const response = await apiFetch("auth/my_permissions.php");
        if (!mounted) return;
        setPermissions(Array.isArray(response.permissions) ? response.permissions : []);
      } catch {
        if (!mounted) return;
        setPermissions([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPermissions();

    const handlePermissionsUpdated = () => {
      loadPermissions();
    };

    window.addEventListener("permissions-updated", handlePermissionsUpdated);

    return () => {
      mounted = false;
      window.removeEventListener("permissions-updated", handlePermissionsUpdated);
    };
  }, []);

  return {
    permissions,
    loading,
    hasPermission: permission => permissions.includes(permission)
  };
}
