const express = require("express");
const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");
const paypal = require("@paypal/checkout-server-sdk");
const requireAuth = require("../../Facades/middleware/requireAuth");
const ProcessFacade = require("../../Facades/services/process");
const DocumentProcessingFacade = require("../../Facades/services/documents");
const { PROCESS_STATUS, FRONT_HOST } = require("../shared/config/constants");

const router = express.Router();
const processFacade = new ProcessFacade();
const documentFacade = new DocumentProcessingFacade();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENV = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();

function getPaypalClient() {
	const environment =
		PAYPAL_ENV === "live"
			? new paypal.core.LiveEnvironment(
					PAYPAL_CLIENT_ID,
					PAYPAL_CLIENT_SECRET,
			  )
			: new paypal.core.SandboxEnvironment(
					PAYPAL_CLIENT_ID,
					PAYPAL_CLIENT_SECRET,
			  );
	return new paypal.core.PayPalHttpClient(environment);
}

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

async function startTranslation(process, user) {
	const config = process.config || {};
	const file = buildFileFromProcess(process);
	await processFacade.updateProcess(
		process.id,
		{
			status: PROCESS_STATUS.PAYMENT_CONFIRMED,
			message: "Payment confirmed. Starting translation.",
			config: {
				...config,
				payment: {
					...(config.payment || {}),
					status: PROCESS_STATUS.PAYMENT_CONFIRMED,
					confirmedAt: new Date().toISOString(),
				},
			},
		},
		user.id,
	);

	setImmediate(() => {
		documentFacade.processDocument({
			user,
			process,
			file,
			body: config.translation || {},
		});
	});
}

router.post("/payments/stripe/session", requireAuth, async (req, res) => {
	try {
		if (!STRIPE_SECRET_KEY) {
			return res.status(400).json({
				error: "Stripe keys are not configured.",
			});
		}
		const { processId } = req.body || {};
		if (!processId) {
			return res.status(400).json({ error: "processId is required." });
		}

		const process = await processFacade.getProcessById(processId, req.user.id);
		if (process.status !== PROCESS_STATUS.PAYMENT_PENDING) {
			return res.status(400).json({ error: "Process is not awaiting payment." });
		}

		const pricingQuote = process.config?.pricingQuote;
		if (!pricingQuote?.totalCost || !pricingQuote?.currency) {
			return res.status(400).json({ error: "Pricing quote is missing." });
		}

		const stripe = new Stripe(STRIPE_SECRET_KEY, {
			apiVersion: "2024-06-20",
		});

		const amount = Math.round(Number(pricingQuote.totalCost) * 100);
		const currency = pricingQuote.currency.toLowerCase();

		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			success_url: `${FRONT_HOST}/${processId}/payment?provider=stripe&status=success&session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${FRONT_HOST}/${processId}/payment?provider=stripe&status=cancelled`,
			line_items: [
				{
					price_data: {
						currency,
						product_data: {
							name: "Translation service",
							description: `Process ${processId}`,
						},
						unit_amount: amount,
					},
					quantity: 1,
				},
			],
			metadata: {
				processId: String(processId),
				userId: String(req.user.id),
			},
		});

		await processFacade.updateProcess(
			processId,
			{
				config: {
					...(process.config || {}),
					payment: {
						...(process.config?.payment || {}),
						provider: "stripe",
						sessionId: session.id,
					},
				},
			},
			req.user.id,
		);

		return res.json({ url: session.url });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

router.post("/payments/stripe/confirm", requireAuth, async (req, res) => {
	try {
		if (!STRIPE_SECRET_KEY) {
			return res.status(400).json({
				error: "Stripe keys are not configured.",
			});
		}
		const { processId, sessionId } = req.body || {};
		if (!processId || !sessionId) {
			return res.status(400).json({ error: "processId and sessionId are required." });
		}

		const process = await processFacade.getProcessById(processId, req.user.id);
		const stripe = new Stripe(STRIPE_SECRET_KEY, {
			apiVersion: "2024-06-20",
		});

		const session = await stripe.checkout.sessions.retrieve(sessionId);
		if (session.payment_status !== "paid") {
			return res.status(400).json({ error: "Payment not completed." });
		}

		await startTranslation(process, req.user);
		return res.json({ message: "Payment confirmed. Translation started." });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

router.post("/payments/paypal/order", requireAuth, async (req, res) => {
	try {
		if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
			return res.status(400).json({
				error: "PayPal keys are not configured.",
			});
		}
		const { processId } = req.body || {};
		if (!processId) {
			return res.status(400).json({ error: "processId is required." });
		}

		const process = await processFacade.getProcessById(processId, req.user.id);
		if (process.status !== PROCESS_STATUS.PAYMENT_PENDING) {
			return res.status(400).json({ error: "Process is not awaiting payment." });
		}

		const pricingQuote = process.config?.pricingQuote;
		if (!pricingQuote?.totalCost || !pricingQuote?.currency) {
			return res.status(400).json({ error: "Pricing quote is missing." });
		}

		const request = new paypal.orders.OrdersCreateRequest();
		request.prefer("return=representation");
		request.requestBody({
			intent: "CAPTURE",
			purchase_units: [
				{
					description: `Translation service ${processId}`,
					amount: {
						currency_code: pricingQuote.currency,
						value: pricingQuote.totalCost.toString(),
					},
				},
			],
			application_context: {
				brand_name: "Amigo Translations",
				shipping_preference: "NO_SHIPPING",
				user_action: "PAY_NOW",
				return_url: `${FRONT_HOST}/${processId}/payment?provider=paypal&status=success`,
				cancel_url: `${FRONT_HOST}/${processId}/payment?provider=paypal&status=cancelled`,
			},
		});

		const client = getPaypalClient();
		const order = await client.execute(request);

		await processFacade.updateProcess(
			processId,
			{
				config: {
					...(process.config || {}),
					payment: {
						...(process.config?.payment || {}),
						provider: "paypal",
						orderId: order.result.id,
					},
				},
			},
			req.user.id,
		);

		return res.json({ orderId: order.result.id });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

router.post("/payments/paypal/capture", requireAuth, async (req, res) => {
	try {
		if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
			return res.status(400).json({
				error: "PayPal keys are not configured.",
			});
		}
		const { processId, orderId } = req.body || {};
		if (!processId || !orderId) {
			return res
				.status(400)
				.json({ error: "processId and orderId are required." });
		}

		const process = await processFacade.getProcessById(processId, req.user.id);
		const request = new paypal.orders.OrdersCaptureRequest(orderId);
		request.requestBody({});

		const client = getPaypalClient();
		const capture = await client.execute(request);

		if (capture.result.status !== "COMPLETED") {
			return res.status(400).json({ error: "Payment not completed." });
		}

		await startTranslation(process, req.user);
		return res.json({ message: "Payment confirmed. Translation started." });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

module.exports = router;
