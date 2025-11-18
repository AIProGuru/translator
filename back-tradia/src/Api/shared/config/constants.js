const path = require("path");
require("dotenv").config()
const BASE_PATH = process.env.BASE_PATH;
const BACK_HOST = process.env.BACK_HOST;
const FRONT_HOST = process.env.FRONT_HOST;
if(!BACK_HOST ) throw new Error("ENV BACK_HOST undefined")
if(!FRONT_HOST) throw new error("ENV FRONT_HOST undefined")
module.exports = {
	BASE_PATH,
	UPLOAD_DIR: path.join(BASE_PATH, "uploads"),
	PORT: process.env.PORT || 5000,
	BACK_HOST,
    FRONT_HOST,
	URL_CONVERTER_API: `${BACK_HOST}/api/convert-pdf-to-image`,
	CONCURRENCY: 2,
	LIMITS_PAGES: process.env.LIMITS_PAGES || 0,

	DATABASE: {
		name: "database",
		username: "root",
		password: "",
		host: "localhost",
		dialect: "sqlite",
		storage: path.join(BASE_PATH, "db", "database.sqlite"),
	},
	BATCH: {
		SIZE: 10,
		DELAY: 1000,
		RETRY_ATTEMPTS: 3,
		RETRY_DELAY: 2000,
	},

	MODELS: {
		GPT4: "gpt-4.1",
		GEMINI: "gemini-2.5-pro-exp-03-25",
		CLAUDE3: "claude-3-7-sonnet-20250219",
		DEFAULT: "gemini-2.5-pro-exp-03-25",
	},

	LIMITS: {
		MAX_FILE_SIZE: 50 * 1024 * 1024,
		MAX_PAGES: 1000,
		TOKEN_LIMITS: {
			"gpt-4-vision": 8192,
			"claude-3": 200000,
		},
	},

	COSTS: {
		"gpt-4-vision": 0.01,
		"claude-3": 0.015,
	},

	PROCESS_STATUS: {
		PENDING: "pending",
		UPLOAD: "upload",
		PROCESSING: "processing",
		TRANSLATING: "translating",
		COMPLETED: "completed",
		ERROR: "error",
		CANCELLED: "canceled",
	},
};
