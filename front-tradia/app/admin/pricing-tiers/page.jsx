"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/navbar";
import { useSafeFetch } from "@/hooks/useSafeFetch";

const emptyForm = {
  id: "",
  label: "",
  minWords: "0",
  maxWords: "",
  pricePerWord: "",
  currency: "USD",
  isActive: true,
};

const tierToForm = (tier) => ({
  id: tier.id,
  label: tier.label || "",
  minWords: String(tier.minWords ?? tier.min_words ?? 0),
  maxWords:
    tier.maxWords === null || tier.max_words === null
      ? ""
      : String(tier.maxWords ?? tier.max_words),
  pricePerWord: String(tier.pricePerWord ?? tier.price_per_word ?? ""),
  currency: tier.currency || "USD",
  isActive: Boolean(tier.isActive ?? tier.is_active ?? true),
});

const formToPayload = (form) => ({
  label: form.label.trim(),
  minWords: form.minWords === "" ? 0 : Number(form.minWords),
  maxWords: form.maxWords === "" ? null : Number(form.maxWords),
  pricePerWord: Number(form.pricePerWord),
  currency: form.currency.trim().toUpperCase(),
  isActive: Boolean(form.isActive),
});

export default function PricingTiersAdminPage() {
  const { safeFetch } = useSafeFetch();
  const [tiers, setTiers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadTiers = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await safeFetch("/api/pricing-tiers?includeInactive=true", {
        credentials: "include",
      });
      if (!res?.ok) {
        throw new Error("Unable to fetch pricing tiers.");
      }
      const data = await res.json();
      setTiers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCreate = () => {
    setEditingId("new");
    setForm({ ...emptyForm });
    setError("");
  };

  const startEdit = (tier) => {
    setEditingId(tier.id);
    setForm(tierToForm(tier));
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const payload = formToPayload(form);
      const isNew = editingId === "new";
      const res = await safeFetch(
        isNew ? "/api/pricing-tiers" : `/api/pricing-tiers/${editingId}`,
        {
          method: isNew ? "POST" : "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res?.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Unable to save pricing tier.");
      }
      cancelEdit();
      loadTiers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this pricing tier? This cannot be undone.")) {
      return;
    }
    setError("");
    try {
      const res = await safeFetch(`/api/pricing-tiers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res?.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Unable to delete tier.");
      }
      loadTiers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <ProtectedRoute roles={["administrator"]}>
      <Navbar />
      <main className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-800">Pricing tiers</h1>
            <p className="text-sm text-gray-600">
              Configure word-count ranges and per-word pricing for translation quotes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startCreate}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Add tier
            </button>
            <button
              type="button"
              onClick={loadTiers}
              className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded px-3 py-2">
            {error}
          </div>
        )}

        <section className="bg-white rounded-xl shadow p-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading pricing tiers...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 uppercase text-xs border-b">
                    <th className="py-2">Label</th>
                    <th className="py-2">Range</th>
                    <th className="py-2">Price/word</th>
                    <th className="py-2">Currency</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier) => {
                    const minWords = tier.minWords ?? tier.min_words ?? 0;
                    const maxWords = tier.maxWords ?? tier.max_words;
                    return (
                      <tr key={tier.id} className="border-b last:border-none">
                        <td className="py-2">
                          <div className="font-semibold text-gray-800">
                            {tier.label || "Untitled tier"}
                          </div>
                        </td>
                        <td className="py-2 text-gray-700">
                          {minWords} - {maxWords ?? "∞"}
                        </td>
                        <td className="py-2 text-gray-700">
                          {tier.pricePerWord ?? tier.price_per_word}
                        </td>
                        <td className="py-2 text-gray-700">{tier.currency}</td>
                        <td className="py-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              tier.isActive ?? tier.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {tier.isActive ?? tier.is_active ? "active" : "inactive"}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="text-blue-600 hover:underline"
                              onClick={() => startEdit(tier)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() => handleDelete(tier.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!tiers.length && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        No pricing tiers configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {editingId && (
          <section className="bg-white rounded-xl shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingId === "new" ? "Add tier" : "Edit tier"}
              </h2>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={cancelEdit}
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Label</label>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                    className="mt-1 w-full border rounded px-3 py-2"
                    placeholder="e.g. Up to 10k"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Currency</label>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, currency: e.target.value }))
                    }
                    className="mt-1 w-full border rounded px-3 py-2"
                    maxLength={3}
                    required
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Min words</label>
                  <input
                    type="number"
                    min="0"
                    value={form.minWords}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, minWords: e.target.value }))
                    }
                    className="mt-1 w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Max words (optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.maxWords}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, maxWords: e.target.value }))
                    }
                    className="mt-1 w-full border rounded px-3 py-2"
                    placeholder="Leave blank for no max"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Price per word</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form.pricePerWord}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, pricePerWord: e.target.value }))
                    }
                    className="mt-1 w-full border rounded px-3 py-2"
                    required
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                />
                Active tier
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700"
                >
                  Save tier
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </ProtectedRoute>
  );
}
