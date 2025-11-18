const FileManagementService = require("../services/documents/file_management");
const PDFService = require("../services/documents/pdf-converter");
const ProcessFacade = require("../services/process");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const constants = require("../../Api/shared/config/constants");

class FileProcessor {
	constructor() {
		this._fileManager = new FileManagementService();
		this._pdfService = new PDFService();
		this._processFacade = new ProcessFacade();
	}

	getUploadMiddleware() {
		return this._fileManager.getUploadMiddleware();
	}

	async handleFileConversion(file, process, processPath, userId) {
		const fileExtension = path.extname(file.originalname).toLowerCase();
		const isImage = [
			".jpg",
			".jpeg",
			".png",
			".gif",
			".bmp",
			".webp",
			".tiff",
		].includes(fileExtension);

		if (isImage) {
			const imageName = file.originalname;
			const imagePath = path.join(processPath, imageName);


			fs.copyFileSync(file.path, imagePath);

			const metadata = await sharp(imagePath).metadata();

			process.config.images = [
				{
					name: imageName,
					path: imagePath,
					dimensions: {
						width: metadata.width,
						height: metadata.height,
					},
				},
			];

			return;
		}

		const result = await this._pdfService.convertPDFToImages(
			file.path,
			processPath
		);
		process.config.images = result.images;

		await this._processFacade.updateProcess(process.id, {
			status: constants.PROCESS_STATUS.UPLOAD,
			message: 'The PDF was uploaded for translation.',
			progress: 10,
		  }, userId);
		  console.log("Empezando a subir los archivos")
	}

	createProcessDirectory(processId) {
		return this._fileManager.createProcessDirectory(processId);
	}

	getImagesFromPath(processPath) {
		return this._fileManager.getImagesFromPath(processPath);
	}
}

module.exports = FileProcessor;
