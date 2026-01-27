const PricingTierRepository = require("../../../Api/infrastructure/repositories/pricingTier.repository");

class PricingTierService {
	constructor() {
		this.repository = new PricingTierRepository();
	}

	async listAll({ includeInactive = true } = {}) {
		return this.repository.findAll({ includeInactive });
	}

	async getById(id) {
		return this.repository.findById(id);
	}

	async create(data) {
		const payload = this.normalizePayload(data);
		await this._assertNoOverlap(payload);
		return this.repository.create(payload);
	}

	async update(id, data) {
		const existing = await this.repository.findById(id);
		if (!existing) {
			throw new Error("Pricing tier not found.");
		}
		const mergedInput = {
			label: data.label ?? existing.label,
			minWords: data.minWords ?? data.min_words ?? existing.minWords,
			maxWords: data.maxWords ?? data.max_words ?? existing.maxWords,
			pricePerWord:
				data.pricePerWord ?? data.price_per_word ?? existing.pricePerWord,
			currency: data.currency ?? existing.currency,
			isActive:
				data.isActive ?? data.is_active ?? existing.isActive ?? true,
		};
		const payload = this.normalizePayload(mergedInput);
		await this._assertNoOverlap(payload, { ignoreId: Number(id) });
		return this.repository.update(id, payload);
	}

	async delete(id) {
		return this.repository.delete(id);
	}

	async getTierForWordCount(wordCount) {
		const safeCount = Number.parseInt(wordCount, 10);
		if (!Number.isFinite(safeCount) || safeCount < 0) {
			throw new Error("Word count must be a non-negative integer.");
		}
		const tiers = await this.repository.findAll({ includeInactive: false });
		const matching = tiers.filter((tier) => {
			const min = Number.parseInt(tier.minWords ?? tier.min_words ?? 0, 10);
			const maxValue = tier.maxWords ?? tier.max_words;
			const max =
				maxValue === null || maxValue === undefined
					? null
					: Number.parseInt(maxValue, 10);
			const withinMin = safeCount >= (Number.isFinite(min) ? min : 0);
			const withinMax = max === null ? true : safeCount <= max;
			return withinMin && withinMax;
		});

		if (!matching.length) {
			return null;
		}

		return matching.sort((a, b) => {
			const minA = Number.parseInt(a.minWords ?? a.min_words ?? 0, 10);
			const minB = Number.parseInt(b.minWords ?? b.min_words ?? 0, 10);
			return minB - minA;
		})[0];
	}

	async getQuote(wordCount) {
		const tier = await this.getTierForWordCount(wordCount);
		const safeCount = Number.parseInt(wordCount, 10);
		if (!tier) {
			return {
				wordCount: safeCount,
				tier: null,
				totalCost: null,
				currency: "USD",
			};
		}
		const price = Number.parseFloat(tier.pricePerWord);
		const totalRaw = safeCount * (Number.isFinite(price) ? price : 0);
		const totalCost = Number.isFinite(totalRaw)
			? Number.parseFloat(totalRaw.toFixed(2))
			: null;
		return {
			wordCount: safeCount,
			tier: {
				id: tier.id,
				label: tier.label,
				minWords: tier.minWords ?? tier.min_words ?? 0,
				maxWords: tier.maxWords ?? tier.max_words ?? null,
				pricePerWord: tier.pricePerWord,
				currency: tier.currency,
			},
			totalCost,
			currency: tier.currency,
		};
	}

	normalizePayload(data = {}) {
		const minWords = Number.parseInt(
			data.minWords ?? data.min_words ?? 0,
			10,
		);
		const maxInput = data.maxWords ?? data.max_words;
		const maxWords =
			maxInput === "" || maxInput === undefined || maxInput === null
				? null
				: Number.parseInt(maxInput, 10);
		const pricePerWord = Number.parseFloat(
			data.pricePerWord ?? data.price_per_word,
		);
		const currency = (data.currency || "USD").toString().trim().toUpperCase();
		const label = data.label ? data.label.toString().trim() : null;
		const isActive =
			data.isActive ?? data.is_active ?? data.active ?? true;

		if (!Number.isFinite(minWords) || minWords < 0) {
			throw new Error("minWords must be a non-negative integer.");
		}
		if (maxWords !== null && (!Number.isFinite(maxWords) || maxWords < minWords)) {
			throw new Error("maxWords must be greater than or equal to minWords.");
		}
		if (!Number.isFinite(pricePerWord) || pricePerWord <= 0) {
			throw new Error("pricePerWord must be a positive number.");
		}
		if (currency.length !== 3) {
			throw new Error("currency must be a 3-letter code.");
		}

		return {
			label,
			minWords,
			maxWords,
			pricePerWord,
			currency,
			isActive: Boolean(isActive),
		};
	}

	async _assertNoOverlap(candidate, { ignoreId } = {}) {
		const tiers = await this.repository.findAll({ includeInactive: false });
		const candidateRange = {
			minWords: candidate.minWords,
			maxWords: candidate.maxWords,
		};

		for (const tier of tiers) {
			if (ignoreId && Number(tier.id) === Number(ignoreId)) {
				continue;
			}
			const tierRange = {
				minWords: Number.parseInt(tier.minWords ?? tier.min_words ?? 0, 10),
				maxWords:
					tier.maxWords ?? tier.max_words ?? null,
			};
			if (this._rangesOverlap(candidateRange, tierRange)) {
				throw new Error("Pricing tier overlaps an existing active tier.");
			}
		}
	}

	_rangesOverlap(a, b) {
		const aMax = a.maxWords === null ? Number.POSITIVE_INFINITY : a.maxWords;
		const bMax = b.maxWords === null ? Number.POSITIVE_INFINITY : b.maxWords;
		return a.minWords <= bMax && b.minWords <= aMax;
	}
}

module.exports = PricingTierService;
