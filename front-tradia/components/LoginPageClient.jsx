"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { BACK_HOST } from "../lib/constants";

const PasswordRequirements = () => (
  <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside mt-2">
    <li>At least 10 characters</li>
    <li>Include uppercase, lowercase, number, and symbol</li>
  </ul>
);

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, login, changePassword } = useAuth();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingReset, setPendingReset] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const googleAuthUrl = useMemo(() => {
    if (!BACK_HOST) return "/api/auth/google";
    const trimmed = BACK_HOST.endsWith("/")
      ? BACK_HOST.slice(0, -1)
      : BACK_HOST;
    return `${trimmed}/api/auth/google`;
  }, []);

  useEffect(() => {
    if (!isLoading && user && !pendingReset) {
      router.push("/dashboard");
    }
  }, [user, isLoading, pendingReset, router]);

  useEffect(() => {
    if (!searchParams) return;
    const authStatus = searchParams.get("auth");
    if (authStatus === "google_failed") {
      const message =
        searchParams.get("message") ||
        "Google sign-in was cancelled or failed.";
      setError(message);
    }
  }, [searchParams]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const result = await login({
        username: credentials.username,
        password: credentials.password,
      });
      if (result.requiresPasswordChange) {
        setPendingReset({
          currentPassword: credentials.password,
        });
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Unable to login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = googleAuthUrl;
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await changePassword({
        currentPassword: pendingReset?.currentPassword || "",
        newPassword,
      });
      setPendingReset(null);
      setNewPassword("");
      setConfirmPassword("");
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !user) {
    return <p className="text-center mt-10 text-gray-500">Loading...</p>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-800">M.A.R.I.A.</h1>
          <p className="text-sm text-blue-600 mt-1">
            Secure legal translation workspace
          </p>
        </div>

        {!pendingReset ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                value={credentials.username}
                onChange={(e) =>
                  setCredentials((prev) => ({ ...prev, username: e.target.value }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials((prev) => ({ ...prev, password: e.target.value }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="h-5 w-5"
              >
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.5-6 7.8-11.3 7.8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.9 6.1 30 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.5 15.2 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.9 6.1 30 4 24 4 15.6 4 8.4 8.5 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c6 0 10.9-2 14.6-5.4l-6.7-5.5c-2 1.4-4.6 2.3-7.9 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C8.2 39.4 15.5 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.7-3.7 5l.1.1 6.7 5.5c-.5.5 5.6-4.1 5.6-12.6 0-1.2-.1-2.3-.4-3.5z"
                />
              </svg>
              Continue with Google
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handlePasswordReset}>
            <div className="text-sm text-gray-600">
              <p className="font-semibold text-blue-700">
                Password update required
              </p>
              <p className="mt-1">
                Your administrator requires you to choose a new password before
                continuing.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                autoComplete="new-password"
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <PasswordRequirements />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-60"
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
