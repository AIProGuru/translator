const fs = require("fs-extra");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");
const constants = require("../../../../Api/shared/config/constants");

class FileManagementService {
	constructor() {
		this._setupStorage();
	}

	getUploadMiddleware() {
		return this._upload.single("pdf");
	}

	createProcessDirectory(processId) {
		const processPath = path.join(
			constants.BASE_PATH,
			`process_${processId}`,
		);
		if (!fs.existsSync(processPath)) {
			fs.mkdirSync(processPath, { recursive: true });
		}
		return processPath;
	}
	async getImagesFromPath(processPath) {
		try {
			const files = await fs.promises.readdir(processPath);

			const imageFiles = files.filter((file) =>
				/\.(jpg|jpeg|png)$/i.test(file),
			);

			imageFiles.sort((a, b) => {
				const aNum = parseInt(a.match(/\d+/)?.[0]) || 0;
				const bNum = parseInt(b.match(/\d+/)?.[0]) || 0;
				return aNum - bNum;
			});

			const imagesWithInfo = await Promise.all(
				imageFiles.map(async (filename, index) => {
					const imagePath = path.join(processPath, filename);
					const metadata = await sharp(imagePath).metadata();
					return {
						image: { path: imagePath },
						page_info: {
							pageNumber: index + 1,
							page_number: index + 1,
							filename: filename,
							dimensions: {
								width: metadata.width,
								height: metadata.height,
							},
						},
					};
				}),
			);

			return imagesWithInfo;
		} catch (error) {
			console.error(`Error reading directory ${processPath}:`, error);
			throw new Error(
				`Could not read images from directory: ${error.message}`,
			);
		}
	}

	copyImageFile(file, processPath) {
		const destPath = path.join(processPath, file.originalname);
		fs.copyFileSync(file.path, destPath);
		return destPath;
	}

	_setupStorage() {
		[constants.BASE_PATH, constants.UPLOAD_DIR].forEach((dir) => {
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
		});

		this._storage = multer.diskStorage({
			destination: (req, file, cb) => {
				cb(null, constants.UPLOAD_DIR);
			},
			filename: (req, file, cb) => {
				cb(null, file.originalname);
			},
		});

		this._upload = multer({
			storage: this._storage,
			limits: {
				fileSize: constants.LIMITS.MAX_FILE_SIZE,
			},
		});
	}
}

module.exports = FileManagementService;
