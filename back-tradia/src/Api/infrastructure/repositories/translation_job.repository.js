const TranslationJob = require("../database/models/translation_job.model");
const { Op } = require("sequelize");

class TranslationJobRepository {
	async findAll(options = {}) {
		try {
			return await TranslationJob.findAll({
				...options,
				order: [["created_at", "DESC"]],
			});
		} catch (error) {
			throw new Error(
				`Error al obtener metadata de traducciones: ${error.message}`,
			);
		}
	}

	async findByProcessId(processId) {
		try {
			return await TranslationJob.findOne({
				where: { processId },
			});
		} catch (error) {
			throw new Error(
				`Error al obtener metadata por proceso: ${error.message}`,
			);
		}
	}

	async create(data) {
		try {
			return await TranslationJob.create({
				processId: data.processId,
				userId: data.userId,
				sourceLanguage: data.sourceLanguage,
				targetLanguage: data.targetLanguage,
				pageCount: data.pageCount,
				fileSizeBytes: data.fileSizeBytes,
				status: data.status || "pending",
				startTime: data.startTime || new Date(),
			});
		} catch (error) {
			throw new Error(
				`Error al crear metadata de traducción: ${error.message}`,
			);
		}
	}

	async updateByProcessId(processId, updates) {
		try {
			const job = await this.findByProcessId(processId);
			if (!job) {
				return null;
			}
			await job.update(updates);
			return job;
		} catch (error) {
			throw new Error(
				`Error al actualizar metadata de traducción: ${error.message}`,
			);
		}
	}

	async deleteOlderThan(cutoffDate) {
		try {
			return await TranslationJob.destroy({
				where: {
					created_at: {
						[Op.lt]: cutoffDate,
					},
				},
			});
		} catch (error) {
			throw new Error(
				`Error al eliminar metadata antigua: ${error.message}`,
			);
		}
	}
}

module.exports = TranslationJobRepository;
