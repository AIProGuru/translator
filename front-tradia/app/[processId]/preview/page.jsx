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
  const originalImageRef = useRef(null);
  const [imageMeta, setImageMeta] = useState(null); // natural vs displayed size
  const [message, setMessage] = useState("");
  const [translatedKey, setTranslatedKey] = useState(0);

  // Simple inline test image (small red square) for drag-and-drop testing
  const testImageDataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAJklEQVR4nO3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAC4GAPiAAE2iI+SAAAAAElFTkSuQmCC";

  const handleMouseDown = (e) => {
    if (!originalImageRef.current) return;
    const rect = originalImageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    console.log("[Preview] mouseDown original:", { x, y, rect });
    startRef.current = { x, y };
    setSelection({ x, y, width: 0, height: 0 });
    setIsDragging(true);
    setMessage("");
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !originalImageRef.current) return;
    const rect = originalImageRef.current.getBoundingClientRect();
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
    if (!isDragging || !selection || !originalImageRef.current || !imageMeta)
      return;
    setIsDragging(false);

    try {
      // Map selection (display pixels) to original image pixel coordinates
      const rect = originalImageRef.current.getBoundingClientRect();
      const { naturalWidth, naturalHeight, displayWidth, displayHeight } =
        imageMeta;
      const scaleX = naturalWidth / displayWidth;
      const scaleY = naturalHeight / displayHeight;

      const source = {
        x: selection.x * scaleX,
        y: selection.y * scaleY,
        width: selection.width * scaleX,
        height: selection.height * scaleY,
      };
      console.log(
        "[Preview] mouseUp source in original image pixels:",
        {
          selection,
          rect,
          imageMeta,
          scaleX,
          scaleY,
          source,
        },
      );

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

  const handleTestDragStart = (e) => {
    console.log("[Preview] handleTestDragStart fired");
    e.dataTransfer.effectAllowed = "copyMove";
    // Some browsers require at least one standard type to start a drag operation
    e.dataTransfer.setData("text/plain", "maria-test-image");
    e.dataTransfer.setData(
      "application/x-maria-test-image",
      JSON.stringify({ dataUrl: testImageDataUrl }),
    );
  };

  const handleDropOnTranslated = async (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-maria-test-image");
    if (!raw) return;

    try {
      const { dataUrl } = JSON.parse(raw);

      const rect = e.currentTarget.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      const target = {
        x: relX,
        y: relY,
        width: 0.2, // 20% of page width
        height: 0.2, // 20% of page height
      };

      const body = {
        page: 1,
        target,
        dataUrl,
      };

      const res = await fetch(
        `${BACK_HOST}/api/processes/${processId}/manual-image-direct`,
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
          "[Preview] manual-image-direct response not OK:",
          res.status,
          errJson,
        );
        throw new Error(
          errJson.error || "Error creating manual image test patch",
        );
      }

      console.log("[Preview] manual-image-direct patch saved successfully");
      setMessage(
        "Test image patch applied via drag-and-drop. Reloading translated preview...",
      );
      setTranslatedKey((k) => k + 1);
    } catch (error) {
      console.error("Error saving manual image test patch:", error);
      setMessage(
        "Error saving test patch. Check console/logs for more details.",
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
          <div className="mb-2 col-span-1 md:col-span-2 flex items-center gap-4">
            <span className="text-sm text-gray-700">
              Drag this test image onto the translated PDF (right side) to verify
              image overlay:
            </span>
            <img
              src={testImageDataUrl}
              alt="Test drag image"
              draggable={true}
              onDragStart={handleTestDragStart}
              className="w-12 h-12 border border-gray-400 cursor-move"
            />
          </div>
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
                ref={originalImageRef}
                src={originalImageUrl}
                alt="Original page 1"
                className="w-full h-full object-contain"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const rect = img.getBoundingClientRect();
                  setImageMeta({
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    displayWidth: rect.width,
                    displayHeight: rect.height,
                  });
                  console.log("[Preview] original image meta:", {
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    displayWidth: rect.width,
                    displayHeight: rect.height,
                  });
                }}
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
              {/* The iframe shows the PDF, but an invisible overlay on top captures drops */}
              <iframe
                key={translatedKey}
                src={translatedPdfUrl}
                className="absolute inset-0 w-full h-full pointer-events-none"
                title="Translated PDF preview"
              />
              <div
                className="absolute inset-0 w-full h-full"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  console.log("[Preview] Drop event on translated container");
                  handleDropOnTranslated(e);
                }}
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

