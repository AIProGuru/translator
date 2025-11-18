"use client";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useProcessStatus } from "../../hooks/useProcessStatus";
import ProgressBar from "@/components/progress-bar";
import { BACK_HOST } from "@/lib/constants";
import { AlertTriangle } from "lucide-react";
import { useSafeFetch } from "@/hooks/useSafeFetch";
import ServerErrorModal from "@/components/ServerErrorModal";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function ProcessPage({ params }) {
  const router = useRouter();
  const { processId } = use(params);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selected, setSelected] = useState("pdf");
  const { status, messages, last_message } = useProcessStatus(processId);
  const [showServerErrorModal, setShowServerErrorModal] = useState(false);
  const { safeFetch } = useSafeFetch();
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timePages = localStorage.getItem(
      `process_${processId}_estimated_time`
    );
    if (timePages) {
      setEstimatedTime(parseInt(timePages));
    }
  }, [processId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const progress = useMemo(() => {
    if (!estimatedTime) return 0;
    return Math.min((elapsed / estimatedTime) * 100, 95).toFixed(2);
  }, [elapsed, estimatedTime]);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const response = await safeFetch(
        `${BACK_HOST}/api/download/${processId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: selected }),
          credentials: "include",
        }
      );
      if (!response || !response.ok) throw new Error("Error al descargar");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proceso-${processId}.${selected}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Fallo al descargar:", err);
      setShowServerErrorModal(true);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <ProtectedRoute>
        <main className="container mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl font-bold text-blue-800 mb-4">M.A.R.I.A</h1>
            <p className="text-xl text-blue-600">
              Translations of Legal Document with LLM power
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-3xl mx-auto bg-white rounded-xl shadow-xl p-8"
          >
            {status === "pending" ? (
              <div>
                <h2 className="text-2xl font-bold text-blue-800 mb-6">
                  Processing Document
                </h2>
                <ProgressBar progress={progress} />

                <div className="mt-8 max-h-64 overflow-y-auto bg-blue-50 rounded-lg p-4">
                  {messages.length > 0 ? (
                    messages.map((message, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-2 text-blue-800"
                      >
                        {message}
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-blue-600">
                      Init process of translate...
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center">
                {/* Ícono de estado */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mb-8"
                >
                  {status === "completed" && (
                    <svg
                      className="w-24 h-24 mx-auto text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                  {status === "error" && (
                    <svg
                      className="w-24 h-24 mx-auto text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                      <line
                        x1="15"
                        y1="9"
                        x2="9"
                        y2="15"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <line
                        x1="9"
                        y1="9"
                        x2="15"
                        y2="15"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </motion.div>

                {/* Títulos y mensajes */}
                <h2
                  className={`text-2xl font-bold mb-4 ${
                    status === "completed" ? "text-blue-800" : "text-red-800"
                  }`}
                >
                  {status === "completed" ? "Translate Completed" : `Error`}
                </h2>

                <p
                  className={`mb-8 ${
                    status === "completed" ? "text-blue-600" : "text-red-600"
                  }`}
                >
                  {status === "completed"
                    ? "Sucess translate, you can download your document"
                    : last_message || "unknown error"}
                </p>
                <div className="min-h-24 flex items-center justify-center">
                  <div className="w-64 space-y-2">
                    <label
                      htmlFor="fileType"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Select your file type
                    </label>
                    <div className="relative">
                      <select
                        id="fileType"
                        name="fileType"
                        className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        <option value="pdf">PDF</option>
                        <option value="html">HTML</option>
                        <option value="docx">DOCX</option>
                      </select>
                    </div>
                    {selected === "docx" && (
                      <p className="text-xs text-yellow-600 flex items-center gap-1 mb-5">
                        <AlertTriangle className="h-4 w-4" />
                        File type no recomended
                      </p>
                    )}
                  </div>
                </div>

                {/* Botón */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDownload}
                  disabled={isDownloading || status === "error"}
                  className={`py-3 px-8 ${
                    isDownloading || status === "error"
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white font-semibold rounded-lg shadow-lg transition-colors duration-300`}
                >
                  {isDownloading ? "Downloading..." : "Download Document"}
                </motion.button>
                {showServerErrorModal && (
                  <ServerErrorModal
                    onClose={() => setShowServerErrorModal(false)}
                  />
                )}
              </div>
            )}
          </motion.div>

          <div className="text-center mt-8">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back to home
            </button>
          </div>
        </main>
      </ProtectedRoute>
    </>
  );
}
