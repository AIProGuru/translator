"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/navbar";
import { useSafeFetch } from "@/hooks/useSafeFetch";
import { BACK_HOST } from "@/lib/constants";
import ESTIMATED_TIME_PER_PAGE from "@/lib/models";

export default function PaymentPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { processId } = use(params);
  const { safeFetch, setServerError } = useSafeFetch();
  const [processData, setProcessData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState("");

  const pricingQuote = processData?.config?.pricingQuote || null;
  const payment = processData?.config?.payment || null;
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const stripeSessionId = searchParams.get("session_id");
  const paymentStatus = searchParams.get("status");
  const paymentProvider = searchParams.get("provider");

  useEffect(() => {
    const loadProcess = async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await safeFetch(`${BACK_HOST}/api/processes/${processId}`, {
          credentials: "include",
        });
        if (!res?.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Unable to load process.");
        }
        const data = await res.json();
        setProcessData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (processId) {
      loadProcess();
    }
  }, [processId, safeFetch]);

  useEffect(() => {
    const confirmStripe = async () => {
      if (
        paymentProvider !== "stripe" ||
        paymentStatus !== "success" ||
        !stripeSessionId
      ) {
        return;
      }
      setIsPaying(true);
      setError("");
      try {
        const res = await safeFetch(`${BACK_HOST}/api/payments/stripe/confirm`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processId, sessionId: stripeSessionId }),
        });
        if (!res?.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Unable to confirm payment.");
        }
        const timePerPage =
          ESTIMATED_TIME_PER_PAGE[processData?.config?.translation?.adapter] || 1.5;
        const estimatedTime = timePerPage * (processData?.config?.pageCount || 50);
        localStorage.setItem(
          `process_${processId}_estimated_time`,
          estimatedTime,
        );

        router.push(`/${processId}`);
      } catch (err) {
        setError(err.message);
        setServerError(true);
      } finally {
        setIsPaying(false);
      }
    };

    if (processId && stripeSessionId) {
      confirmStripe();
    }
  }, [
    processId,
    stripeSessionId,
    paymentProvider,
    paymentStatus,
    safeFetch,
    router,
    setServerError,
  ]);

  const estimatedCostLabel = useMemo(() => {
    if (!pricingQuote) return "--";
    if (pricingQuote.totalCost === null || pricingQuote.totalCost === undefined) {
      return "--";
    }
    return `${pricingQuote.totalCost} ${pricingQuote.currency}`;
  }, [pricingQuote]);

  const handleStripeCheckout = async () => {
    setIsPaying(true);
    setError("");
    try {
      const res = await safeFetch(`${BACK_HOST}/api/payments/stripe/session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId }),
      });
      if (!res?.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to start Stripe checkout.");
      }
      const data = await res.json();
      if (!data.url) {
        throw new Error("Stripe checkout URL not returned.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setServerError(true);
    } finally {
      setIsPaying(false);
    }
  };

  const handlePaypalApprove = async (orderId) => {
    setIsPaying(true);
    setError("");
    try {
      const res = await safeFetch(`${BACK_HOST}/api/payments/paypal/capture`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId, orderId }),
      });
      if (!res?.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to capture PayPal payment.");
      }

      const timePerPage =
        ESTIMATED_TIME_PER_PAGE[processData?.config?.translation?.adapter] || 1.5;
      const estimatedTime = timePerPage * (processData?.config?.pageCount || 50);
      localStorage.setItem(
        `process_${processId}_estimated_time`,
        estimatedTime,
      );

      router.push(`/${processId}`);
    } catch (err) {
      setError(err.message);
      setServerError(true);
    } finally {
      setIsPaying(false);
    }
  };

  useEffect(() => {
    if (!paypalClientId || !processId) return;

    const existingScript = document.querySelector(
      'script[data-paypal-sdk="true"]',
    );
    if (!existingScript) {
      const script = document.createElement("script");
      const currency = pricingQuote?.currency || "USD";
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=${currency}`;
      script.async = true;
      script.dataset.paypalSdk = "true";
      script.onload = () => {
        if (!window.paypal || !document.getElementById("paypal-button-container")) {
          return;
        }
        window.paypal
          .Buttons({
            createOrder: async () => {
              const res = await safeFetch(`${BACK_HOST}/api/payments/paypal/order`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ processId }),
              });
              if (!res?.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Unable to create PayPal order.");
              }
              const data = await res.json();
              return data.orderId;
            },
            onApprove: async (data) => {
              await handlePaypalApprove(data.orderID);
            },
            onError: (err) => {
              console.error("PayPal error:", err);
              setError("PayPal payment failed.");
              setServerError(true);
            },
          })
          .render("#paypal-button-container");
      };
      document.body.appendChild(script);
    }
  }, [
    paypalClientId,
    pricingQuote?.currency,
    processId,
    safeFetch,
    setServerError,
  ]);

  return (
    <ProtectedRoute>
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-xl p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-blue-800">Payment</h1>
            <p className="text-sm text-gray-600">
              Confirm payment to start the translation process.
            </p>
          </div>

          {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

          {!isLoading && error && (
            <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded px-3 py-2">
              {error}
            </div>
          )}

          {!isLoading && processData && (
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex justify-between">
                <span>Process ID</span>
                <span className="font-medium">{processData.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Word count</span>
                <span className="font-medium">
                  {pricingQuote?.wordCount ?? processData.config?.wordCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Pricing tier</span>
                <span className="font-medium">
                  {pricingQuote?.tier?.label || "Not configured"}
                </span>
              </div>
              <div className="flex justify-between text-base">
                <span className="font-semibold">Total due</span>
                <span className="font-semibold">{estimatedCostLabel}</span>
              </div>
              {payment?.status === "payment_confirmed" && (
                <p className="text-sm text-green-600">
                  Payment already confirmed. Redirecting to processing...
                </p>
              )}
            </div>
          )}

          {!isLoading && (
            <div className="space-y-4">
              <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 flex items-center justify-between gap-2">
                <span>Want to review the 3-page translated preview first?</span>
                <button
                  type="button"
                  onClick={() => router.push(`/${processId}/preview`)}
                  className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  View preview
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={handleStripeCheckout}
                  disabled={isPaying || !stripePublishableKey || !pricingQuote?.tier}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:opacity-60"
                >
                  {isPaying ? "Redirecting..." : "Pay with Stripe"}
                </button>
                <div className="flex flex-col items-center justify-center border rounded p-3">
                  {!paypalClientId ? (
                    <p className="text-xs text-gray-500">
                      PayPal client id not configured.
                    </p>
                  ) : (
                    <div id="paypal-button-container" className="w-full" />
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {stripePublishableKey
                  ? null
                  : "Stripe publishable key not configured."}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
