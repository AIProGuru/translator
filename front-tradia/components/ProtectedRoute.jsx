"use client";

import { useAuth } from "../context/AuthContext"; // Ajusta la ruta según dónde esté tu AuthContext
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      // Redirige al login si no hay usuario autenticado
      router.push("/");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    // Muestra un estado de carga mientras se verifica la autenticación
    return <div>Cargando...</div>;
  }

  return children; // Renderiza los componentes protegidos si está autenticado
}