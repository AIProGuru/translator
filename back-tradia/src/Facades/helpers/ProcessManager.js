const ProcessFacade = require("../../Facades/services/process");
const constants = require("../../Api/shared/config/constants");
const FileManagementService = require("../services/documents/file_management");
const TranslationJobService = require("../services/translationJobs");

class ProcessManager {
	constructor() {
		this._processFacade = new ProcessFacade();
		this._fileManager = new FileManagementService();
		this._translationJobService = new TranslationJobService();
	}

	async prepareProcess(req) {
		this._validateRequest(req);

		const process = req.process;
		if (!process) throw new Error("Proceso no encontrado en la solicitud");

		const processPath = this._fileManager.createProcessDirectory(
			process.id
		);

		return { process, processPath, file: req.file };
	}

	async createProcessRecord(file, userId, translationConfig = {}, jobMeta = {}) {
		const safeCycles = Number.parseInt(translationConfig.cycles, 10);
		const docType = translationConfig.documentType || {};
		const normalizedDocumentType = {
			id: docType.id ?? null,
			key: docType.key || docType.id || "custom",
			label: docType.label || "Custom",
			version: parseInt(docType.version, 10) || 1,
			prompt: docType.prompt || "",
			glossary: Array.isArray(docType.glossary) ? docType.glossary : [],
			styleGuidance: Array.isArray(docType.styleGuidance)
				? docType.styleGuidance
				: [],
		};

		const normalizedTranslationConfig = {
			adapter: translationConfig.adapter || "openai",
			language: translationConfig.language || "spanish",
			sourceLanguage: translationConfig.sourceLanguage || "auto",
			cycles: Number.isNaN(safeCycles) ? 0 : safeCycles,
			prompt: translationConfig.prompt || "",
			documentType: normalizedDocumentType,
		};

		const process = await this._processFacade.createProcess({
			userId:userId,
			slug: `Proceso-de-${Date.now()}`,
			status: constants.PROCESS_STATUS.PENDING,
			startTime: new Date(),
			config: {
				originalFilename: file.originalname,
				fileSize: file.size,
				mimeType: file.mimetype,
				pageCount: jobMeta.pageCount,
				translation: normalizedTranslationConfig,
			},
			message: "Queued for translation",
		});

		await this._translationJobService.createJobMetadata({
			processId: process.id,
			userId,
			sourceLanguage: normalizedTranslationConfig.sourceLanguage,
			targetLanguage: normalizedTranslationConfig.language,
			pageCount: jobMeta.pageCount,
			fileSizeBytes: file.size,
			status: "pending",
			startTime: process.startTime || new Date(),
		});

		return process;
	}

	async finalizeProcess(process, processPath, translations,userId) {
		const endTime = new Date();
		await this._processFacade.updateProcess(process.id, {
			status: constants.PROCESS_STATUS.COMPLETED,
			message: "Action completed successfully",
			progress: 100,
			endTime,
		}, userId);

		console.log("Proceso completado se termino la traduccion");

		const startTime = process.startTime || new Date();
		const durationMs = endTime.getTime() - new Date(startTime).getTime();
		await this._translationJobService.updateByProcessId(process.id, {
			status: "completed",
			endTime,
			durationMs: durationMs >= 0 ? durationMs : null,
		});
		

		return {
			process: {
				id: process.id,
				outputPath: processPath,
				translations: translations.length,
			},
		};
	}

	_validateRequest(req) {
		if (!req.file) throw new Error("No se proporcionó archivo válido");
		this._validateFile(req.file);
	}

	_validateFile(file) {
		const imageTypes = ["image/jpeg", "image/png", "image/jpg"];
		const isPDF = file.mimetype === "application/pdf";
		const isImage = imageTypes.includes(file.mimetype);

		if (!isPDF && !isImage) {
			throw new Error("Solo se aceptan archivos PDF o imágenes");
		}

		if (file.size > constants.LIMITS.MAX_FILE_SIZE) {
			throw new Error(
				`Archivo demasiado grande. Máximo: ${
					constants.LIMITS.MAX_FILE_SIZE / (1024 * 1024)
				}MB`
			);
		}
	}
}

module.exports = ProcessManager;
