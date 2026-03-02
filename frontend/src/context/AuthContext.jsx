import { createContext, useEffect, useMemo, useState } from "react";

export const AuthContext = createContext(null);

const API = "http://localhost:8000";

export function AuthProvider({ children }) {
  const [access, setAccess] = useState(localStorage.getItem("access"));
  const [refresh, setRefresh] = useState(localStorage.getItem("refresh"));
  const [user, setUser] = useState(
    localStorage.getItem("user")
      ? JSON.parse(localStorage.getItem("user"))
      : null
  );

  const isAuthenticated = !!access;

  // -------------------------
  // LOGIN
  // -------------------------
  const login = async (accessToken, refreshToken) => {
    localStorage.setItem("access", accessToken);
    localStorage.setItem("refresh", refreshToken);

    setAccess(accessToken);
    setRefresh(refreshToken);

    // отримуємо користувача
    const res = await fetch(`${API}/api/me/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error("Не вдалося отримати користувача");
    }

    const me = await res.json();

    localStorage.setItem("user", JSON.stringify(me));
    setUser(me);
  };

  // -------------------------
  // LOGOUT
  // -------------------------
  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");

    setAccess(null);
    setRefresh(null);
    setUser(null);
  };

  // -------------------------
  // ПІДТЯГУЄМО USER ПІСЛЯ RELOAD
  // -------------------------
  useEffect(() => {
    if (!access) return;

    if (!user) {
      fetch(`${API}/api/me/`, {
        headers: {
          Authorization: `Bearer ${access}`,
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((me) => {
          localStorage.setItem("user", JSON.stringify(me));
          setUser(me);
        })
        .catch(() => logout());
    }
  }, []);

  const value = useMemo(
    () => ({
      access,
      refresh,
      user,
      isAuthenticated,
      login,
      logout,
    }),
    [access, refresh, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}