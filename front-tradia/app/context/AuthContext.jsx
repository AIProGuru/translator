"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BACK_HOST } from "../../lib/constants.js";
import { useServerError } from "./ServerErrorContext"; 

const AuthContext = createContext({
  user: null,
  token: null,
  login: async () => {},
  logout: async () => {},
  isLoading: true,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); 
  const { setServerError } = useServerError();
  const router = useRouter();
  

  useEffect(() => {
    console.log("BACK_HOST", BACK_HOST);
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
      const res = await fetch(`${BACK_HOST}/api/auth/test-login`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Test login failed");
      }

      const data = await res.json();
      setUser(data.user);
      setToken(data.token);
      setServerError(false);
    } catch (error) {
      console.error("Error during test login:", error);
      setUser(null);
      setToken(null);
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
      setToken(null);
      router.push("/"); 
    } catch (error) {
      console.error("Error al intentar conectar con el backend:", error);
      setServerError(true); 
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext) ?? {
  user: null,
  token: null,
  login: async () => {},
  logout: async () => {},
  isLoading: true,
};
