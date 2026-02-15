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
      <main className="container mx-auto px-4 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-100/70 px-3 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              M.A.R.I.A. Payment
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="px-2 py-1 rounded-full bg-white/80 border border-slate-200">
                Upload
              </span>
              <span className="text-slate-300">—</span>
              <span className="px-2 py-1 rounded-full bg-white/80 border border-slate-200">
                Review
              </span>
              <span className="text-slate-300">—</span>
              <span className="px-2 py-1 rounded-full bg-blue-600 text-white">
                Payment
              </span>
              <span className="text-slate-300">—</span>
              <span className="px-2 py-1 rounded-full bg-white/80 border border-slate-200">
                Translation in Progress
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] items-start">
            <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-slate-100 p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const returnTo = searchParams.get("return");
                      if (returnTo === "preview") {
                        router.push(`/${processId}/preview`);
                        return;
                      }
                      if (processData?.status === "payment_pending") {
                        router.push(`/${processId}/preview`);
                        return;
                      }
                      router.push("/dashboard");
                    }}
                    className="inline-flex items-center gap-2 text-xs text-slate-500 border border-slate-200 px-3 py-1 rounded-full hover:bg-slate-50"
                  >
                    <span className="text-base">←</span> Back
                  </button>
                  <h1 className="text-3xl font-semibold text-slate-900 mt-4">
                    Payment
                  </h1>
                  <p className="text-sm text-slate-500">
                    Confirm payment to start the translation immediately.
                  </p>
                </div>
              </div>

              {isLoading && (
                <p className="text-sm text-slate-500">Loading...</p>
              )}

              {!isLoading && error && (
                <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {!isLoading && processData && (
                <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">
                      Translation Summary
                    </p>
                    <span className="text-xs text-slate-400">
                      #{processData.id}
                    </span>
                  </div>
                  <div className="grid gap-3 text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span>Document ID</span>
                      <span className="font-medium text-slate-800">
                        #{processData.id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pricing tier</span>
                      <span className="font-medium text-slate-800">
                        {pricingQuote?.tier?.label || "Not configured"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Word count</span>
                      <span className="font-medium text-slate-800">
                        {pricingQuote?.wordCount ?? processData.config?.wordCount ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">
                      Total due
                    </span>
                    <span className="text-xl font-semibold text-blue-700">
                      {estimatedCostLabel}
                    </span>
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
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleStripeCheckout}
                      disabled={isPaying || !stripePublishableKey || !pricingQuote?.tier}
                      className="px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 shadow-md"
                    >
                      {isPaying ? "Redirecting..." : "Pay securely with Stripe"}
                    </button>
                    <div className="flex flex-col items-center justify-center border border-slate-200 rounded-xl p-3 bg-white">
                      {!paypalClientId ? (
                        <p className="text-xs text-slate-500">
                          PayPal client id not configured.
                        </p>
                      ) : (
                        <div id="paypal-button-container" className="w-full" />
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {stripePublishableKey
                      ? "Secure payment • No card data stored"
                      : "Stripe publishable key not configured."}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Why choose M.A.R.I.A.?
              </h2>
              <ul className="space-y-3 text-sm text-slate-600">
                {[
                  "Legal-grade translation quality",
                  "Confidential document handling",
                  "AI + human review process",
                  "Used by professionals worldwide",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-xs">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500">
                Need help? Contact support and we’ll assist with your payment.
              </div>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
