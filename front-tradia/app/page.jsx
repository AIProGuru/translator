"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import constants from "../lib/constants";
import Image from "next/image";

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard"); // ya está logueado
    }
  }, [user, isLoading, router]);

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Iniciar sesión</h1>
        <button
          onClick={login}
          className="w-full py-3 px-6 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-lg transition-colors flex items-center justify-center"
        >
          <Image
            src="/google.jpg" 
            alt="Google Logo"
            width={50}
            height={70}
            className="mr-2"
          />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
