const express = require("express");
const ProcessFacade = require("../../Facades/services/process");
const requireAuth = require("../../Facades/middleware/requireAuth");
const DocumentProcessingFacade = require("../../Facades/services/documents");
const { PROCESS_STATUS } = require("../shared/config/constants");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const processFacade = new ProcessFacade();
const documentFacade = new DocumentProcessingFacade();

router.get(
	"/processes",
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			
			const processes = await processFacade.getAllProcesses(userId);
			res.json(processes);
		} catch (error) {
			res.status(500).json({
				error: "Error al obtener los procesos",
				details: error.message,
			});
		}
	}
);

router.post("/processes", async (req, res) => {
	try {
		const process = await processFacade.createProcess(req.body);
		res.status(201).json(process);
	} catch (error) {
		res.status(400).json({
			error: "Error al crear el proceso",
			details: error.message,
		});
	}
});

router.delete("/processes/:id", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;
		const id = req.params.id;
		await processFacade.deleteProcess(id,userId);
		console.log("Intentando eliminar proceso con ID:", id);
		res.json({ message: "Proceso eliminado correctamente" });
	} catch (error) {
		res.status(400).json({
			error: "Error al eliminar el proceso",
			details: error.message,
		});
	}
});

router.post("/processes/:id/accept", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;
		const processId = req.params.id;
		const process = await processFacade.getProcessById(processId, userId);

		if (process.status !== PROCESS_STATUS.AWAITING_ACCEPTANCE) {
			return res.status(400).json({
				error: "Process is not awaiting acceptance.",
			});
		}

		const config = process.config || {};
		const uploadPath = config.uploadPath;
		if (!uploadPath || !fs.existsSync(uploadPath)) {
			return res.status(404).json({
				error: "Uploaded file not found for this process.",
			});
		}

		const file = {
			path: uploadPath,
			originalname: config.originalFilename || path.basename(uploadPath),
			mimetype: config.mimeType || "application/pdf",
			size: config.fileSize || 0,
		};

		await processFacade.updateProcess(
			processId,
			{
				status: PROCESS_STATUS.PENDING,
				message: "Quote accepted. Starting translation.",
			},
			userId,
		);

		res.json({ message: "Quote accepted. Translation started." });

		setImmediate(() => {
			documentFacade.processDocument({
				user: req.user,
				process,
				file,
				body: config.translation || {},
			});
		});
	} catch (error) {
		res.status(500).json({
			error: "Error accepting process.",
			details: error.message,
		});
	}
});

router.post("/processes/:id/cancel", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;
		const processId = req.params.id;
		const process = await processFacade.getProcessById(processId, userId);

		if (process.status !== PROCESS_STATUS.AWAITING_ACCEPTANCE) {
			return res.status(400).json({
				error: "Process is not awaiting acceptance.",
			});
		}

		const config = process.config || {};
		const uploadPath = config.uploadPath;
		if (uploadPath && fs.existsSync(uploadPath)) {
			fs.unlinkSync(uploadPath);
		}

		await processFacade.updateProcess(
			processId,
			{
				status: PROCESS_STATUS.CANCELLED,
				message: "Process canceled by user.",
			},
			userId,
		);

		res.json({ message: "Process canceled." });
	} catch (error) {
		res.status(500).json({
			error: "Error canceling process.",
			details: error.message,
		});
	}
});

module.exports = router;
