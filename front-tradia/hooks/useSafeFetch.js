'use client';
import { useState, useCallback } from 'react';
import { useAuth } from "../context/AuthContext";
import { BACK_HOST } from "@/lib/constants";

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

function buildUrl(url) {
  if (!url) return url;
  if (ABSOLUTE_URL_REGEX.test(url) || !BACK_HOST) {
    return url;
  }
  const base = BACK_HOST.endsWith("/")
    ? BACK_HOST.slice(0, -1)
    : BACK_HOST;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

export function useSafeFetch() {
  const [serverError, setServerError] = useState(false);
  const { token } = useAuth();

  const readStoredToken = () => {
    if (typeof window === "undefined") return null;
    try {
      return (
        window.sessionStorage.getItem("maria_auth_token") ||
        window.localStorage.getItem("maria_auth_token")
      );
    } catch (error) {
      console.warn("Unable to read stored token:", error);
      return null;
    }
  };

  const safeFetch = useCallback(
    async (url, options = {}) => {
      try {
        setServerError(false);

        const mergedOptions = { ...options };
        mergedOptions.headers = {
          ...(options.headers || {}),
        };
        if (!mergedOptions.credentials) {
          mergedOptions.credentials = "include";
        }

        const authToken = token || readStoredToken();
        if (authToken) {
          mergedOptions.headers["Authorization"] = `Bearer ${authToken}`;
        }

        const response = await fetch(buildUrl(url), mergedOptions);
        return response;
      } catch (error) {
        console.error("Error de red:", error);
        setServerError(true);
        throw error;
      }
    },
    [token]
  );

  return { safeFetch, serverError, setServerError };
}
