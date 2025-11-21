'use client';

import { use, useState, useCallback } from "react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { BACK_HOST } from "@/lib/constants";
import { useAuth } from "../../context/AuthContext";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { PDFDocument } from "pdf-lib";
import Cropper from "react-easy-crop";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";

import "@react-pdf-viewer/core/lib/styles/index.css";

function DraggablePatch({ patch }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: patch.id,
    data: { patch },
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="inline-block m-1 border border-gray-400 cursor-move"
    >
      <img
        src={patch.dataUrl}
        alt={`Patch ${patch.id}`}
        className="w-16 h-16 object-contain"
      />
    </div>
  );
}

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

  const [message, setMessage] = useState("");
  const [cropImageUrl, setCropImageUrl] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [patches, setPatches] = useState([]);
  const [placedPatches, setPlacedPatches] = useState([]); // { id, page, x, y, relWidth, relHeight, dataUrl }

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleLoadCropImage = async () => {
    try {
      const imgUrl = token
        ? `${BACK_HOST}/api/preview/original-image/${processId}/1?token=${encodeURIComponent(
            token,
          )}`
        : `${BACK_HOST}/api/preview/original-image/${processId}/1`;
      setCropImageUrl(imgUrl);
      setMessage("Original page image loaded for cropping.");
    } catch (error) {
      console.error("Error loading crop image:", error);
      setMessage("Error loading crop image. Check console for details.");
    }
  };

  const createPatchFromCrop = useCallback(async () => {
    if (!cropImageUrl || !croppedAreaPixels) return;
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = cropImageUrl;

      await new Promise((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
      );

      const dataUrl = canvas.toDataURL("image/png");
      const newPatch = {
        id: `patch-${patches.length + 1}`,
        page: 1,
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height,
        dataUrl,
      };

      setPatches((prev) => [...prev, newPatch]);
      setMessage("Patch created from original PDF.");
    } catch (error) {
      console.error("Error creating patch from crop:", error);
      setMessage("Error creating patch from crop. Check console for details.");
    }
  }, [cropImageUrl, croppedAreaPixels, patches.length]);

  const TranslatedDropArea = () => {
    const { setNodeRef } = useDroppable({ id: "translated-drop-area" });
    return (
      <div
        ref={setNodeRef}
        className="absolute inset-0"
        style={{ pointerEvents: "none" }}
      />
    );
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || over.id !== "translated-drop-area") return;

    const patch = active.data.current?.patch;
    if (!patch) return;

    const placed = {
      ...patch,
      page: 1,
      x: 0.4,
      y: 0.4,
      relWidth: 0.2,
      relHeight: 0.2,
    };

    setPlacedPatches((prev) => [...prev, placed]);
    setMessage("Patch dropped on translated PDF (approximate position).");
  };

  const handleDownloadMerged = async () => {
    try {
      setMessage("Generating merged PDF in browser...");

      const res = await fetch(translatedPdfUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch translated PDF (${res.status})`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      for (const patch of placedPatches) {
        const pageIndex = (patch.page || 1) - 1;
        const page = pages[pageIndex];
        if (!page) continue;

        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const width = patch.relWidth * pageWidth;
        const height = patch.relHeight * pageHeight;
        const x = patch.x * pageWidth;
        const yFromTop = patch.y * pageHeight;
        const y = pageHeight - yFromTop - height;

        const base64 = patch.dataUrl.split(",")[1] || "";
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const embeddedImage = await pdfDoc.embedPng(bytes);

        page.drawImage(embeddedImage, {
          x,
          y,
          width,
          height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `translated-merged-${processId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setMessage("Merged PDF generated and download started.");
    } catch (error) {
      console.error("Error generating merged PDF:", error);
      setMessage("Error generating merged PDF. Check console for details.");
    }
  };

  return (
    <ProtectedRoute>
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-4 text-blue-800">
          PDF Patch Editor (Frontend-only)
        </h2>
        {message && (
          <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded">
            {message}
          </div>
        )}

        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[70vh]">
            {/* Left: Original PDF viewer + crop area */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span>Original PDF (page 1)</span>
                <button
                  onClick={handleLoadCropImage}
                  className="px-2 py-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Load page for cropping
                </button>
              </div>
              <div className="flex-1 grid grid-rows-2">
                <div className="relative overflow-hidden bg-gray-50">
                  <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
                    <Viewer fileUrl={originalPdfUrl} />
                  </Worker>
                </div>
                <div className="relative bg-black/5 flex items-center justify-center">
                  {cropImageUrl ? (
                    <div className="relative w-full h-full">
                      <Cropper
                        image={cropImageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={4 / 3}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 px-2">
                      Click &quot;Load page for cropping&quot; to enable selection.
                    </div>
                  )}
                </div>
              </div>
              <div className="p-2 border-t border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Crop an area on the image above, then create a draggable patch.
                </div>
                <button
                  onClick={createPatchFromCrop}
                  disabled={!cropImageUrl || !croppedAreaPixels}
                  className="px-2 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-40"
                >
                  Create patch from crop
                </button>
              </div>
            </div>

            {/* Right: Translated PDF viewer + drop area */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                Translated PDF (drop patches here)
              </div>
              <div className="relative flex-1 bg-gray-50">
                <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
                  <Viewer fileUrl={translatedPdfUrl} />
                </Worker>
                {/* Drop area over viewer */}
                <div className="absolute inset-0 pointer-events-none">
                  <TranslatedDropArea />
                </div>
              </div>
            </div>
          </div>

          {/* Patch palette */}
          <div className="mt-4 border rounded-lg p-2 bg-gray-50">
            <div className="text-sm font-semibold text-gray-700 mb-1">
              Patches (drag onto translated PDF):
            </div>
            <div className="flex flex-wrap">
              {patches.length === 0 && (
                <div className="text-xs text-gray-500">
                  No patches yet. Crop an area from the original to create one.
                </div>
              )}
              {patches.map((p) => (
                <DraggablePatch key={p.id} patch={p} />
              ))}
            </div>
          </div>

          {/* Download button */}
          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={handleDownloadMerged}
              disabled={placedPatches.length === 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40"
            >
              Download merged translated PDF
            </button>
          </div>
        </DndContext>
      </main>
    </ProtectedRoute>
  );
}


