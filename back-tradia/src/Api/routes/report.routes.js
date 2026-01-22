const express = require("express");
const ExcelJS = require("exceljs");
const { Op } = require("sequelize");
const requireAuth = require("../../Facades/middleware/requireAuth");
const TranslationJobService = require("../../Facades/services/translationJobs");

const router = express.Router();
const jobService = new TranslationJobService();

const REPORT_COLUMNS = [
	"jobId",
	"processId",
	"userId",
	"startTime",
	"endTime",
	"sourceLanguage",
	"targetLanguage",
	"pageCount",
	"fileSizeBytes",
	"status",
	"durationMs",
];

const toIsoOrEmpty = (value) =>
	value ? new Date(value).toISOString() : "";

const csvEscape = (value) => {
	const stringValue =
		value === null || value === undefined ? "" : String(value);
	if (/[",\n]/.test(stringValue)) {
		return `"${stringValue.replace(/"/g, '""')}"`;
	}
	return stringValue;
};

const buildReportRow = (job) => {
	const startTime = job.startTime ? new Date(job.startTime) : null;
	const endTime = job.endTime ? new Date(job.endTime) : null;
	const durationMs =
		typeof job.durationMs === "number"
			? job.durationMs
			: startTime && endTime
				? endTime.getTime() - startTime.getTime()
				: null;

	return {
		jobId: job.id,
		processId: job.processId,
		userId: job.userId,
		startTime: toIsoOrEmpty(startTime),
		endTime: toIsoOrEmpty(endTime),
		sourceLanguage: job.sourceLanguage || "",
		targetLanguage: job.targetLanguage || "",
		pageCount: job.pageCount ?? "",
		fileSizeBytes: job.fileSizeBytes ?? "",
		status: job.status || "",
		durationMs: durationMs ?? "",
	};
};

const buildWhereClause = (req) => {
	const where = {};
	if (req.query.status) {
		where.status = req.query.status;
	}
	if (req.query.from || req.query.to) {
		where.created_at = {};
	}
	if (req.query.from) {
		const from = new Date(req.query.from);
		if (Number.isNaN(from.getTime())) {
			return { error: "Invalid 'from' date" };
		}
		where.created_at[Op.gte] = from;
	}
	if (req.query.to) {
		const to = new Date(req.query.to);
		if (Number.isNaN(to.getTime())) {
			return { error: "Invalid 'to' date" };
		}
		where.created_at[Op.lte] = to;
	}
	return { where };
};

router.get("/reports/translations", requireAuth, async (req, res) => {
	try {
		const format = (req.query.format || "csv").toLowerCase();
		const { where, error } = buildWhereClause(req);
		if (error) {
			return res.status(400).json({ error });
		}

		const jobs = await jobService.listByUser(req.user.id, { where });
		const rows = jobs.map(buildReportRow);

		if (format === "xlsx") {
			const workbook = new ExcelJS.Workbook();
			const sheet = workbook.addWorksheet("translations");
			sheet.columns = REPORT_COLUMNS.map((key) => ({
				header: key,
				key,
				width: 20,
			}));
			rows.forEach((row) => sheet.addRow(row));
			const buffer = await workbook.xlsx.writeBuffer();
			res.setHeader(
				"Content-Type",
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			);
			res.setHeader(
				"Content-Disposition",
				"attachment; filename=translations-report.xlsx",
			);
			return res.send(Buffer.from(buffer));
		}

		const header = REPORT_COLUMNS.join(",");
		const csvRows = rows.map((row) =>
			REPORT_COLUMNS.map((key) => csvEscape(row[key])).join(","),
		);
		const csv = [header, ...csvRows].join("\n");
		res.setHeader("Content-Type", "text/csv");
		res.setHeader(
			"Content-Disposition",
			"attachment; filename=translations-report.csv",
		);
		return res.send(csv);
	} catch (error) {
		res.status(500).json({
			error: "Error al generar el reporte",
			details: error.message,
		});
	}
});

router.get(
	"/reports/translations/dashboard",
	requireAuth,
	async (req, res) => {
		try {
			const { where, error } = buildWhereClause(req);
			if (error) {
				return res.status(400).json({ error });
			}
			const jobs = await jobService.listByUser(req.user.id, { where });

			let completed = 0;
			let failed = 0;
			let inProgress = 0;
			let totalPages = 0;
			let totalBytes = 0;
			let durationTotal = 0;
			let durationCount = 0;

			jobs.forEach((job) => {
				if (job.status === "completed") completed += 1;
				else if (job.status === "failed") failed += 1;
				else inProgress += 1;

				if (typeof job.pageCount === "number") {
					totalPages += job.pageCount;
				}
				if (typeof job.fileSizeBytes === "number") {
					totalBytes += job.fileSizeBytes;
				}

				const startTime = job.startTime
					? new Date(job.startTime)
					: null;
				const endTime = job.endTime
					? new Date(job.endTime)
					: null;
				const duration =
					typeof job.durationMs === "number"
						? job.durationMs
						: startTime && endTime
							? endTime.getTime() - startTime.getTime()
							: null;
				if (typeof duration === "number" && duration >= 0) {
					durationTotal += duration;
					durationCount += 1;
				}
			});

			return res.json({
				totalJobs: jobs.length,
				completed,
				failed,
				inProgress,
				totalPages,
				totalBytes,
				avgDurationMs:
					durationCount > 0
						? Math.round(durationTotal / durationCount)
						: null,
			});
		} catch (error) {
			res.status(500).json({
				error: "Error al generar el dashboard",
				details: error.message,
			});
		}
	},
);

module.exports = router;
