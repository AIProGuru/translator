"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BACK_HOST } from "../lib/constants.js";
import { useServerError } from "./ServerErrorContext.jsx";

const STORAGE_KEYS = {
  user: "maria_auth_user",
  token: "maria_auth_token",
};

const AuthContext = createContext({
  user: null,
  token: null,
  login: async () => {},
  changePassword: async () => {},
  logout: async () => {},
  isLoading: true,
});

const readStoredToken = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEYS.token);
  } catch (error) {
    console.warn("Unable to read stored token:", error);
    return null;
  }
};

const readStoredUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Unable to parse stored user:", error);
    return null;
  }
};

const persistUser = (value) => {
  if (typeof window === "undefined") return;
  if (!value) {
    window.sessionStorage.removeItem(STORAGE_KEYS.user);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(value));
};

const persistToken = (value) => {
  if (typeof window === "undefined") return;
  if (!value) {
    window.sessionStorage.removeItem(STORAGE_KEYS.token);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEYS.token, value);
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const [token, setToken] = useState(() => readStoredToken());
  const [isLoading, setIsLoading] = useState(true);
  const { setServerError } = useServerError();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadSession = async () => {
      try {
        const headers = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${BACK_HOST}/api/auth/me`, {
          credentials: "include",
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            persistUser(null);
            persistToken(null);
            if (isMounted) {
              setUser(null);
              setToken(null);
            }
            return;
          }
          throw new Error(`Auth check failed with status ${response.status}`);
        }

        const data = await response.json();
        if (isMounted) {
          setUser(data.user);
          persistUser(data.user);
          setServerError(false);
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error("Error validating auth session:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSession();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [token, setServerError]);

  const login = async ({ username, password }) => {
    try {
      const res = await fetch(`${BACK_HOST}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Unable to login");
      }

      const data = await res.json();
      setUser(data.user);
      setToken(data.token);
      persistUser(data.user);
      persistToken(data.token);
      setServerError(false);
      return data;
    } catch (error) {
      setUser(null);
      setToken(null);
      persistUser(null);
      persistToken(null);
      throw error;
    }
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    const res = await fetch(`${BACK_HOST}/api/auth/change-password`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.message || "Unable to change password");
    }

    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    persistUser(data.user);
    persistToken(data.token);
    return data.user;
  };

  const logout = async () => {
    try {
      await fetch(`${BACK_HOST}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      setUser(null);
      setToken(null);
      persistUser(null);
      persistToken(null);
      router.push("/");
    } catch (error) {
      console.error("Error al intentar conectar con el backend:", error);
      setServerError(true);
    }
  };

  const contextValue = useMemo(
    () => ({
      user,
      token,
      login,
      changePassword,
      logout,
      isLoading,
    }),
    [user, token, isLoading],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () =>
  useContext(AuthContext) ?? {
    user: null,
    token: null,
    login: async () => {},
    changePassword: async () => {},
    logout: async () => {},
    isLoading: true,
  };
