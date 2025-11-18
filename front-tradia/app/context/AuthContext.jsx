"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BACK_HOST } from "../../lib/constants.js";
import { useServerError } from "./ServerErrorContext"; 

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); 
  const { setServerError } = useServerError();
  const router = useRouter();
  

  useEffect(() => {
    fetch(`${BACK_HOST}/api/auth/me`, {
      credentials: "include",
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
      })
      .catch((err) => {
        setUser(null);
        setServerError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);


  const login = async () => {
    try {
      const res = await fetch(`${BACK_HOST}/api/auth/ping`, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error("Servidor no responde");
      }

      window.location.href = `${BACK_HOST}/api/auth/google`;
    } catch (error) {
      console.error("Error al intentar conectar con el backend:", error);
      setServerError(true); 
    }
  };

  const logout = async () => {
    try {
      const res = await fetch(`${BACK_HOST}/api/auth/ping`, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error("Servidor no responde");
      }

      await fetch(`${BACK_HOST}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      setUser(null);
      router.push("/"); 
    } catch (error) {
      console.error("Error al intentar conectar con el backend:", error);
      setServerError(true); 
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
