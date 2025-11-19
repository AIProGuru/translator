'use client';
import { useState, useCallback } from 'react';
import { useAuth } from "../app/context/AuthContext";

export function useSafeFetch() {
  const [serverError, setServerError] = useState(false);
  const { token } = useAuth();

  const safeFetch = useCallback(
    async (url, options = {}) => {
      try {
        setServerError(false);

        const mergedOptions = { ...options };
        mergedOptions.headers = {
          ...(options.headers || {}),
        };

        if (token) {
          mergedOptions.headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(url, mergedOptions);
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
