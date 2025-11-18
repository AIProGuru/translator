"use client";

import { BACK_HOST } from "@/lib/constants";
import { useEffect, useState } from "react";

export const useProcessStatus = (processId) => {
    const [status, setStatus] = useState("pending");
    const [messages, setMessages] = useState([]);
    const [last_message, setLastMessage] = useState("")
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!processId) return;

        let retryTimeout;
        let retryCount = 0;
        let isActive = true;

        const connect = () => {
            const eventSource = new EventSource(`${BACK_HOST}/api/process-status/${processId}`, {
                withCredentials: true,
            });

            eventSource.onmessage = (event) => {
                if (!isActive) return;

                const data = JSON.parse(event.data);
                setLastMessage(data.message)
                setMessages((prev) => [...prev, data.message]);
                switch (data.status) {
                    case "completed":
                        setStatus("completed");
                        eventSource.close();
                        break;
                    case "pending":
                        setStatus("pending");
                        if (data.message) {
                            setProgress(Math.min(95, (messages.length + 1) * 5));
                        }
                        break;
                    case "error":
                        setStatus("error");
                        eventSource.close();
                        break;
                    case "cancelled":
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
    }, [processId, status]);

    return { status, messages, progress, last_message };
};
