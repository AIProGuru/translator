"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { defaultPromptTemplates } from "@/lib/promptTemplates";

const STORAGE_KEY = "maria_prompt_templates_v1";

const PromptTemplateContext = createContext({
  templates: defaultPromptTemplates,
  isReady: false,
  addTemplate: () => {},
  updateTemplate: () => {},
  removeTemplate: () => {},
  resetTemplates: () => {},
  getTemplateById: () => undefined,
});

const slugify = (value) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const randomId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `template-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeTemplate = (template) => {
  if (!template) return null;
  return {
    id: template.id || slugify(template.label || randomId()) || randomId(),
    label: template.label || "Untitled",
    description: template.description || "",
    prompt: template.prompt || "",
    version: template.version || 1,
    glossary: Array.isArray(template.glossary)
      ? template.glossary
          .map((entry) => ({
            source: entry?.source?.trim(),
            target: entry?.target?.trim(),
          }))
          .filter((entry) => entry.source && entry.target)
      : [],
    styleGuidance: Array.isArray(template.styleGuidance)
      ? template.styleGuidance.map((item) => item?.trim()).filter(Boolean)
      : [],
    examples: Array.isArray(template.examples)
      ? template.examples
          .map((example) => ({
            source: example?.source?.trim(),
            translation: example?.translation?.trim(),
          }))
          .filter((example) => example.source && example.translation)
      : [],
  };
};

export function PromptTemplateProvider({ children }) {
  const [templates, setTemplates] = useState(defaultPromptTemplates);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setTemplates(parsed.map((tpl) => normalizeTemplate(tpl)).filter(Boolean));
        }
      }
    } catch (error) {
      console.error("Error loading prompt templates:", error);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error("Error persisting prompt templates:", error);
    }
  }, [templates, isReady]);

  const addTemplate = useCallback((template) => {
    setTemplates((prev) => {
      const normalized = normalizeTemplate(template);
      if (!normalized) return prev;
      const exists = prev.some((item) => item.id === normalized.id);
      return exists ? prev : [...prev, normalized];
    });
  }, []);

  const updateTemplate = useCallback((id, updates) => {
    if (!id) return;
    setTemplates((prev) =>
      prev.map((template) => {
        if (template.id !== id) return template;
        const merged = normalizeTemplate({ ...template, ...updates, id: template.id });
        return merged ? { ...template, ...merged } : template;
      }),
    );
  }, []);

  const removeTemplate = useCallback((id) => {
    if (!id) return;
    setTemplates((prev) => prev.filter((template) => template.id !== id));
  }, []);

  const resetTemplates = useCallback(() => {
    setTemplates(defaultPromptTemplates);
  }, []);

  const getTemplateById = useCallback(
    (id) => templates.find((template) => template.id === id),
    [templates],
  );

  const value = useMemo(
    () => ({
      templates,
      isReady,
      addTemplate,
      updateTemplate,
      removeTemplate,
      resetTemplates,
      getTemplateById,
    }),
    [templates, isReady, addTemplate, updateTemplate, removeTemplate, resetTemplates, getTemplateById],
  );

  return <PromptTemplateContext.Provider value={value}>{children}</PromptTemplateContext.Provider>;
}

export const usePromptTemplates = () => {
  const context = useContext(PromptTemplateContext);
  if (!context) {
    throw new Error("usePromptTemplates must be used within a PromptTemplateProvider");
  }
  return context;
};
