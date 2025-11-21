"use client";

import { use, useRef, useState } from "react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { BACK_HOST } from "@/lib/constants";
import { useAuth } from "../../context/AuthContext";

export default function PreviewPage({ params }) {
  const { processId } = use(params);
  const { token } = useAuth();

  const originalPdfUrl = token
    ? `${BACK_HOST}/api/preview/original/${processId}?token=${encodeURIComponent(
        token,
      )}`
    : `${BACK_HOST}/api/preview/original/${processId}`;

  const translatedPdfUrl = token
    ? `${BACK_HOST}/api/preview/translated/${processId}?token=${encodeURIComponent(
        token,
      )}`
    : `${BACK_HOST}/api/preview/translated/${processId}`;

  const originalImageUrl = token
    ? `${BACK_HOST}/api/preview/original-image/${processId}/1?token=${encodeURIComponent(
        token,
      )}`
    : `${BACK_HOST}/api/preview/original-image/${processId}/1`;

  const [selection, setSelection] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });
  const originalContainerRef = useRef(null);
  const [message, setMessage] = useState("");
  const [translatedKey, setTranslatedKey] = useState(0);

  const handleMouseDown = (e) => {
    if (!originalContainerRef.current) return;
    const rect = originalContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    console.log("[Preview] mouseDown original:", { x, y, rect });
    startRef.current = { x, y };
    setSelection({ x, y, width: 0, height: 0 });
    setIsDragging(true);
    setMessage("");
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !originalContainerRef.current) return;
    const rect = originalContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const start = startRef.current;
    const width = x - start.x;
    const height = y - start.y;
    const nextSelection = {
      x: width < 0 ? x : start.x,
      y: height < 0 ? y : start.y,
      width: Math.abs(width),
      height: Math.abs(height),
    };
    setSelection(nextSelection);
    // Debug current selection while dragging
    // (this will spam the console while moving, but helpful for now)
    console.debug("[Preview] mouseMove selection:", nextSelection);
  };

  const handleMouseUp = async () => {
    if (!isDragging || !selection || !originalContainerRef.current) return;
    setIsDragging(false);

    try {
      // Normalize to 0–1 relative coordinates within original container
      const rect = originalContainerRef.current.getBoundingClientRect();
      const source = {
        x: selection.x / rect.width,
        y: selection.y / rect.height,
        width: selection.width / rect.width,
        height: selection.height / rect.height,
      };
      console.log("[Preview] mouseUp normalized source:", {
        selection,
        rect,
        source,
      });

      const body = {
        page: 1,
        source,
      };

      const res = await fetch(
        `${BACK_HOST}/api/processes/${processId}/manual-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
          credentials: "include",
        },
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error(
          "[Preview] manual-image response not OK:",
          res.status,
          errJson,
        );
        throw new Error(errJson.error || "Error creating manual image patch");
      }

      console.log("[Preview] manual-image patch saved successfully");
      setSelection(null);
      setMessage(
        "Patch applied. Reloading translated preview to include the new image...",
      );
      setTranslatedKey((k) => k + 1); // Force iframe reload
    } catch (error) {
      console.error("Error saving manual image patch:", error);
      setMessage(
        "Error saving patch. Check console/logs for more details and ensure the backend is running.",
      );
    }
  };

  return (
    <ProtectedRoute>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4 text-blue-800">
          Preview: Original vs Translated
        </h1>
        <p className="mb-4 text-sm text-gray-600">
          Select a region on the original preview (left) to copy that part of the
          original document into the translated PDF (right) at the same relative
          position. Use this to restore missing logos, signatures, barcodes, etc.
        </p>
        {message && (
          <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded">
            {message}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[80vh]">
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
              Original (page 1) – drag to select a region (applied immediately)
            </div>
            <div
              ref={originalContainerRef}
              className="relative flex-1 w-full h-full bg-gray-50 cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <img
                src={originalImageUrl}
                alt="Original page 1"
                className="w-full h-full object-contain"
              />
              {selection && (
                <div
                  className="absolute border-2 border-blue-500 border-dashed bg-blue-200 bg-opacity-20 pointer-events-none"
                  style={{
                    left: selection.x,
                    top: selection.y,
                    width: selection.width,
                    height: selection.height,
                  }}
                />
              )}
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
              Translated PDF (auto‑reloaded after each patch)
            </div>
            <div className="relative flex-1 w-full h-full bg-gray-50">
              <iframe
                key={translatedKey}
                src={translatedPdfUrl}
                className="absolute inset-0 w-full h-full"
                title="Translated PDF preview"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          Note: currently this tool applies patches to page 1 only. Each selection
          is applied immediately to the translated PDF at the same relative
          position.
        </div>
      </main>
    </ProtectedRoute>
  );
}

