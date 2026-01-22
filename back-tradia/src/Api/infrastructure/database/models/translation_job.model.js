const { DataTypes } = require("sequelize");
const sequelize = require("../connections/sequelize.connection")
	.getInstance()
	.getConnection();

const TranslationJob = sequelize.define(
	"TranslationJob",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
			allowNull: false,
		},
		processId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			field: "process_id",
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			field: "user_id",
		},
		sourceLanguage: {
			type: DataTypes.STRING(64),
			allowNull: true,
			field: "source_language",
		},
		targetLanguage: {
			type: DataTypes.STRING(64),
			allowNull: true,
			field: "target_language",
		},
		pageCount: {
			type: DataTypes.INTEGER,
			allowNull: true,
			field: "page_count",
		},
		fileSizeBytes: {
			type: DataTypes.BIGINT,
			allowNull: true,
			field: "file_size_bytes",
		},
		status: {
			type: DataTypes.ENUM(
				"pending",
				"processing",
				"translating",
				"completed",
				"failed",
			),
			allowNull: false,
			defaultValue: "pending",
		},
		startTime: {
			type: DataTypes.DATE,
			allowNull: true,
			field: "start_time",
		},
		endTime: {
			type: DataTypes.DATE,
			allowNull: true,
			field: "end_time",
		},
		durationMs: {
			type: DataTypes.BIGINT,
			allowNull: true,
			field: "duration_ms",
		},
	},
	{
		tableName: "translation_jobs",
		timestamps: true,
		underscored: true,
		indexes: [
			{
				name: "idx_translation_jobs_user",
				fields: ["user_id"],
			},
			{
				name: "idx_translation_jobs_process",
				fields: ["process_id"],
			},
			{
				name: "idx_translation_jobs_status",
				fields: ["status"],
			},
		],
	},
);

module.exports = TranslationJob;
