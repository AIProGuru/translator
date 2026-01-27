const express = require("express");
const requireAuth = require("../../Facades/middleware/requireAuth");
const requireRole = require("../../Facades/middleware/requireRole");
const PricingTierService = require("../../Facades/services/pricingTiers");

const router = express.Router();
const pricingTierService = new PricingTierService();

router.get("/pricing-tiers", requireAuth, async (req, res) => {
	try {
		const includeInactive = req.query?.includeInactive === "true";
		const tiers = await pricingTierService.listAll({ includeInactive });
		res.json(tiers);
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

router.post(
	"/pricing-tiers",
	requireAuth,
	requireRole(["administrator"]),
	async (req, res) => {
		try {
			const tier = await pricingTierService.create(req.body || {});
			res.status(201).json(tier);
		} catch (error) {
			res.status(400).json({ message: error.message });
		}
	},
);

router.put(
	"/pricing-tiers/:id",
	requireAuth,
	requireRole(["administrator"]),
	async (req, res) => {
		try {
			const tier = await pricingTierService.update(req.params.id, req.body || {});
			res.json(tier);
		} catch (error) {
			res.status(400).json({ message: error.message });
		}
	},
);

router.delete(
	"/pricing-tiers/:id",
	requireAuth,
	requireRole(["administrator"]),
	async (req, res) => {
		try {
			await pricingTierService.delete(req.params.id);
			res.status(204).send();
		} catch (error) {
			res.status(400).json({ message: error.message });
		}
	},
);

module.exports = router;
