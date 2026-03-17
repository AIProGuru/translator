"use client";

import { BACK_HOST } from "@/lib/constants";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export const useProcessStatus = (processId) => {
    const [status, setStatus] = useState("pending");
    const [messages, setMessages] = useState([]);
    const [last_message, setLastMessage] = useState("")
    const [progress, setProgress] = useState(0);
    const { token } = useAuth();

    useEffect(() => {
        if (!processId) return;

        let retryTimeout;
        let retryCount = 0;
        let isActive = true;

        const connect = () => {
            const url = token
                ? `${BACK_HOST}/api/process-status/${processId}?token=${encodeURIComponent(
                      token
                  )}`
                : `${BACK_HOST}/api/process-status/${processId}`;

            const eventSource = new EventSource(url, {
                withCredentials: true,
            });

            eventSource.onmessage = (event) => {
                if (!isActive) return;

                const data = JSON.parse(event.data);
                setLastMessage(data.message)
                setMessages((prev) => [...prev, data.message]);

                if (typeof data.progress === "number" && Number.isFinite(data.progress)) {
                    setProgress(Math.max(0, Math.min(100, data.progress)));
                } else if (typeof data.message === "string") {
                    const match = data.message.match(/Translate\s+(\d+)\s*\/\s*(\d+)/i);
                    if (match) {
                        const done = Number.parseInt(match[1], 10);
                        const total = Number.parseInt(match[2], 10);
                        if (Number.isFinite(done) && Number.isFinite(total) && total > 0) {
                            const percent = Math.round((done / total) * 100);
                            setProgress(Math.max(0, Math.min(100, percent)));
                        }
                    }
                }
                switch (data.status) {
                    case "completed":
                        setStatus("completed");
                        setProgress(100);
                        eventSource.close();
                        break;
                    case "pending":
                        setStatus("pending");
                        break;
                    case "processing":
                    case "translating":
                    case "upload":
                        setStatus("pending");
                        break;
                    case "awaiting_acceptance":
                        setStatus("awaiting_acceptance");
                        break;
                    case "payment_pending":
                        setStatus("payment_pending");
                        break;
                    case "payment_confirmed":
                        setStatus("payment_confirmed");
                        break;
                    case "error":
                        setStatus("error");
                        eventSource.close();
                        break;
                    case "cancelled":
                    case "canceled":
                        setStatus("cancelled");
                        eventSource.close();
                        break;
                }
            };

            eventSource.onerror = () => {
                eventSource.close();

                if (["cancelled", "completed", "error"].includes(status)) {
                    return;
                }

                retryCount++;
                const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);

                retryTimeout = setTimeout(() => {
                    if (isActive) {
                        connect();
                    }
                }, retryDelay);
            };

            return () => {
                eventSource.close();
                clearTimeout(retryTimeout);
            };
        };

        const cleanup = connect();

        return () => {
            isActive = false;
            cleanup();
        };
    }, [processId, status, token]);

    return { status, messages, progress, last_message };
};
