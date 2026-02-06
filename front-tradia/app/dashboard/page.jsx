"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import UploadArea from "@/components/upload-area";
import LanguageSelector from "@/components/language-selector";
import AdvancedSettings from "@/components/advanced-settings";
import ProcessList from "@/components/process-list";
import { FRONT_HOST, BACK_HOST } from "@/lib/constants";
import ESTIMATED_TIME_PER_PAGE from "@/lib/models";
import { useAuth } from "../../context/AuthContext";
import { usePromptTemplates } from "../../context/PromptTemplateContext";
import Navbar from "../../components/navbar";
import ServerErrorModal from "@/components/ServerErrorModal";
import { useSafeFetch } from "@/hooks/useSafeFetch";
import ProtectedRoute from "../../components/ProtectedRoute";
import QuoteModal from "@/components/QuoteModal";

export default function Home() {
    const router = useRouter();
    const [file, setFile] = useState(null);
    const [language, setLanguage] = useState("spanish");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [adapter, setAdapter] = useState("openai");
  const [prompt, setPrompt] = useState("");
  const [cycles, setCycles] = useState(1);
  const [documentTypeKey, setDocumentTypeKey] = useState(null);
  const [customDocumentType, setCustomDocumentType] = useState("");
  const [processes, setProcesses] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [isAcceptingQuote, setIsAcceptingQuote] = useState(false);
  const [isCancelingQuote, setIsCancelingQuote] = useState(false);
  const { user, isLoading } = useAuth();
  const { safeFetch, serverError, setServerError } = useSafeFetch();
  const { templates } = usePromptTemplates();

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (!user) {
            router.push("/");
        } else {
            fetchProcesses();
        }
    }, [user, isLoading]);

    useEffect(() => {
        if (!documentTypeKey && templates.length) {
            setDocumentTypeKey(templates[0].key);
        }
    }, [documentTypeKey, templates]);

    const fetchProcesses = async () => {
        try {
            const response = await safeFetch(`${BACK_HOST}/api/processes`, {
                method: "GET",
                credentials: "include",
            });
            const data = await response.json();

            setProcesses(data);
        } catch (error) {
            console.error("Error fetching processes:", error);
        }
    };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    const templateKey = documentTypeKey || "custom";
    const selectedTemplate =
      templateKey !== "custom"
        ? templates.find((tpl) => tpl.key === templateKey)
        : null;
    const documentTypeLabel =
      templateKey === "custom"
        ? customDocumentType.trim() || "Custom"
        : selectedTemplate?.label || templateKey;

    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("adapter", adapter);
    formData.append("prompt", prompt);
    formData.append("language", language);
    formData.append("cycles", cycles);
    formData.append("documentTypeKey", templateKey);
    formData.append("customDocumentType", documentTypeLabel);

    try {
            const response = await safeFetch(`${BACK_HOST}/api/process-document`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            if (!response) {
                setServerError(true);
                return;
            }

            if (response.status === 401 || response.status === 403) {
                window.location.href = `${FRONT_HOST}/`;
                return;
            }
            if (!response.ok) {
                setServerError(true);
                setIsUploading(false);
                return;
            }

            const data = await response.json();
            setQuoteData(data);
            setShowQuoteModal(true);
            setIsUploading(false);
        } catch (error) {
            console.error("Error uploading document:", error);
            setIsUploading(false);
        }
    };

    const handleAcceptQuote = async () => {
    if (!quoteData?.processId) return;
    setIsAcceptingQuote(true);
    try {
      const response = await safeFetch(
        `${BACK_HOST}/api/processes/${quoteData.processId}/accept`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!response || !response.ok) {
        setServerError(true);
        return;
      }
      const data = await response.json();
      setShowQuoteModal(false);
      if (data?.paymentUrl) {
        router.push(data.paymentUrl);
      } else {
        const timePerPage = ESTIMATED_TIME_PER_PAGE[adapter] || 1.5;
        const estimatedTime = timePerPage * (quoteData.pages || 50);
        localStorage.setItem(
          `process_${quoteData.processId}_estimated_time`,
          estimatedTime,
        );
        router.push(`/${quoteData.processId}`);
      }
    } catch (error) {
      console.error("Error accepting quote:", error);
      setServerError(true);
    } finally {
      setIsAcceptingQuote(false);
    }
  };

  const handleCancelQuote = async () => {
    if (!quoteData?.processId) {
      setShowQuoteModal(false);
      return;
    }
    setIsCancelingQuote(true);
    try {
      const response = await safeFetch(
        `${BACK_HOST}/api/processes/${quoteData.processId}/cancel`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!response || !response.ok) {
        setServerError(true);
        return;
      }
      setShowQuoteModal(false);
      setFile(null);
      setQuoteData(null);
    } catch (error) {
      console.error("Error canceling quote:", error);
      setServerError(true);
    } finally {
      setIsCancelingQuote(false);
    }
  };

    return (
        <>
        <ProtectedRoute>
            <Navbar />
            <main className="container mx-auto px-4 py-10">
                <div className="max-w-6xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="mb-10"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                
                                <h1 className="text-4xl font-semibold text-slate-900 mb-2">
                                    AI-Powered Legal Document Translation
                                </h1>
                                <p className="text-sm text-slate-500">
                                    Upload a document and receive a structured translation while preserving layout.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 text-4xl font-semibold text-blue-700 bg-blue-100/70 px-3 py-1 rounded-full">
                                M.A.R.I.A.
                            </div>
                        </div>
                    </motion.div>

                    <div className="items-start">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="flex-grow"
                        >
                            <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-slate-100 p-8 mb-8">
                                <UploadArea file={file} setFile={setFile} />

                                <div className="mt-8">
                                    <LanguageSelector
                                        language={language}
                                        setLanguage={setLanguage}
                                    />
                                </div>

                                <div className="mt-6">
                                    <button
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                        className="text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium"
                                    >
                                        <span>Advanced Settings</span>
                                        <svg
                                            className={`ml-2 w-5 h-5 transition-transform ${showAdvanced ? "rotate-180" : ""
                                                }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 9l-7 7-7-7"
                                            />
                                        </svg>
                                    </button>

                                    {showAdvanced && (
                                        <AdvancedSettings
                                            adapter={adapter}
                                            setAdapter={setAdapter}
                                            prompt={prompt}
                                            setPrompt={setPrompt}
                                            cycles={cycles}
                                            setCycles={setCycles}
                                            documentTypeKey={documentTypeKey}
                                            setDocumentTypeKey={setDocumentTypeKey}
                                            customDocumentType={customDocumentType}
                                            setCustomDocumentType={setCustomDocumentType}
                                        />
                                    )}
                                </div>

                                <div className="mt-8">
                                    {serverError && (
                                        <ServerErrorModal onClose={() => setServerError(false)} />
                                    )}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleUpload}
                                        disabled={!file || isUploading}
                                        className={`w-full py-3 px-6 rounded-xl text-white font-semibold ${!file || isUploading
                                            ? "bg-blue-300 cursor-not-allowed"
                                            : "bg-blue-600 hover:bg-blue-700"
                                            } transition-colors duration-300 shadow-lg`}
                                    >
                                        {isUploading ? (
                                            <span className="flex items-center justify-center">
                                                <svg
                                                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <circle
                                                        className="opacity-25"
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                    ></circle>
                                                    <path
                                                        className="opacity-75"
                                                        fill="currentColor"
                                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    ></path>
                                                </svg>
                                                Processing...
                                            </span>
                                        ) : (
                                            "Translate Document"
                                        )}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>

                    </div>
                </div>
            </main>
            <QuoteModal
              isOpen={showQuoteModal}
              quote={quoteData}
              onAccept={handleAcceptQuote}
              onCancel={handleCancelQuote}
              isAccepting={isAcceptingQuote}
              isCancelling={isCancelingQuote}
            />
        </ProtectedRoute>
        </>
    );
}
