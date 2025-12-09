const express = require("express");
const path = require("path");
const fs = require("fs");
const htmlToDocx = require("html-to-docx");
const sharp = require("sharp");
const DocumentProcessingFacade = require("../../Facades/services/documents");
const FileManagementService = require("../../Facades/services/documents/file_management");
const ProcessFacade = require("../../Facades/services/process");
const Export = require("../../Facades/services/exports/export");
const requireAuth = require("../../Facades/middleware/requireAuth");
const PromptTemplateService = require("../../Facades/services/promptTemplates");

const pdfParse = require("pdf-parse");
const { LIMITS_PAGES } = require("../shared/config/constants");

const router = express.Router();
const facade = new DocumentProcessingFacade();
const promptTemplateService = new PromptTemplateService();

const processFacade = new ProcessFacade();
const fileManagement = new FileManagementService();

/**
 * Remove placeholder elements that represent "dotted" image/signature markers.
 * These are useful in the HTML/preview, but should not appear in the final
 * translated PDF the user downloads.
 *
 * Strategy:
 * 1) Remove elements whose:
 *    - class contains "maria-signature" or "maria-image" or "placeholder", OR
 *    - inline style contains any "dotted" border declaration.
 * 2) As a safety net, neutralize any remaining dotted borders in CSS rules.
 */
function stripPlaceholderRegions(html) {
	if (!html) return html;

	// 1) Remove obvious placeholder elements entirely
	const elementRegex =
		/<([a-zA-Z0-9]+)([^>]*?(?:class=["'][^"']*(?:maria-(?:signature|image)|placeholder)[^"']*["']|style=["'][^"']*dotted[^"']*["'])[^>]*)(?:>([\s\S]*?)<\/\1>|\/>)/gi;

	let cleaned = html.replace(elementRegex, "");

	// 2) Neutralize any remaining dotted borders in CSS (inside <style> blocks)
	// so even if the LLM used a CSS class for dotted placeholders, they will
	// no longer render in the final PDF.
	cleaned = cleaned.replace(/border[^:;{]*:[^;{]*dotted[^;{]*;/gi, "border: none;");
	cleaned = cleaned.replace(
		/border-style\s*:\s*dotted[^;{]*;/gi,
		"border-style: none;",
	);

	return cleaned;
}

router.post("/process-document", requireAuth, async (req, res) => {
	facade.getUploadMiddleware()(req, res, async (err) => {
		if (err) return res.status(400).json({ error: err.message });

		if (!req.file) {
			return res.status(400).json({ error: "Error: archivo vacío." });
		}

		try {
			const userId = req.user?.id;

			if (!userId) {
				return res
					.status(401)
					.json({ error: "Error: autenticación fallida." });
			}

			const adapter = req.body?.adapter || "openai";
			const customPrompt = req.body?.prompt || "";
			const language = req.body?.language || "spanish";
			const cycles = req.body?.cycles;
			const documentTypeKey =
				req.body?.documentTypeKey || req.body?.documentTypeId || "custom";
			const customDocumentType =
				(req.body?.customDocumentType || "Custom").toString().trim() ||
				"Custom";

			let dbTemplate = null;
			if (documentTypeKey && documentTypeKey !== "custom") {
				dbTemplate = await promptTemplateService.getByKey(documentTypeKey);
			}

			const translationConfig = {
				adapter,
				prompt: customPrompt,
				language,
				cycles,
				documentType: dbTemplate
					? {
							id: dbTemplate.id,
							key: dbTemplate.key,
							label: dbTemplate.label,
							version: dbTemplate.version,
							prompt: dbTemplate.prompt,
							glossary: dbTemplate.glossary,
							styleGuidance: dbTemplate.style_guidance,
							examples: dbTemplate.examples || [],
					  }
					: {
							id: null,
							key: "custom",
							label: customDocumentType,
							version: 1,
							prompt: "",
							glossary: [],
							styleGuidance: [],
							examples: [],
					  },
			};

			const filePath = req.file.path;
			const fileData = await fs.promises.readFile(filePath);

			const pdfInfo = await pdfParse(fileData);
			const numPages = pdfInfo.numpages;

			if (numPages > LIMITS_PAGES && LIMITS_PAGES) {
				fs.unlinkSync(filePath);
				return res.status(400).json({
					error: `The limit of pages is ${LIMITS_PAGES} and your document have ${numPages}`,
				});
			}

			const process = await facade._processManager.createProcessRecord(
				req.file,
				userId,
				translationConfig,
			);
			req.process = process;

			res.status(200).json({
				message: "Archivo subido. Iniciando proceso...",
				processId: process.id,
				status: "recibido",
				pages: numPages,
			});

			setImmediate(() => {
				facade.processDocument(req);
			});
		} catch (error) {
			res.status(500).json({
				error: "Error al iniciar el proceso.",
			});
		}
	});
});

router.get("/process-status/:id", requireAuth, async (req, res) => {
	const processId = req.params.id;
	const userId = req.user.id;

	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");

	const sendStatus = (data) => {
		res.write(`data: ${JSON.stringify(data)}\n\n`);
	};

	global.sseConnections = global.sseConnections || {};
	if (!userId) {
		return res.status(401).json({ message: "Usuario no autenticado" });
	}

	try {
		const process = await processFacade.getProcessById(processId, userId);
		const process_data = process.dataValues;
		let last_message = "";
		if (!process) {
			sendStatus({
				processId,
				status: "error",
				message: "Process not found",
			});
			return res.end();
		}
		if (["completed", "error"].includes(process_data.status)) {
			sendStatus({
				processId,
				status: process_data.status,
				message:
					process_data.message || `Status: ${process_data.status}`,
			});
			return res.end();
		}
		global.sseConnections[processId] = sendStatus;

		sendStatus({
			processId,
			status: process_data.status,
			message:
				process_data.message ||
				`Init translations (status: ${process_data.status})`,
		});

		const interval = setInterval(async () => {
			const currentProcess = (
				await processFacade.getProcessById(processId, userId)
			).dataValues;

			if (!currentProcess) {
				sendStatus({
					processId,
					status: "error",
					message: "Process Not Found",
				});
				clearInterval(interval);
				delete global.sseConnections[processId];
				return res.end();
			}
			if (["completed", "error"].includes(currentProcess.status)) {
				sendStatus({
					processId,
					status: currentProcess.status,
					message: currentProcess.message,
				});
				clearInterval(interval);
				delete global.sseConnections[processId];
				return res.end();
			} else {
				if (last_message === currentProcess.message) return;
				last_message = currentProcess.message;
				sendStatus({
					processId,
					status: currentProcess.status,
					message: currentProcess.message,
				});
			}
		}, 1000);

		req.on("close", () => {
			clearInterval(interval);
			delete global.sseConnections[processId];
			res.end();
		});
	} catch (error) {
		sendStatus({
			processId,
			status: "error",
			message: "You don't have permission to view this process",
		});
		res.end();
	}
});

router.post("/download/:id", requireAuth, async (req, res) => {
	try {
		const processId = req.params.id;
		const userId = req.user.id;
		const { type } = req.body;

		if (!["pdf", "docx", "html"].includes(type)) {
			return res.status(400).json({
				error: "Invalid File Type",
			});
		}

		const process = await processFacade.getProcessById(processId, userId);
		let output_html = process?.dataValues?.html;
		let dimensions = process?.dataValues?.pages_info[0].dimensions; // Note: las dimensiones se basan en las de la primera página

		const processDir = fileManagement.createProcessDirectory(processId);
		let filePath = "";
		if (!output_html) {
			return res.status(404).json({
				error: "Result of this process not found",
			});
		}
		if (type === "pdf") {
			// For the final translated PDF, strip dotted placeholder regions so
			// users only see real content (and any patches they added later),
			// not the visual hints produced by the LLM.
			const cleanedHtml = stripPlaceholderRegions(output_html);
			const _exports = new Export({
				html: cleanedHtml,
				process,
				process_dir: processDir,
				dimensions,
			});
			filePath = await _exports.toPDF();
		} else if (type === "docx") {
			const buffer = await htmlToDocx(output_html, null, {
				table: { row: { cantSplit: true } },
				footer: true,
				pageNumber: true,
			});

			filePath = path.join(processDir, `traduccion-${processId}.docx`);
			fs.writeFileSync(filePath, buffer);
		} else if (type === "html") {
			const _exports = new Export({
				html: output_html,
				process,
				process_dir: processDir,
				dimensions,
			});
			filePath = await _exports.toHTML();
		}
		if (!filePath)
			return res.status(500).json({ error: "Error download file" });
		return res.sendFile(filePath);
	} catch (error) {
		res.status(500).json({
			error: "Error download file",
		});
	}
});

// ---------- Preview Endpoints ----------

// Preview original (sanitized) PDF generated from the upload
router.get("/preview/original/:id", requireAuth, async (req, res) => {
	try {
		const processId = req.params.id;
		const userId = req.user.id;

		// Ensure the process exists and belongs to the user
		await processFacade.getProcessById(processId, userId);

		const processDir = fileManagement.createProcessDirectory(processId);
		const files = await fs.promises.readdir(processDir);
		const pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"));

		if (!pdfFile) {
			return res.status(404).json({
				error: "Original PDF for this process not found",
			});
		}

		const pdfPath = path.join(processDir, pdfFile);
		return res.sendFile(pdfPath);
	} catch (error) {
		res.status(500).json({
			error: "Error previewing original PDF",
		});
	}
});

// Preview translated PDF (same as download pdf, but via GET and always PDF)
router.get("/preview/translated/:id", requireAuth, async (req, res) => {
	try {
		const processId = req.params.id;
		const userId = req.user.id;

		const process = await processFacade.getProcessById(processId, userId);
		let output_html = process?.dataValues?.html;
		let dimensions = process?.dataValues?.pages_info[0].dimensions;

		const processDir = fileManagement.createProcessDirectory(processId);
		let filePath = "";
		const _exports = new Export({
			html: output_html,
			process,
			process_dir: processDir,
			dimensions,
		});
		if (!output_html) {
			return res.status(404).json({
				error: "Result of this process not found",
			});
		}

		filePath = await _exports.toPDF();

		if (!filePath)
			return res.status(500).json({ error: "Error generating preview PDF" });
		return res.sendFile(filePath);
	} catch (error) {
		res.status(500).json({
			error: "Error previewing translated PDF",
		});
	}
});

// Preview translated PDF WITHOUT dotted placeholder divs (used as clean base for merged downloads)
router.get(
	"/preview/translated-clean/:id",
	requireAuth,
	async (req, res) => {
		try {
			const processId = req.params.id;
			const userId = req.user.id;

			const process = await processFacade.getProcessById(processId, userId);
			let output_html = process?.dataValues?.html;
			let dimensions = process?.dataValues?.pages_info[0].dimensions;

			const processDir = fileManagement.createProcessDirectory(processId);
			let filePath = "";

			if (!output_html) {
				return res.status(404).json({
					error: "Result of this process not found",
				});
			}

			const cleanedHtml = stripPlaceholderRegions(output_html);
			const _exports = new Export({
				html: cleanedHtml,
				process,
				process_dir: processDir,
				dimensions,
			});

			filePath = await _exports.toPDF();

			if (!filePath)
				return res
					.status(500)
					.json({ error: "Error generating preview PDF" });
			return res.sendFile(filePath);
		} catch (error) {
			res.status(500).json({
				error: "Error previewing translated PDF",
			});
		}
	},
);

// Serve original page image (PNG) for a given process and page number
router.get(
	"/preview/original-image/:id/:page",
	requireAuth,
	async (req, res) => {
		try {
			const processId = req.params.id;
			const pageNumber = parseInt(req.params.page, 10) || 1;
			const userId = req.user.id;

			// Ensure the process exists and belongs to the user
			await processFacade.getProcessById(processId, userId);

			const processDir = fileManagement.createProcessDirectory(processId);
			const images = await fileManagement.getImagesFromPath(processDir);
			const pageEntry = images.find(
				(img) =>
					img.page_info.pageNumber === pageNumber ||
					img.page_info.page_number === pageNumber,
			);

			if (!pageEntry) {
				return res.status(404).json({
					error: `Original page image for page ${pageNumber} not found`,
				});
			}

			return res.sendFile(pageEntry.image.path);
		} catch (error) {
			console.error("Error serving original page image:", error);
			res.status(500).json({
				error: "Error serving original page image",
			});
		}
	},
);

module.exports = router;
