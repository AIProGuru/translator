"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/navbar";
import { useSafeFetch } from "@/hooks/useSafeFetch";

const ROLE_OPTIONS = [
  { value: "administrator", label: "Administrator" },
  { value: "supervisor", label: "Supervisor" },
  { value: "translator", label: "Translator" },
  { value: "auditor", label: "Auditor" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

const emptyForm = {
  id: "",
  username: "",
  fullName: "",
  email: "",
  role: "translator",
  status: "active",
  password: "",
};

const DEFAULT_FILTERS = {
  status: "all",
  search: "",
};

export default function UserAdminPage() {
  const { safeFetch } = useSafeFetch();
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isResetting, setIsResetting] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const loadUsers = async (activeFilters = appliedFilters) => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (activeFilters.status !== "all") {
        params.set("status", activeFilters.status);
      }
      if (activeFilters.search.trim()) {
        params.set("search", activeFilters.search.trim());
      }
      const query = params.toString();
      const res = await safeFetch(query ? `/api/users?${query}` : "/api/users", {
        credentials: "include",
      });
      if (!res?.ok) {
        throw new Error("Unable to fetch users");
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  const startCreate = () => {
    setEditingId("new");
    setForm({ ...emptyForm });
    setError("");
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setForm({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email || "",
      role: user.role,
      status: user.status,
      password: "",
    });
    setError("");
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (editingId === "new") {
        const payload = { ...form };
        const res = await safeFetch("/api/users", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res?.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Unable to create user.");
        }
      } else {
        const { password: _ignored, ...rest } = form;
        const res = await safeFetch(`/api/users/${editingId}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rest),
        });
        if (!res?.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Unable to update user.");
        }
      }
      cancelForm();
      loadUsers(appliedFilters);
    } catch (err) {
      setError(err.message);
    }
  };

  const startPasswordReset = (userId) => {
    setResetUserId(userId);
    setNewPassword("");
    setError("");
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    if (!newPassword) {
      setError("Please provide a new password.");
      return;
    }
    setIsResetting(true);
    setError("");
    try {
      const res = await safeFetch(`/api/users/${resetUserId}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res?.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Unable to reset password.");
      }
      setResetUserId(null);
      setNewPassword("");
      loadUsers(appliedFilters);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <ProtectedRoute roles={["administrator"]}>
      <Navbar />
      <main className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-800">User management</h1>
            <p className="text-sm text-gray-600">
              Create, edit, disable accounts and enforce security policies.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startCreate}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              New user
            </button>
            <button
              type="button"
              onClick={() => loadUsers(appliedFilters)}
              className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <section className="bg-white rounded-xl shadow p-4">
          <form
            className="grid gap-4 md:grid-cols-3 items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedFilters({ ...filters });
            }}
          >
            <div>
              <label className="text-sm font-medium text-gray-700">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Name or username"
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="mt-1 w-full border rounded px-3 py-2"
              >
                <option value="all">All</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Apply filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters({ ...DEFAULT_FILTERS });
                  setAppliedFilters({ ...DEFAULT_FILTERS });
                }}
                className="flex-1 px-4 py-2 text-sm font-semibold border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </form>
        </section>

        {error && (
          <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded px-3 py-2">
            {error}
          </div>
        )}

        <section className="bg-white rounded-xl shadow p-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading users...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 uppercase text-xs border-b">
                    <th className="py-2">Name</th>
                    <th className="py-2">Username</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Updated</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-none">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-800">{user.fullName}</div>
                          {user.mustResetPassword && (
                            <span className="px-2 py-0.5 rounded-full border border-orange-200 bg-orange-50 text-[10px] uppercase text-orange-700">
                              Reset req.
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{user.email || "-"}</div>
                      </td>
                      <td className="py-2">{user.username}</td>
                      <td className="py-2 capitalize">{user.role}</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            user.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-gray-500">
                        {user.updatedAt
                          ? new Date(user.updatedAt).toLocaleString()
                          : "-"}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="text-blue-600 hover:underline"
                            onClick={() => startEdit(user)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-purple-600 hover:underline"
                            onClick={() => startPasswordReset(user.id)}
                          >
                            Reset password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!users.length && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        No users found.
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
                {editingId === "new" ? "Create user" : "Edit user"}
              </h2>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={cancelForm}
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, username: e.target.value }))
                    }
                    className="mt-1 w-full border rounded px-3 py-2"
                    required
                    disabled={editingId !== "new"}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, fullName: e.target.value }))
                    }
                    className="mt-1 w-full border rounded px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, role: e.target.value }))
                    }
                    className="mt-1 w-full border rounded px-3 py-2"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="mt-1 w-full border rounded px-3 py-2"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {editingId === "new" && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Temporary password
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    className="mt-1 w-full border rounded px-3 py-2"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Provide a strong temporary password. The user will be asked to
                    change it on first login.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </form>
          </section>
        )}

        {resetUserId && (
          <section className="bg-white rounded-xl shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                Reset password
              </h2>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setResetUserId(null)}
              >
                Close
              </button>
            </div>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2"
                  required
                />
                <PasswordRequirements />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetUserId(null)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 disabled:opacity-60"
                >
                  {isResetting ? "Updating..." : "Update password"}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </ProtectedRoute>
  );
}

function PasswordRequirements() {
  return (
    <ul className="text-xs text-gray-500 list-disc list-inside mt-2 space-y-1">
      <li>Minimum 10 characters</li>
      <li>Upper & lower case letters</li>
      <li>At least one number & symbol</li>
    </ul>
  );
}
