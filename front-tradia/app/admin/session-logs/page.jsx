"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/navbar";
import { useSafeFetch } from "@/hooks/useSafeFetch";

const EVENT_OPTIONS = [
  { value: "", label: "All events" },
  { value: "login", label: "Logins" },
  { value: "logout", label: "Logouts" },
];

const RESULT_OPTIONS = [
  { value: "all", label: "All results" },
  { value: "success", label: "Success only" },
  { value: "failure", label: "Failures only" },
];

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

const DEFAULT_FILTERS = {
  limit: 200,
  username: "",
  event: "",
  success: "all",
};

export default function SessionLogsAdminPage() {
  const { safeFetch } = useSafeFetch();
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async (activeFilters) => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (activeFilters.limit) params.set("limit", String(activeFilters.limit));
      if (activeFilters.username.trim()) {
        params.set("username", activeFilters.username.trim());
      }
      if (activeFilters.event) params.set("event", activeFilters.event);
      if (activeFilters.success !== "all") {
        params.set("success", activeFilters.success === "success" ? "true" : "false");
      }
      const query = params.toString();
      const res = await safeFetch(
        query ? `/api/session-logs?${query}` : "/api/session-logs",
      );
      if (!res?.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Unable to fetch audit trail.");
      }
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [safeFetch]);

  useEffect(() => {
    fetchLogs(appliedFilters);
  }, [appliedFilters, fetchLogs]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const successCounts = useMemo(() => {
    return logs.reduce(
      (acc, item) => {
        if (item.success) {
          acc.success += 1;
        } else {
          acc.failure += 1;
        }
        return acc;
      },
      { success: 0, failure: 0 },
    );
  }, [logs]);

  return (
    <ProtectedRoute roles={["administrator"]}>
      <Navbar />
      <main className="container mx-auto px-4 py-10 space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-800">Security audit log</h1>
            <p className="text-sm text-gray-600">
              Review authentication events with IP, device, and timestamps for compliance.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center text-xs text-gray-500">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <p className="font-semibold text-green-700">Successful</p>
              <p className="text-lg text-green-800">{successCounts.success}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="font-semibold text-red-700">Failed</p>
              <p className="text-lg text-red-800">{successCounts.failure}</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedFilters({ ...filters });
            }}
          >
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Username
              </label>
              <input
                type="text"
                value={filters.username}
                onChange={(e) => handleFilterChange("username", e.target.value)}
                className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. admin"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Event
              </label>
              <select
                value={filters.event}
                onChange={(e) => handleFilterChange("event", e.target.value)}
                className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {EVENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Result
              </label>
              <select
                value={filters.success}
                onChange={(e) => handleFilterChange("success", e.target.value)}
                className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {RESULT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Max entries
              </label>
              <input
                type="number"
                min={10}
                max={500}
                value={filters.limit}
                onChange={(e) => {
                  const nextValue = Number(e.target.value);
                  handleFilterChange(
                    "limit",
                    Number.isNaN(nextValue) ? DEFAULT_FILTERS.limit : nextValue,
                  );
                }}
                className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-4 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Apply filters"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters({ ...DEFAULT_FILTERS });
                  setAppliedFilters({ ...DEFAULT_FILTERS });
                }}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Reset filters
              </button>
              <button
                type="button"
                onClick={() => fetchLogs(appliedFilters)}
                className="rounded border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                disabled={isLoading}
              >
                Refresh now
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          {isLoading ? (
            <p className="px-6 py-4 text-sm text-gray-500">Loading audit trail...</p>
          ) : logs.length === 0 ? (
            <p className="px-6 py-4 text-sm text-gray-500">No events found for the current filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Event</th>
                    <th className="px-6 py-3">Result</th>
                    <th className="px-6 py-3">IP / Device</th>
                    <th className="px-6 py-3">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((entry) => (
                    <tr key={entry.id} className="border-t border-gray-100">
                      <td className="px-6 py-3 text-gray-700">{formatDate(entry.createdAt)}</td>
                      <td className="px-6 py-3">
                        <p className="font-semibold text-gray-800">
                          {entry.fullName || "Unknown user"}
                        </p>
                        <p className="text-xs text-gray-500">{entry.username || "n/a"}</p>
                      </td>
                      <td className="px-6 py-3 capitalize text-gray-700">{entry.event}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            entry.success
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {entry.success ? "Success" : "Denied"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-600">
                        <p>{entry.ipAddress || "—"}</p>
                        <p className="truncate text-gray-400 max-w-xs">{entry.userAgent || "—"}</p>
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-600">
                        {entry.metadata ? (
                          <pre className="max-h-24 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </ProtectedRoute>
  );
}
