"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BACK_HOST } from "@/lib/constants";
import { useSafeFetch } from "@/hooks/useSafeFetch";
import { useAuth } from "./AuthContext";

const PromptTemplateContext = createContext({
  templates: [],
  isReady: false,
  isLoading: false,
  lastError: null,
  refreshTemplates: async () => {},
  addTemplate: async () => {},
  updateTemplate: async () => {},
  removeTemplate: async () => {},
  resetTemplates: async () => {},
  getTemplateByKey: () => undefined,
});

export function PromptTemplateProvider({ children }) {
  const { safeFetch } = useSafeFetch();
  const { user, isLoading: authLoading } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setLastError(null);
    try {
      const response = await safeFetch(`${BACK_HOST}/api/prompt-templates`);
      if (!response?.ok) {
        throw new Error("Failed to load prompt templates");
      }
      const data = await response.json();
      setTemplates(data);
      setIsReady(true);
    } catch (error) {
      console.error("Error fetching prompt templates:", error);
      setLastError(error);
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  }, [safeFetch]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTemplates([]);
      setIsReady(false);
      setLastError(null);
      return;
    }
    fetchTemplates();
  }, [authLoading, user, fetchTemplates]);

  const addTemplate = useCallback(
    async (payload) => {
      const response = await safeFetch(`${BACK_HOST}/api/prompt-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response?.ok) {
        const message = (await response.json().catch(() => ({}))).message;
        throw new Error(message || "Failed to create template");
      }
      const created = await response.json();
      setTemplates((prev) => [...prev, created]);
      return created;
    },
    [safeFetch],
  );

  const updateTemplate = useCallback(
    async (id, payload) => {
      const response = await safeFetch(
        `${BACK_HOST}/api/prompt-templates/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response?.ok) {
        const message = (await response.json().catch(() => ({}))).message;
        throw new Error(message || "Failed to update template");
      }
      const updated = await response.json();
      setTemplates((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      return updated;
    },
    [safeFetch],
  );

  const removeTemplate = useCallback(
    async (id) => {
      const response = await safeFetch(
        `${BACK_HOST}/api/prompt-templates/${id}`,
        {
          method: "DELETE",
        },
      );
      if (!response?.ok) {
        const message = (await response.json().catch(() => ({}))).message;
        throw new Error(message || "Failed to delete template");
      }
      setTemplates((prev) => prev.filter((item) => item.id !== id));
    },
    [safeFetch],
  );

  const resetTemplates = useCallback(async () => {
    const response = await safeFetch(`${BACK_HOST}/api/prompt-templates/reset`, {
      method: "POST",
    });
    if (!response?.ok) {
      const message = (await response.json().catch(() => ({}))).message;
      throw new Error(message || "Failed to reset templates");
    }
    const data = await response.json();
    setTemplates(data);
    return data;
  }, [safeFetch]);

  const getTemplateByKey = useCallback(
    (key) => templates.find((template) => template.key === key),
    [templates],
  );

  const value = useMemo(
    () => ({
      templates,
      isReady,
      isLoading,
      lastError,
      refreshTemplates: fetchTemplates,
      addTemplate,
      updateTemplate,
      removeTemplate,
      resetTemplates,
      getTemplateByKey,
    }),
    [
      templates,
      isReady,
      isLoading,
      lastError,
      fetchTemplates,
      addTemplate,
      updateTemplate,
      removeTemplate,
      resetTemplates,
      getTemplateByKey,
    ],
  );

  return (
    <PromptTemplateContext.Provider value={value}>
      {children}
    </PromptTemplateContext.Provider>
  );
}

export const usePromptTemplates = () => useContext(PromptTemplateContext);
