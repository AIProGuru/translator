import { Suspense } from "react";
import LoginPageClient from "../components/LoginPageClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-gray-500">Loading...</div>}>
      <LoginPageClient />
    </Suspense>
  );
}
