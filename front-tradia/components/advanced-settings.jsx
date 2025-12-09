"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { usePromptTemplates } from "../context/PromptTemplateContext";

const adapters = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
];

const MIN_CYCLES = 0;
const MAX_CYCLES = 3;

const GlossaryList = ({ glossary }) => {
  if (!glossary?.length) {
    return <p className="text-xs text-gray-500">No glossary entries for this type.</p>;
  }
  return (
    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
      {glossary.map((entry) => (
        <div
          key={`${entry.source}-${entry.target}`}
          className="flex items-center justify-between text-xs bg-white border border-blue-100 rounded px-2 py-1"
        >
          <span className="font-semibold text-gray-700">{entry.source}</span>
          <span className="text-blue-700">{entry.target}</span>
        </div>
      ))}
    </div>
  );
};

const ExampleColumn = ({ title, template }) => (
  <div className="p-3 border rounded-lg bg-white shadow-sm h-full">
    <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
    {template ? (
      <>
        <p className="text-xs text-gray-500 mb-3">{template.description}</p>
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {template.examples?.map((example, index) => (
            <div key={`${template.id}-example-${index}`} className="text-xs">
              <p className="font-semibold text-gray-600">Source</p>
              <p className="text-gray-800 bg-gray-50 border rounded px-2 py-1 mb-1">{example.source}</p>
              <p className="font-semibold text-gray-600">Preferred translation</p>
              <p className="text-blue-900 bg-blue-50 border border-blue-100 rounded px-2 py-1">
                {example.translation}
              </p>
            </div>
          ))}
        </div>
      </>
    ) : (
      <p className="text-xs text-gray-500">Select another document type to compare terminology.</p>
    )}
  </div>
);

export default function AdvancedSettings({
  adapter,
  setAdapter,
  prompt,
  setPrompt,
  cycles,
  setCycles,
  documentTypeKey,
  setDocumentTypeKey,
  customDocumentType,
  setCustomDocumentType,
}) {
  const { templates, isReady, isLoading, lastError } = usePromptTemplates();
  const [comparisonTargetKey, setComparisonTargetKey] = useState("");
  const lastAppliedTemplateRef = useRef(null);

  const effectiveDocumentTypeKey = documentTypeKey ?? "custom";
  const selectedTemplate =
    effectiveDocumentTypeKey !== "custom"
      ? templates.find((template) => template.key === effectiveDocumentTypeKey)
      : null;

  useEffect(() => {
    if (!templates.length) return;
    if (!documentTypeKey) {
      setDocumentTypeKey(templates[0].key);
      return;
    }
    if (documentTypeKey === "custom") return;
    const exists = templates.some((template) => template.key === documentTypeKey);
    if (!exists) {
      setDocumentTypeKey(templates[0].key);
    }
  }, [templates, documentTypeKey, setDocumentTypeKey]);

  useEffect(() => {
    if (!isReady) return;
    if (!comparisonTargetKey || comparisonTargetKey === effectiveDocumentTypeKey) {
      const fallback = templates.find((template) => template.key !== effectiveDocumentTypeKey);
      if (fallback) {
        setComparisonTargetKey(fallback.key);
      }
    }
  }, [comparisonTargetKey, effectiveDocumentTypeKey, isReady, templates]);

  useEffect(() => {
    if (!selectedTemplate) return;
    if (lastAppliedTemplateRef.current === selectedTemplate.key) return;
    setPrompt(selectedTemplate.prompt);
    lastAppliedTemplateRef.current = selectedTemplate.key;
  }, [selectedTemplate, setPrompt]);

  const comparisonTemplate =
    comparisonTargetKey && comparisonTargetKey !== effectiveDocumentTypeKey
      ? templates.find((template) => template.key === comparisonTargetKey)
      : null;

  const templateOptions = useMemo(
    () =>
      templates.map((template) => ({
        value: template.key,
        label: template.label,
      })),
    [templates],
  );

  const applyTemplatePrompt = () => {
    if (!selectedTemplate) return;
    setPrompt(selectedTemplate.prompt);
    lastAppliedTemplateRef.current = selectedTemplate.key;
  };

  const isTemplateSelectionDisabled = !isReady || !templates.length;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4 p-4 bg-blue-50 rounded-lg space-y-6"
    >
      {lastError && (
        <div className="p-2 text-sm text-red-700 bg-red-100 border border-red-200 rounded">
          Could not load shared templates. You can still use a custom prompt.
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="adapter" className="block text-sm font-medium text-blue-800 mb-1">
            AI Adapter
          </label>
          <select
            id="adapter"
            value={adapter}
            onChange={(e) => setAdapter(e.target.value)}
            className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
          >
            {adapters.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="document-type" className="block text-sm font-medium text-blue-800 mb-1">
            Document type & template
          </label>
          <select
            id="document-type"
            value={effectiveDocumentTypeKey}
            onChange={(e) => {
              const nextValue = e.target.value;
              setDocumentTypeKey(nextValue);
              if (nextValue !== "custom") {
                setCustomDocumentType("");
              }
            }}
            disabled={isTemplateSelectionDisabled}
            className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
          >
            {templateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="custom">Other / Custom</option>
          </select>
          {documentTypeKey === "custom" && (
            <input
              type="text"
              value={customDocumentType}
              onChange={(e) => setCustomDocumentType(e.target.value)}
              placeholder="Describe the document type"
              className="mt-2 w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
            />
          )}
        </div>
      </div>

      {selectedTemplate && (
        <div className="border border-blue-100 rounded-lg bg-white p-4 space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">{selectedTemplate.label} guidance</p>
              <p className="text-xs text-gray-500">{selectedTemplate.description}</p>
            </div>
            <button
              type="button"
              onClick={applyTemplatePrompt}
              className="self-start md:self-auto px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-400 rounded hover:bg-blue-50"
            >
              Reapply template prompt
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase text-gray-500 font-semibold mb-2">Glossary focus</p>
              <GlossaryList glossary={selectedTemplate.glossary} />
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500 font-semibold mb-2">Style priorities</p>
              {selectedTemplate.styleGuidance?.length ? (
                <ul className="list-disc list-inside text-xs text-gray-700 space-y-1 max-h-32 overflow-y-auto pr-1">
                  {selectedTemplate.styleGuidance.map((item, index) => (
                    <li key={`${selectedTemplate.key}-style-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">No style rules provided.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-blue-800 mb-1">
          Custom prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            lastAppliedTemplateRef.current = null;
          }}
          placeholder="Add extra instructions or refine the template..."
          className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white h-28 resize-none"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cycles" className="block text-sm font-medium text-blue-800 mb-1">
            Self-review cycles ({`${MIN_CYCLES}-${MAX_CYCLES}`})
          </label>
          <input
            id="cycles"
            type="number"
            min={MIN_CYCLES}
            max={MAX_CYCLES}
            value={cycles}
            onChange={(e) => {
              let value = Number.parseInt(e.target.value || MIN_CYCLES, 10);
              value = Number.isNaN(value) ? MIN_CYCLES : value;
              value = Math.max(MIN_CYCLES, Math.min(MAX_CYCLES, value));
              setCycles(value);
            }}
            className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-800 mb-1">
            Compare terminology with another type
          </label>
          <select
            value={comparisonTargetKey}
            onChange={(e) => setComparisonTargetKey(e.target.value)}
            className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
            disabled={isTemplateSelectionDisabled}
          >
            <option value="">Select document type</option>
            {templateOptions
              .filter((option) => option.value !== effectiveDocumentTypeKey)
              .map((option) => (
                <option key={`comparison-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ExampleColumn
          title={selectedTemplate ? `${selectedTemplate.label} preferred output` : "Selection"}
          template={selectedTemplate}
        />
        <ExampleColumn
          title={
            comparisonTemplate
              ? `${comparisonTemplate.label} reference`
              : isLoading
                ? "Loading templates..."
                : "Select a type to compare"
          }
          template={comparisonTemplate}
        />
      </div>
    </motion.div>
  );
}
