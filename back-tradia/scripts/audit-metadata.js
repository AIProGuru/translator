const TranslationJob = require("../src/Api/infrastructure/database/models/translation_job.model");

const allowedFields = new Set([
	"id",
	"processId",
	"userId",
	"sourceLanguage",
	"targetLanguage",
	"pageCount",
	"fileSizeBytes",
	"status",
	"startTime",
	"endTime",
	"durationMs",
	"createdAt",
	"updatedAt",
]);

const disallowedFieldNames = ["html", "content", "body", "text"];

const audit = () => {
	const modelFields = Object.keys(TranslationJob.rawAttributes || {});
	const unknownFields = modelFields.filter(
		(field) => !allowedFields.has(field),
	);
	const disallowedPresent = modelFields.filter((field) =>
		disallowedFieldNames.includes(field.toLowerCase()),
	);

	if (disallowedPresent.length > 0) {
		console.error(
			`FAIL: disallowed fields present in translation_jobs: ${disallowedPresent.join(", ")}`,
		);
		process.exit(1);
	}

	if (unknownFields.length > 0) {
		console.error(
			`FAIL: unexpected fields in translation_jobs: ${unknownFields.join(", ")}`,
		);
		process.exit(1);
	}

	console.log("PASS: translation_jobs schema stores metadata only.");
	process.exit(0);
};

audit();
