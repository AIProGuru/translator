'use client';
import { useState, useCallback } from 'react';

export function useSafeFetch() {
  const [serverError, setServerError] = useState(false);

  const safeFetch = useCallback(async (url, options) => {
    try {
      setServerError(false);
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      console.error("Error de red:", error);
      setServerError(true);
      throw error;
    }
  }, []);

  return { safeFetch, serverError, setServerError };
}
