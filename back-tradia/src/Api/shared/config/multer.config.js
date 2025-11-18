const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { UPLOAD_DIR } = require("../config/constants");

if (!fs.existsSync(UPLOAD_DIR)) {
	fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, UPLOAD_DIR);
	},
	filename: (req, file, cb) => {
		const uniqueName = `${Date.now()}-${Math.round(
			Math.random() * 1e9
		)}${path.extname(file.originalname)}`;
		cb(null, uniqueName);
	},
});

module.exports = multer({
	storage,
	limits: { fileSize: 50 * 1024 * 1024 },
});
