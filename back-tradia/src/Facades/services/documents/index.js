const ProcessManager = require("../../helpers/ProcessManager");
const FileProcessor = require("../../helpers/FileProcessor");
const TranslationHandler = require("../../helpers/TranslationHandler");
const ErrorHandler = require("../../helpers/ErrorHandler");
const ProcessFacade = require("../process");
const path = require("path");
const fs = require("fs");
const constants = require("../../../Api/shared/config/constants");

class DocumentProcessingFacade {
	constructor() {
		this._processManager = new ProcessManager();
		this._fileProcessor = new FileProcessor();
		this._translationHandler = new TranslationHandler();
		this._errorHandler = new ErrorHandler();
		this._processFacade = new ProcessFacade();
	}

	getUploadMiddleware() {
		return this._fileProcessor.getUploadMiddleware();
	}

	async processDocument(req) {
		let processId;
		const userId = req.user.id;
		
		try {
			const { processPath, file, process } =
				await this._processManager.prepareProcess(req);
			processId = process.id;

			await this._fileProcessor.handleFileConversion(
				file,
				process,
				processPath,
				userId
			);

			const translations =
				await this._translationHandler.continueTranslationProcess({
					process,
					processPath,
					file,
					req,
				});

			await this._processManager.finalizeProcess(
				process,
				processPath,
				translations,
				userId
			);
		} catch (err) {
			if (processId) {
				await this._errorHandler.handleProcessError(processId, err, userId);
			}
		} finally {
			if (req.file?.path && fs.existsSync(req.file.path)) {
				fs.unlinkSync(req.file.path);
			}
		}
	}

	_buildFileFromProcess(process) {
		const config = process.config || {};
		const uploadPath = config.uploadPath;
		if (!uploadPath || !fs.existsSync(uploadPath)) {
			throw new Error("Uploaded file not found for this process.");
		}
		return {
			path: uploadPath,
			originalname: config.originalFilename || path.basename(uploadPath),
			mimetype: config.mimeType || "application/pdf",
			size: config.fileSize || 0,
		};
	}

	async generatePreviewTranslation({ processId, userId, maxPages }) {
		const process = await this._processFacade.getProcessById(
			processId,
			userId,
		);
		if (process.status !== constants.PROCESS_STATUS.PAYMENT_PENDING) {
			return { skipped: true };
		}

		const config = process.config || {};
		const previewConfig = config.preview || {};
		if (previewConfig.html && previewConfig.pages_info?.length) {
			return { skipped: true, reason: "preview_exists" };
		}

		const processPath = this._fileProcessor.createProcessDirectory(
			process.id,
		);
		const file = this._buildFileFromProcess(process);

		let pages = [];
		try {
			pages = await this._fileProcessor.getImagesFromPath(processPath);
		} catch (err) {
			pages = [];
		}
		if (!pages || pages.length === 0) {
			await this._fileProcessor.handleFileConversion(
				file,
				process,
				processPath,
				userId,
				{ skipStatusUpdate: true },
			);
		}

		const translationConfig = config.translation || {};
		this._translationHandler.initializeLLM(
			translationConfig,
			process,
			processPath,
		);
		const preview = await this._translationHandler.generatePreviewTranslation(
			{
				process,
				processPath,
				config: translationConfig,
				maxPages,
			},
		);

		const updatedConfig = {
			...(config || {}),
			preview: {
				html: preview.html,
				pages_info: preview.pages_info,
				pages: preview.previewPageCount,
				maxPages:
					Number.isFinite(maxPages) && maxPages > 0
						? maxPages
						: preview.previewPageCount,
				generatedAt: new Date().toISOString(),
			},
		};

		await this._processFacade.updateProcess(
			process.id,
			{ config: updatedConfig },
			userId,
		);

		return {
			processId: process.id,
			previewPages: preview.previewPageCount,
		};
	}

	
}

module.exports = DocumentProcessingFacade;
