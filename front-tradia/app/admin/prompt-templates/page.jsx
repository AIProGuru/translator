"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/navbar";
import { usePromptTemplates } from "../../../context/PromptTemplateContext";

const emptyForm = {
  id: "",
  key: "",
  label: "",
  description: "",
  prompt: "",
  glossaryText: "",
  styleText: "",
  examplesText: "",
};

const templateToForm = (template) => ({
  id: template.id,
  key: template.key,
  label: template.label,
  description: template.description || "",
  prompt: template.prompt || "",
  glossaryText: (template.glossary || [])
    .map((entry) => `${entry.source} => ${entry.target}`)
    .join("\n"),
  styleText: (template.styleGuidance || []).join("\n"),
  examplesText: (template.examples || [])
    .map((example) => `${example.source} => ${example.translation}`)
    .join("\n"),
});

const formToTemplate = (form) => ({
  id: form.id,
  key: form.key.trim(),
  label: form.label.trim(),
  description: form.description.trim(),
  prompt: form.prompt.trim(),
  glossary: form.glossaryText
    .split("\n")
    .map((line) => {
      const [source, target] = line.split("=>");
      return { source: source?.trim(), target: target?.trim() };
    })
    .filter((entry) => entry.source && entry.target),
  styleGuidance: form.styleText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean),
  examples: form.examplesText
    .split("\n")
    .map((line) => {
      const [source, translation] = line.split("=>");
      return { source: source?.trim(), translation: translation?.trim() };
    })
    .filter((entry) => entry.source && entry.translation),
});

export default function PromptTemplateAdminPage() {
  const {
    templates,
    addTemplate,
    updateTemplate,
    removeTemplate,
    resetTemplates,
    isLoading,
  } = usePromptTemplates();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");

  const startEditing = (template) => {
    setErrorMessage("");
    setEditingId(template?.id || "new");
    setForm(template ? templateToForm(template) : { ...emptyForm, id: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.label.trim()) return;
    setErrorMessage("");
    try {
      const prepared = formToTemplate(form);
      if (editingId && editingId !== "new") {
        await updateTemplate(editingId, prepared);
      } else {
        await addTemplate(prepared);
      }
      setEditingId(null);
      setForm(emptyForm);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this template? This cannot be undone.")) {
      try {
        await removeTemplate(id);
      } catch (error) {
        setErrorMessage(error.message);
      }
    }
  };

  return (
    <ProtectedRoute roles={["administrator"]}>
      <Navbar />
      <main className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-800">Prompt templates</h1>
            <p className="text-sm text-gray-600">
              Maintain document-specific prompts, glossaries, and style guides used across the platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => startEditing(null)}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Add new type
            </button>
            <button
              type="button"
              onClick={async () => {
                setErrorMessage("");
                try {
                  await resetTemplates();
                } catch (error) {
                  setErrorMessage(error.message);
                }
              }}
              className="px-4 py-2 text-sm font-semibold border border-blue-300 rounded text-blue-700 hover:bg-blue-50"
            >
              Restore defaults
            </button>
          </div>
        </div>

        <section className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Existing templates</h2>
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <p className="text-base font-semibold text-gray-800">{template.label}</p>
                  <p className="text-xs text-gray-500">{template.description}</p>
                  <p className="text-[11px] text-gray-400">Key: {template.key}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Glossary terms: {template.glossary?.length ?? 0} • Examples: {template.examples?.length ?? 0}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(template)}
                    className="px-3 py-1 text-sm border border-blue-300 rounded text-blue-700 hover:bg-blue-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template.id)}
                    className="px-3 py-1 text-sm border border-red-300 rounded text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {!templates.length && !isLoading && (
              <p className="text-sm text-gray-500">No templates configured. Add the first one above.</p>
            )}
            {isLoading && <p className="text-sm text-gray-500">Loading templates...</p>}
          </div>
        </section>

        {editingId !== null && (
          <section className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingId === "new" ? "Add template" : "Edit template"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {errorMessage && (
                <div className="p-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
                  {errorMessage}
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Label</label>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                    className="mt-1 w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Unique key (no spaces)</label>
                  <input
                    type="text"
                    value={form.key}
                    onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
                    className="mt-1 w-full border rounded px-3 py-2"
                    placeholder="e.g. patents, customs, contracts..."
                    required={editingId === "new"}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 h-20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Prompt instructions</label>
                <textarea
                  value={form.prompt}
                  onChange={(e) => setForm((prev) => ({ ...prev, prompt: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 h-28"
                  required
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Glossary (one per line, format: source =&gt; target)
                  </label>
                  <textarea
                    value={form.glossaryText}
                    onChange={(e) => setForm((prev) => ({ ...prev, glossaryText: e.target.value }))}
                    className="mt-1 w-full border rounded px-3 py-2 h-28"
                    placeholder="claim => reivindicación"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Style guidance (one rule per line)</label>
                  <textarea
                    value={form.styleText}
                    onChange={(e) => setForm((prev) => ({ ...prev, styleText: e.target.value }))}
                    className="mt-1 w-full border rounded px-3 py-2 h-28"
                    placeholder="Preserve enumerations..."
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Example comparisons (source =&gt; translation per line)
                </label>
                <textarea
                  value={form.examplesText}
                  onChange={(e) => setForm((prev) => ({ ...prev, examplesText: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 h-32"
                  placeholder="The court finds... => El tribunal determina..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700"
                >
                  Save template
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </ProtectedRoute>
  );
}
