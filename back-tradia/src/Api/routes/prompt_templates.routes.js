const express = require("express");
const requireAuth = require("../../Facades/middleware/requireAuth");
const requireRole = require("../../Facades/middleware/requireRole");
const PromptTemplateService = require("../../Facades/services/promptTemplates");

const router = express.Router();
const service = new PromptTemplateService();

const serializeTemplate = (template) => {
  if (!template) return null;
  const plain = template.toJSON ? template.toJSON() : template;
  return {
    id: plain.id,
    key: plain.key,
    label: plain.label,
    description: plain.description,
    prompt: plain.prompt,
    version: plain.version,
    glossary: plain.glossary || [],
    styleGuidance: plain.style_guidance || plain.styleGuidance || [],
    examples: plain.examples || [],
    createdAt: plain.createdAt || plain.created_at,
    updatedAt: plain.updatedAt || plain.updated_at,
  };
};

router.get("/prompt-templates", requireAuth, async (req, res) => {
  try {
    const templates = await service.listAll({ ensureSeed: true });
    res.json(templates.map(serializeTemplate));
  } catch (error) {
    console.error("Error fetching prompt templates:", error);
    res.status(500).json({ message: "Error fetching prompt templates" });
  }
});

router.post("/prompt-templates", requireAuth, requireRole(["administrator"]), async (req, res) => {
  try {
    const template = await service.create(req.body);
    res.status(201).json(serializeTemplate(template));
  } catch (error) {
    console.error("Error creating prompt template:", error);
    res.status(400).json({ message: error.message || "Error creating template" });
  }
});

router.put("/prompt-templates/:id", requireAuth, requireRole(["administrator"]), async (req, res) => {
  try {
    const template = await service.update(req.params.id, req.body);
    res.json(serializeTemplate(template));
  } catch (error) {
    console.error("Error updating prompt template:", error);
    res.status(400).json({ message: error.message || "Error updating template" });
  }
});

router.delete("/prompt-templates/:id", requireAuth, requireRole(["administrator"]), async (req, res) => {
  try {
    await service.delete(req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error("Error deleting prompt template:", error);
    res.status(400).json({ message: error.message || "Error deleting template" });
  }
});

router.post("/prompt-templates/reset", requireAuth, requireRole(["administrator"]), async (req, res) => {
  try {
    const templates = await service.seedDefaults();
    res.json(templates.map(serializeTemplate));
  } catch (error) {
    console.error("Error resetting prompt templates:", error);
    res.status(500).json({ message: "Error resetting templates" });
  }
});

module.exports = router;
