"use client";

import ServerErrorModal from "@/components/ServerErrorModal";
import { useServerError } from "../context/ServerErrorContext";

export default function GlobalModals() {
  const { serverError, setServerError } = useServerError();

  if (!serverError) return null;

  return <ServerErrorModal onClose={() => setServerError(false)} />;
}
