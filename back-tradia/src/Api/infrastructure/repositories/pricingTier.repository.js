const PricingTier = require("../database/models/pricing_tier.model");

class PricingTierRepository {
	async findAll({ includeInactive = true } = {}) {
		const where = includeInactive ? {} : { isActive: true };
		return PricingTier.findAll({
			where,
			order: [
				["min_words", "ASC"],
				["max_words", "ASC"],
			],
		});
	}

	async findById(id) {
		return PricingTier.findByPk(id);
	}

	async create(payload) {
		return PricingTier.create(payload);
	}

	async update(id, payload) {
		const tier = await PricingTier.findByPk(id);
		if (!tier) {
			throw new Error("Pricing tier not found.");
		}
		await tier.update(payload);
		return tier;
	}

	async delete(id) {
		const tier = await PricingTier.findByPk(id);
		if (!tier) {
			throw new Error("Pricing tier not found.");
		}
		await tier.destroy();
		return true;
	}
}

module.exports = PricingTierRepository;
