"use client";

export default function QuoteModal({
  isOpen,
  quote,
  onAccept,
  onCancel,
  isAccepting,
  isCancelling,
  onPreview,
  isPreviewing,
}) {
  if (!isOpen || !quote) return null;

  const tier = quote.pricingTier;
  const hasTier = Boolean(tier);
  const rangeLabel = tier
    ? `${tier.minWords ?? 0} - ${tier.maxWords ?? "∞"} words`
    : "No pricing tier available";

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white/95 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
              Quote
            </p>
            <h3 className="text-xl font-semibold text-slate-900">
              Translation Quote
            </h3>
          </div>
          <span className="text-xs text-slate-400">#{quote.processId}</span>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-3 text-sm text-slate-700">
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
          <div className="flex justify-between text-base border-t border-slate-100 pt-3">
            <span className="font-semibold">Estimated total</span>
            <span className="font-semibold text-blue-700">
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

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onPreview}
            disabled={!quote.processId || isAccepting || isCancelling || isPreviewing}
            className="px-4 py-2 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-60"
          >
            {isPreviewing ? "Opening..." : "View preview"}
          </button>
          <button
            onClick={onCancel}
            disabled={isCancelling || isAccepting || isPreviewing}
            className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-60"
          >
            {isCancelling ? "Canceling..." : "Cancel"}
          </button>
          <button
            onClick={onAccept}
            disabled={!hasTier || isAccepting || isCancelling || isPreviewing}
            className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 shadow-md"
          >
            {isAccepting ? "Starting..." : "Accept & Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
