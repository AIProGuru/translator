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

	
}

module.exports = DocumentProcessingFacade;
