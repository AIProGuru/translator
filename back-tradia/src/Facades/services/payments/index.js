const fs = require("fs");
const path = require("path");
const ProcessFacade = require("../process");
const DocumentProcessingFacade = require("../documents");
const userService = require("../users");
const { PROCESS_STATUS } = require("../../../Api/shared/config/constants");

const processFacade = new ProcessFacade();
const documentFacade = new DocumentProcessingFacade();

function buildFileFromProcess(process) {
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

async function startTranslation(process, userIdOverride = null) {
	const config = process.config || {};
	if (process.status !== PROCESS_STATUS.PAYMENT_PENDING) {
		return { skipped: true };
	}
	const userId = userIdOverride || process.userId || process.user_id;
	if (!userId) {
		throw new Error("User id missing for payment confirmation.");
	}
	const creditAmount =
		Number.parseFloat(config.pricingQuote?.totalCost || 0) || 0;
	if (creditAmount > 0) {
		await userService.adjustCreditBalance(userId, creditAmount, {
			reason: "payment_confirmed",
			processId: process.id,
		});
	}
	await processFacade.updateProcess(
		process.id,
		{
			status: PROCESS_STATUS.PAYMENT_CONFIRMED,
			message: "Payment confirmed. Starting translation.",
			config: {
				...config,
				preview: null,
				payment: {
					...(config.payment || {}),
					status: PROCESS_STATUS.PAYMENT_CONFIRMED,
					confirmedAt: new Date().toISOString(),
					creditGranted: creditAmount,
				},
			},
		},
		userId,
	);

	const file = buildFileFromProcess(process);
	setImmediate(() => {
		documentFacade.processDocument({
			user: { id: userId },
			process,
			file,
			body: config.translation || {},
		});
	});
}

module.exports = {
	buildFileFromProcess,
	startTranslation,
};
