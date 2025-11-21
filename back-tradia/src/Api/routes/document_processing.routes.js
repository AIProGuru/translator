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

const pdfParse = require("pdf-parse");
const { LIMITS_PAGES } = require("../shared/config/constants");

const router = express.Router();
const facade = new DocumentProcessingFacade();

const processFacade = new ProcessFacade();
const fileManagement = new FileManagementService();

// Helper to apply manual image patches (cropped from original PDF) into translated HTML
function applyManualPatchesToHtml(html, process) {
	if (!html) return html;
	const config = process?.dataValues?.config || {};
	const patches = config.manualPatches || [];

	if (!Array.isArray(patches) || patches.length === 0) {
		console.debug(
			"[Patches] No manualPatches to apply for process",
			process?.id,
		);
		return html;
	}

	const pagesInfo = process?.dataValues?.pages_info || [];

	// High‑level debug info to see what we're working with
	try {
		console.debug(
			`[Patches] Applying ${patches.length} patches to process ${
				process?.id
			}. HTML length=${html.length}`,
		);
		console.debug(
			"[Patches] HTML head (first 400 chars):",
			html.slice(0, 400),
		);
		console.debug(
			"[Patches] pages_info:",
			JSON.stringify(pagesInfo, null, 2),
		);
		console.debug(
			"[Patches] manualPatches:",
			JSON.stringify(patches, null, 2),
		);
	} catch (e) {
		console.warn("[Patches] Failed to log debug info:", e?.message);
	}

	let resultHtml = html;

	for (const patch of patches) {
		const { page, target, dataUrl } = patch;
		if (!page || !target || !dataUrl) {
			console.warn(
				"[Patches] Skipping patch with missing fields:",
				patch,
			);
			continue;
		}

		const marker = `<page id="page-${page}">`;
		if (!resultHtml.includes(marker)) {
			console.warn(
				`[Patches] Marker ${marker} not found in HTML for process ${process?.id}; patch will be skipped`,
			);
			continue;
		}

		// Target coordinates are expected to be absolute pixels (already scaled on save)
		let { x, y, width, height } = target;

		console.debug(
			"[Patches] Injecting patch",
			JSON.stringify({ page, x, y, width, height }),
		);

		// High z-index and a visible border so we can clearly see the patched area
		const imgTag = `<img src="${dataUrl}" style="position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; z-index:9999; border:2px solid red; pointer-events:none;" />`;

		resultHtml = resultHtml.replace(marker, `${marker}\n${imgTag}`);
	}

	return resultHtml;
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
		output_html = applyManualPatchesToHtml(output_html, process);
		let dimensions = process?.dataValues?.pages_info[0].dimensions; // Note: las dimensiones se basan en las de la primera página

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
		if (type === "pdf") {
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
		output_html = applyManualPatchesToHtml(output_html, process);
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

// ---------- Manual image patch API ----------

// Body: { page, source: { x, y, width, height }, target: { x, y, width, height } }
router.post("/processes/:id/manual-image", requireAuth, async (req, res) => {
	try {
		const processId = req.params.id;
		const userId = req.user.id;
		const { page, source, target } = req.body || {};

		if (
			!page ||
			!source ||
			typeof source.x !== "number" ||
			typeof source.y !== "number" ||
			typeof source.width !== "number" ||
			typeof source.height !== "number" ||
			(source &&
				(typeof source.x !== "number" ||
					typeof source.y !== "number" ||
					typeof source.width !== "number" ||
					typeof source.height !== "number"))
		) {
			return res.status(400).json({
				error:
					"Invalid body. Expected { page, source: { x, y, width, height }, target?: { x, y, width, height } }",
			});
		}

		const process = await processFacade.getProcessById(processId, userId);
		const processDir = fileManagement.createProcessDirectory(processId);

		// Find the original page image corresponding to this page number
		const images = await fileManagement.getImagesFromPath(processDir);
		const pageEntry = images.find(
			(img) => img.page_info.pageNumber === page || img.page_info.page_number === page,
		);

		if (!pageEntry) {
			return res.status(404).json({
				error: `Original page image for page ${page} not found`,
			});
		}

		// Crop the source region from the original page image
		const pageDims = pageEntry.page_info.dimensions || {};
		let cropBox = {
			x: source.x,
			y: source.y,
			width: source.width,
			height: source.height,
		};

		// If the frontend sent normalized 0–1 coordinates, convert them to pixels
		if (
			pageDims.width &&
			pageDims.height &&
			cropBox.x >= 0 &&
			cropBox.y >= 0 &&
			cropBox.width >= 0 &&
			cropBox.height >= 0 &&
			cropBox.x <= 1 &&
			cropBox.y <= 1 &&
			cropBox.width <= 1 &&
			cropBox.height <= 1
		) {
			cropBox = {
				x: cropBox.x * pageDims.width,
				y: cropBox.y * pageDims.height,
				width: cropBox.width * pageDims.width,
				height: cropBox.height * pageDims.height,
			};
		}

		const buffer = await sharp(pageEntry.image.path)
			.extract({
				left: Math.max(0, Math.round(cropBox.x)),
				top: Math.max(0, Math.round(cropBox.y)),
				width: Math.max(1, Math.round(cropBox.width)),
				height: Math.max(1, Math.round(cropBox.height)),
			})
			.png()
			.toBuffer();

		const base64 = buffer.toString("base64");
		const dataUrl = `data:image/png;base64,${base64}`;

		// Update process.config.manualPatches
		const config = process.dataValues.config || {};
		const patches = Array.isArray(config.manualPatches)
			? config.manualPatches
			: [];

		// Target box: where to place the image in the translated HTML.
		// If the frontend didn't send a target, fall back to the source box.
		let targetBox = target && typeof target.x === "number" ? target : source;

		// Here, we EXPECT targetBox to already be in absolute pixels (because the
		// frontend selection was converted to image pixels before sending).
		// Just make sure the patch has a visible size in pixels.
		const MIN_PIXEL_SIZE = 10;
		if (!targetBox.width || targetBox.width < MIN_PIXEL_SIZE) {
			targetBox.width = MIN_PIXEL_SIZE;
		}
		if (!targetBox.height || targetBox.height < MIN_PIXEL_SIZE) {
			targetBox.height = MIN_PIXEL_SIZE;
		}

		const patch = {
			id: patches.length + 1,
			page,
			target: {
				x: targetBox.x,
				y: targetBox.y,
				width: targetBox.width,
				height: targetBox.height,
			},
			dataUrl,
		};

		patches.push(patch);
		config.manualPatches = patches;

		await processFacade.updateProcess(processId, { config }, userId);

		return res.json({
			success: true,
			patch,
			manualPatches: patches,
		});
	} catch (error) {
		console.error("Error creating manual image patch:", error);
		res.status(500).json({
			error: "Error creating manual image patch",
		});
	}
});

// Body: { page, target: { x, y, width, height }, dataUrl }
// This endpoint skips cropping and directly uses a provided dataUrl (e.g. a test image)
// to create a manual patch. Useful for testing drag-and-drop overlays.
router.post(
	"/processes/:id/manual-image-direct",
	requireAuth,
	async (req, res) => {
		try {
			const processId = req.params.id;
			const userId = req.user.id;
			const { page, target, dataUrl } = req.body || {};

			if (
				!page ||
				!target ||
				typeof target.x !== "number" ||
				typeof target.y !== "number" ||
				typeof target.width !== "number" ||
				typeof target.height !== "number" ||
				!dataUrl ||
				typeof dataUrl !== "string"
			) {
				return res.status(400).json({
					error:
						"Invalid body. Expected { page, target: { x, y, width, height }, dataUrl }",
				});
			}

			console.debug(
				"[Patches-Direct] Incoming body",
				JSON.stringify({ processId, page, target, hasDataUrl: !!dataUrl }),
			);

			const process = await processFacade.getProcessById(processId, userId);
			const pagesInfo = process.dataValues.pages_info || [];

			const pageInfo =
				Array.isArray(pagesInfo) &&
				pagesInfo.find(
					(p) => p.pageNumber === page || p.page_number === page,
				);

			const pageDims = pageInfo?.dimensions || {};

			let targetBox = { ...target };

			// If target box is expressed in 0–1 normalized coordinates, convert to pixels
			if (
				pageDims.width &&
				pageDims.height &&
				targetBox.x >= 0 &&
				targetBox.x <= 1 &&
				targetBox.y >= 0 &&
				targetBox.y <= 1 &&
				targetBox.width > 0 &&
				targetBox.width <= 1 &&
				targetBox.height > 0 &&
				targetBox.height <= 1
			) {
				targetBox = {
					x: targetBox.x * pageDims.width,
					y: targetBox.y * pageDims.height,
					width: targetBox.width * pageDims.width,
					height: targetBox.height * pageDims.height,
				};
			}

			// Ensure visible size
			const MIN_PIXEL_SIZE = 20;
			if (!targetBox.width || targetBox.width < MIN_PIXEL_SIZE) {
				targetBox.width = MIN_PIXEL_SIZE;
			}
			if (!targetBox.height || targetBox.height < MIN_PIXEL_SIZE) {
				targetBox.height = MIN_PIXEL_SIZE;
			}

			const config = process.dataValues.config || {};
			const patches = Array.isArray(config.manualPatches)
				? config.manualPatches
				: [];

			const patch = {
				id: patches.length + 1,
				page,
				target: {
					x: targetBox.x,
					y: targetBox.y,
					width: targetBox.width,
					height: targetBox.height,
				},
				dataUrl,
			};

			console.debug(
				"[Patches-Direct] Saving patch",
				JSON.stringify(patch),
			);

			patches.push(patch);
			config.manualPatches = patches;

			await processFacade.updateProcess(processId, { config }, userId);

			return res.json({
				success: true,
				patch,
				manualPatches: patches,
			});
		} catch (error) {
			console.error("Error creating manual image patch (direct):", error);
			res.status(500).json({
				error: "Error creating manual image patch (direct)",
			});
		}
	},
);

module.exports = router;
