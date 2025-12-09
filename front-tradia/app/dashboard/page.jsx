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
import { useAuth } from "../context/AuthContext";
import { usePromptTemplates } from "../context/PromptTemplateContext";
import Navbar from "../../components/navbar";
import ServerErrorModal from "@/components/ServerErrorModal";
import { useSafeFetch } from "@/hooks/useSafeFetch";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function Home() {
    const router = useRouter();
    const [file, setFile] = useState(null);
    const [language, setLanguage] = useState("spanish");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [adapter, setAdapter] = useState("openai");
  const [prompt, setPrompt] = useState("");
  const [cycles, setCycles] = useState(1);
  const [documentTypeId, setDocumentTypeId] = useState("patents");
  const [customDocumentType, setCustomDocumentType] = useState("");
  const [processes, setProcesses] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
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
    const selectedTemplate =
      documentTypeId && documentTypeId !== "custom"
        ? templates.find((tpl) => tpl.id === documentTypeId)
        : null;
    const documentTypeLabel =
      documentTypeId === "custom"
        ? customDocumentType.trim() || "Custom"
        : selectedTemplate?.label || documentTypeId;

    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("adapter", adapter);
    formData.append("prompt", prompt);
    formData.append("language", language);
    formData.append("cycles", cycles);
    formData.append("documentTypeId", documentTypeId || "custom");
    formData.append("documentTypeLabel", documentTypeLabel);
    formData.append("documentTypeVersion", selectedTemplate?.version?.toString() || "1");
    formData.append("documentTypePrompt", selectedTemplate?.prompt || prompt);

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
            const { processId, pages } = await response.json();

            const timePerPage = ESTIMATED_TIME_PER_PAGE[adapter] || 1.5;
            const estimatedTime = timePerPage * (pages || 50);

            localStorage.setItem(
                `process_${processId}_estimated_time`,
                estimatedTime
            );
            router.push(`/${processId}`);
        } catch (error) {
            console.error("Error uploading document:", error);
            setIsUploading(false);
        }
    };

    return (
        <>
        <ProtectedRoute>
            <Navbar />
            <main className="container mx-auto px-4 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-5xl font-bold text-blue-800 mb-4">M.A.R.I.A.</h1>
                    <p className="text-xl text-blue-600">
                        Translations of Legal Document with LLM power
                    </p>
                </motion.div>

                <div className="flex flex-col md:flex-row gap-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="flex-grow md:w-2/3"
                    >
                        <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
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
                                    className="text-blue-600 hover:text-blue-800 flex items-center"
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
                                        documentTypeId={documentTypeId}
                                        setDocumentTypeId={setDocumentTypeId}
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
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleUpload}
                                    disabled={!file || isUploading}
                                    className={`w-full py-3 px-6 rounded-lg text-white font-semibold ${!file || isUploading
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

                    {/* <motion.div */}
                    {/*     initial={{ opacity: 0, x: 20 }} */}
                    {/*     animate={{ opacity: 1, x: 0 }} */}
                    {/*     transition={{ duration: 0.8, delay: 0.4 }} */}
                    {/*     className="md:w-1/3" */}
                    {/* > */}
                    {/*     <div className="bg-white rounded-xl shadow-xl p-8"> */}
                    {/*         <h2 className="text-2xl font-bold text-blue-800 mb-6"> */}
                    {/*             Active Processes */}
                    {/*         </h2> */}
                    {/*         <ProcessList processes={processes} /> */}
                    {/*     </div> */}
                    {/* </motion.div> */}
                </div>
            </main>
        </ProtectedRoute>
        </>
    );
}
