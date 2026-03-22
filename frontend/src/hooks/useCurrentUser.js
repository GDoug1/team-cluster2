import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiFetch } from "../api/api";

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let isActive = true;

    const fetchUser = async () => {
      if (isActive) {
        setLoading(true);
      }

      try {
        const data = await apiFetch("auth/me.php");
        if (isActive) {
          setUser(data);
        }
      } catch {
        if (isActive) {
          setUser(null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchUser();

    return () => {
      isActive = false;
    };
  }, [location.pathname]);

  return { user, loading };
}
