const express = require("express");
const Stripe = require("stripe");
const paypal = require("@paypal/checkout-server-sdk");
const ProcessFacade = require("../../Facades/services/process");
const paymentService = require("../../Facades/services/payments");
const { PROCESS_STATUS } = require("../shared/config/constants");

const router = express.Router();
const processFacade = new ProcessFacade();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENV = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

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

router.post(
	"/payments/stripe/webhook",
	express.raw({ type: "application/json" }),
	async (req, res) => {
		try {
			if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
				return res.status(400).json({
					error: "Stripe webhook is not configured.",
				});
			}
			const stripe = new Stripe(STRIPE_SECRET_KEY, {
				apiVersion: "2024-06-20",
			});

			const signature = req.headers["stripe-signature"];
			let event;
			try {
				event = stripe.webhooks.constructEvent(
					req.body,
					signature,
					STRIPE_WEBHOOK_SECRET,
				);
			} catch (error) {
				return res.status(400).json({ error: "Invalid Stripe signature." });
			}

			if (event.type === "checkout.session.completed") {
				const session = event.data.object || {};
				const processId = session.metadata?.processId;
				if (processId) {
					const process = await processFacade.getProcessByIdInternal(
						processId,
					);
					if (
						process &&
						process.status === PROCESS_STATUS.PAYMENT_PENDING
					) {
						await paymentService.startTranslation(process, process.userId);
					}
				}
			}

			return res.json({ received: true });
		} catch (error) {
			return res.status(500).json({ error: error.message });
		}
	},
);

router.post(
	"/payments/paypal/webhook",
	express.json(),
	async (req, res) => {
		try {
			if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_WEBHOOK_ID) {
				return res.status(400).json({
					error: "PayPal webhook is not configured.",
				});
			}

			const client = getPaypalClient();
			const request = new paypal.notifications.VerifyWebhookSignatureRequest();
			request.requestBody({
				auth_algo: req.headers["paypal-auth-algo"],
				cert_url: req.headers["paypal-cert-url"],
				transmission_id: req.headers["paypal-transmission-id"],
				transmission_sig: req.headers["paypal-transmission-sig"],
				transmission_time: req.headers["paypal-transmission-time"],
				webhook_id: PAYPAL_WEBHOOK_ID,
				webhook_event: req.body,
			});

			const response = await client.execute(request);
			const verificationStatus = response?.result?.verification_status;
			if (verificationStatus !== "SUCCESS") {
				return res.status(400).json({ error: "Invalid PayPal signature." });
			}

			const event = req.body || {};
			const eventType = event.event_type;
			const resource = event.resource || {};
			const processId = resource.custom_id;

			if (
				processId &&
				[
					"PAYMENT.CAPTURE.COMPLETED",
					"CHECKOUT.ORDER.APPROVED",
				].includes(eventType)
			) {
				const process = await processFacade.getProcessByIdInternal(processId);
				if (
					process &&
					process.status === PROCESS_STATUS.PAYMENT_PENDING
				) {
					await paymentService.startTranslation(process, process.userId);
				}
			}

			return res.json({ received: true });
		} catch (error) {
			return res.status(500).json({ error: error.message });
		}
	},
);

module.exports = router;
