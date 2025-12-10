"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children, roles }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/");
      return;
    }
    if (Array.isArray(roles) && roles.length > 0 && !roles.includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, isLoading, roles, router]);

  if (isLoading) {
    return <div className="py-10 text-center text-gray-500">Verifying access...</div>;
  }

  if (!user) {
    return <div className="py-10 text-center text-gray-500">Redirecting...</div>;
  }

  if (Array.isArray(roles) && roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="py-10 text-center text-red-600">
        You do not have permission to view this section.
      </div>
    );
  }

  return children;
}
