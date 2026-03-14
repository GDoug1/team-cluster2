import { useEffect, useState } from "react";
import { apiFetch } from "../api/api";

export default function usePermissions() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
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

    return () => {
      mounted = false;
    };
  }, []);

  return {
    permissions,
    loading,
    hasPermission: permission => permissions.includes(permission)
  };
}