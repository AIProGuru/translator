const PromptTemplateRepository = require("../../../Api/infrastructure/repositories/promptTemplate.repository");
const defaultTemplates = require("../../../Api/shared/data/promptTemplates");

class PromptTemplateService {
  constructor() {
    this.repository = new PromptTemplateRepository();
  }

  async listAll({ ensureSeed = false } = {}) {
    let templates = await this.repository.findAll();
    if (ensureSeed && templates.length === 0) {
      await this.seedDefaults();
      templates = await this.repository.findAll();
    }
    return templates;
  }

  async seedDefaults() {
    await this.repository.deleteAll();
    for (const template of defaultTemplates) {
      await this.repository.create(template);
    }
    return this.repository.findAll();
  }

  async getById(id) {
    return this.repository.findById(id);
  }

  async getByKey(key) {
    return this.repository.findByKey(key);
  }

  async create(data) {
    const payload = this.normalizePayload(data);
    if (!payload.label) {
      throw new Error("Template label is required.");
    }
    if (!payload.prompt) {
      throw new Error("Template prompt is required.");
    }
    const existing = await this.repository.findByKey(payload.key);
    if (existing) {
      throw new Error("A template with this key already exists.");
    }
    return this.repository.create(payload);
  }

  async update(id, data) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Prompt template not found");
    }
    const mergedInput = {
      key: data.key ?? existing.key,
      label: data.label ?? existing.label,
      description: data.description ?? existing.description,
      prompt: data.prompt ?? existing.prompt,
      version: data.version ?? existing.version,
      glossary: data.glossary ?? existing.glossary,
      styleGuidance: data.styleGuidance ?? existing.style_guidance,
      examples: data.examples ?? existing.examples,
    };
    const payload = this.normalizePayload(mergedInput, { allowMissingKey: true });
    if (payload.key) {
      const duplicate = await this.repository.findByKey(payload.key);
      if (duplicate && duplicate.id !== Number(id)) {
        throw new Error("A template with this key already exists.");
      }
    }
    return this.repository.update(id, payload);
  }

  async delete(id) {
    return this.repository.delete(id);
  }

  normalizePayload(data = {}, { allowMissingKey = false } = {}) {
    const key = (data.key || data.slug || data.identifier || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!key && !allowMissingKey) {
      throw new Error("Template key is required.");
    }

    const sanitizeArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    };

    const sanitizeGlossary = (value) => {
      const entries = sanitizeArray(value);
      return entries
        .map((entry) => ({
          source: entry?.source?.trim(),
          target: entry?.target?.trim(),
        }))
        .filter((entry) => entry.source && entry.target);
    };

    const sanitizeExamples = (value) => {
      const entries = sanitizeArray(value);
      return entries
        .map((entry) => ({
          source: entry?.source?.trim(),
          translation: entry?.translation?.trim(),
        }))
        .filter((entry) => entry.source && entry.translation);
    };

    const styleGuidance = sanitizeArray(data.styleGuidance || data.style_guidance).map(
      (line) => (typeof line === "string" ? line.trim() : ""),
    ).filter(Boolean);

    const payload = {
      label: data.label?.trim(),
      description: data.description?.trim(),
      prompt: data.prompt || "",
      version: parseInt(data.version, 10) || 1,
      glossary: sanitizeGlossary(data.glossary),
      style_guidance: styleGuidance,
      examples: sanitizeExamples(data.examples),
    };

    if (!allowMissingKey || key) {
      payload.key = key;
    }

    return payload;
  }
}

module.exports = PromptTemplateService;
