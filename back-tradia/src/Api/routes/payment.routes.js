const express = require("express");
const Stripe = require("stripe");
const paypal = require("@paypal/checkout-server-sdk");
const requireAuth = require("../../Facades/middleware/requireAuth");
const ProcessFacade = require("../../Facades/services/process");
const paymentService = require("../../Facades/services/payments");
const { PROCESS_STATUS, FRONT_HOST } = require("../shared/config/constants");

const router = express.Router();
const processFacade = new ProcessFacade();

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
		if (process.status !== PROCESS_STATUS.PAYMENT_PENDING) {
			return res.status(400).json({ error: "Process is not awaiting payment." });
		}

	const pricingQuote = process.config?.pricingQuote;
	if (!pricingQuote?.totalCost || !pricingQuote?.currency) {
		return res.status(400).json({ error: "Pricing quote is missing." });
	}
	const paypalAmount = Number.parseFloat(pricingQuote.totalCost || 0);
	if (!Number.isFinite(paypalAmount) || paypalAmount <= 0) {
		return res.status(400).json({ error: "Invalid pricing amount." });
	}

		const stripe = new Stripe(STRIPE_SECRET_KEY, {
			apiVersion: "2024-06-20",
		});

	const amount = Math.round(Number(pricingQuote.totalCost) * 100);
	const currency = pricingQuote.currency.toLowerCase();
	if (!Number.isFinite(amount) || amount <= 0) {
		return res.status(400).json({ error: "Invalid pricing amount." });
	}

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
	if (session.metadata?.processId && session.metadata.processId !== String(processId)) {
		return res.status(400).json({ error: "Payment does not match this process." });
	}
	const expectedAmount = Math.round(
		Number(process.config?.pricingQuote?.totalCost || 0) * 100,
	);
	if (
		Number.isFinite(expectedAmount) &&
		expectedAmount > 0 &&
		session.amount_total !== expectedAmount
	) {
		return res.status(400).json({ error: "Payment amount mismatch." });
	}

		await paymentService.startTranslation(process, req.user.id);
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
	if (
		process.config?.payment?.orderId &&
		process.config.payment.orderId !== orderId
	) {
		return res.status(400).json({ error: "Payment does not match this process." });
	}
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
					custom_id: String(processId),
					amount: {
						currency_code: pricingQuote.currency,
						value: paypalAmount.toFixed(2),
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

		await paymentService.startTranslation(process, req.user.id);
		return res.json({ message: "Payment confirmed. Translation started." });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

module.exports = router;
