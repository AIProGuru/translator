const TranslationJobRepository = require("../../../Api/infrastructure/repositories/translation_job.repository");
const constants = require("../../Api/shared/config/constants");

class TranslationJobService {
	constructor() {
		this.repository = new TranslationJobRepository();
	}

	async createJobMetadata(payload) {
		return await this.repository.create(payload);
	}

	async updateByProcessId(processId, updates) {
		return await this.repository.updateByProcessId(processId, updates);
	}

	async listByUser(userId, options = {}) {
		const where = { userId, ...(options.where || {}) };
		return await this.repository.findAll({
			where,
		});
	}

	async purgeExpired() {
		const retentionDays = constants.METADATA_RETENTION_DAYS;
		if (!retentionDays || retentionDays <= 0) {
			return 0;
		}
		const cutoff = new Date(
			Date.now() - retentionDays * 24 * 60 * 60 * 1000,
		);
		return await this.repository.deleteOlderThan(cutoff);
	}
}

module.exports = TranslationJobService;
