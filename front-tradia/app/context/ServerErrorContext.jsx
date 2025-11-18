"use client";
import { createContext, useState, useContext } from "react";

const ServerErrorContext = createContext({
  serverError: false,
  setServerError: (_) => {},
});

export const ServerErrorProvider = ({ children }) => {
  const [serverError, setServerError] = useState(false);

  return (
    <ServerErrorContext.Provider value={{ serverError, setServerError }}>
      {children}
    </ServerErrorContext.Provider>
  );
};

export const useServerError = () => useContext(ServerErrorContext);
