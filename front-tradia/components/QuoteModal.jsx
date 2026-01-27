"use client";

export default function QuoteModal({
  isOpen,
  quote,
  onAccept,
  onCancel,
  isAccepting,
  isCancelling,
}) {
  if (!isOpen || !quote) return null;

  const tier = quote.pricingTier;
  const hasTier = Boolean(tier);
  const rangeLabel = tier
    ? `${tier.minWords ?? 0} - ${tier.maxWords ?? "∞"} words`
    : "No pricing tier available";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Translation Quote
        </h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex justify-between">
            <span>Word count</span>
            <span className="font-medium">{quote.wordCount ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Pricing tier</span>
            <span className="font-medium">{tier?.label || "Not configured"}</span>
          </div>
          <div className="flex justify-between">
            <span>Tier range</span>
            <span className="font-medium">{rangeLabel}</span>
          </div>
          <div className="flex justify-between">
            <span>Price per word</span>
            <span className="font-medium">
              {tier?.pricePerWord ? `${tier.pricePerWord} ${tier.currency}` : "--"}
            </span>
          </div>
          <div className="flex justify-between text-base">
            <span className="font-semibold">Estimated total</span>
            <span className="font-semibold">
              {quote.estimatedCost !== null && quote.estimatedCost !== undefined
                ? `${quote.estimatedCost} ${quote.currency}`
                : "--"}
            </span>
          </div>
          {!hasTier && (
            <p className="text-xs text-red-600">
              No pricing tier is configured. Please contact an administrator.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isCancelling || isAccepting}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:opacity-60"
          >
            {isCancelling ? "Canceling..." : "Cancel"}
          </button>
          <button
            onClick={onAccept}
            disabled={!hasTier || isAccepting || isCancelling}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
          >
            {isAccepting ? "Starting..." : "Accept & Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
