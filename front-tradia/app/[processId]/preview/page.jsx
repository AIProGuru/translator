'use client';

import { use, useEffect, useState, useCallback, useRef } from "react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { BACK_HOST } from "@/lib/constants";
import { useAuth } from "../../context/AuthContext";
import { PDFDocument, rgb } from "pdf-lib";
import ReactCrop from "react-image-crop";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import * as pdfjsLib from "pdfjs-dist/build/pdf";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "react-image-crop/dist/ReactCrop.css";

// Configure pdf.js worker for client-side rendering of translated PDF pages
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js";
}

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

  // Use the standard translated preview (with dotted placeholders) for on-screen viewing,
  // but a "clean" version (without dotted placeholders) as the base for the merged download.
  const translatedPdfPreviewUrl = token
    ? `${BACK_HOST}/api/preview/translated/${processId}?token=${encodeURIComponent(
        token,
      )}`
    : `${BACK_HOST}/api/preview/translated/${processId}`;

  const translatedPdfCleanUrl = token
    ? `${BACK_HOST}/api/preview/translated-clean/${processId}?token=${encodeURIComponent(
        token,
      )}`
    : `${BACK_HOST}/api/preview/translated-clean/${processId}`;

  const [message, setMessage] = useState("");
  const [cropImageUrl, setCropImageUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [crop, setCrop] = useState({
    unit: "%",
    x: 20,
    y: 20,
    width: 40,
    height: 30,
  });
  const [completedCrop, setCompletedCrop] = useState(null); // ReactCrop crop in pixels
  const [patches, setPatches] = useState([]);
  const [placedPatches, setPlacedPatches] = useState([]); // { id, page, x, y, relWidth, relHeight, scaleX?, scaleY?, dataUrl }
  const [activePatchId, setActivePatchId] = useState(null);
  const [hoverPatchId, setHoverPatchId] = useState(null);
  const [hoverHandle, setHoverHandle] = useState(null);
  const dragStateRef = useRef(null); // { id, startClientX, startClientY, origX, origY, overlayRect }
  const [isErasing, setIsErasing] = useState(false);
  const [isColorPickMode, setIsColorPickMode] = useState(false);
  const [eraserColor, setEraserColor] = useState("#FFFFFF");
  const [eraseRegions, setEraseRegions] = useState([]); // { id, page, x, y, relWidth, relHeight, color }
  const eraseDragRef = useRef(false); // whether we're currently dragging in eraser mode
  const [eraserThickness, setEraserThickness] = useState(20); // brush diameter in px
  const eraseLastPointRef = useRef(null); // last brush position while dragging
  const eraserCursorRef = useRef(null); // DOM element for visual eraser cursor
  const translatedOverlayRef = useRef(null);
  const originalImgRef = useRef(null);
  const translatedCanvasRef = useRef(null);
  const [translatedPdfDoc, setTranslatedPdfDoc] = useState(null);
  const [translatedPage, setTranslatedPage] = useState(1);
  const [translatedNumPages, setTranslatedNumPages] = useState(1);

  useEffect(() => {
    // Auto-load current page image for cropping on mount or when page changes
    const imgUrl = token
      ? `${BACK_HOST}/api/preview/original-image/${processId}/${currentPage}?token=${encodeURIComponent(
          token,
        )}`
      : `${BACK_HOST}/api/preview/original-image/${processId}/${currentPage}`;
    setCropImageUrl(imgUrl);
    setMessage(
      `Original page ${currentPage} image loaded. Drag on the left page to select an area.`,
    );
  }, [processId, token, currentPage]);

  // Load translated PDF once for client-side page rendering
  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      try {
        const res = await fetch(translatedPdfPreviewUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const buffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;
        setTranslatedPdfDoc(pdf);
        setTranslatedNumPages(pdf.numPages || 1);
      } catch (error) {
        console.error("Error loading translated PDF for preview:", error);
      }
    };
    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [translatedPdfPreviewUrl, token]);

  // Render the current translated page into the canvas
  useEffect(() => {
    const renderPage = async () => {
      if (!translatedPdfDoc || !translatedCanvasRef.current) return;
      try {
        const pageIndex = Math.min(
          Math.max(translatedPage, 1),
          translatedNumPages,
        );
        const page = await translatedPdfDoc.getPage(pageIndex);
        const canvas = translatedCanvasRef.current;
        const context = canvas.getContext("2d");

        // Fit the translated page to the available width while preserving aspect ratio
        const initialViewport = page.getViewport({ scale: 1 });
        const container = canvas.parentElement;
        const containerWidth =
          (container && container.clientWidth) || initialViewport.width;
        const scale = containerWidth / initialViewport.width;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page
          .render({
            canvasContext: context,
            viewport,
          })
          .promise;
      } catch (error) {
        console.error("Error rendering translated page:", error);
      }
    };
    renderPage();
  }, [translatedPdfDoc, translatedPage, translatedNumPages]);

  const createPatchFromCrop = useCallback(async () => {
    if (!cropImageUrl || !completedCrop || !originalImgRef.current) return;
    try {
      const image = originalImgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const canvas = document.createElement("canvas");
      canvas.width = completedCrop.width;
      canvas.height = completedCrop.height;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height,
      );

      const dataUrl = canvas.toDataURL("image/png");
      const newPatch = {
        id: `patch-${patches.length + 1}`,
        page: 1,
        width: canvas.width,
        height: canvas.height,
        dataUrl,
      };

      setPatches((prev) => [...prev, newPatch]);
      setMessage("Patch created from original PDF.");
    } catch (error) {
      console.error("Error creating patch from crop:", error);
      setMessage("Error creating patch from crop. Check console for details.");
    }
  }, [cropImageUrl, completedCrop, patches.length]);

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
    if (isErasing) {
      // Update cursor preview position even when not dragging
      if (translatedOverlayRef.current) {
        const overlayRect =
          translatedOverlayRef.current.getBoundingClientRect();
        const x = (event.clientX - overlayRect.left) / overlayRect.width;
        const y = (event.clientY - overlayRect.top) / overlayRect.height;
        setEraserCursorPos({ x, y });
      }
      return;
    }

    if (isColorPickMode) return;
    const { active, over } = event;
    if (!over || over.id !== "translated-drop-area") return;

    const patch = active.data.current?.patch;
    if (!patch) return;

    const overRect = over.rect;
    const activeRect =
      active.rect.current.translated || active.rect.current.initial;

    // Compute the center of the dragged patch relative to the drop area
    const centerX = activeRect.left + activeRect.width / 2;
    const centerY = activeRect.top + activeRect.height / 2;

    let relX = (centerX - overRect.left) / overRect.width;
    let relY = (centerY - overRect.top) / overRect.height;

    // Approximate relative size based on crop size vs. viewer size
    let relWidth = patch.width / overRect.width;
    let relHeight = patch.height / overRect.height;

    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    relX = clamp01(relX);
    relY = clamp01(relY);
    relWidth = clamp01(relWidth);
    relHeight = clamp01(relHeight);

    const placedId = `${patch.id}-p${translatedPage}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const placed = {
      ...patch,
      id: placedId,
      page: translatedPage,
      x: relX,
      y: relY,
      relWidth,
      relHeight,
      // Independent scaling factors for width/height (default 1)
      scaleX: patch.scaleX ?? 1,
      scaleY: patch.scaleY ?? 1,
    };

    setPlacedPatches((prev) => [...prev, placed]);
    setActivePatchId(placedId);
    setMessage("Patch dropped on translated PDF.");
  };

  const handlePatchMouseDown = (patchId, event, forcedHandle = null) => {
    if (isErasing || isColorPickMode) return;
    event.preventDefault();
    event.stopPropagation();
    const overlayEl = translatedOverlayRef.current;
    if (!overlayEl) return;
    const overlayRect = overlayEl.getBoundingClientRect();
    const patch = placedPatches.find((p) => p.id === patchId);
    if (!patch) return;
    let handle = forcedHandle;
    if (!handle) {
      const patchRect = event.currentTarget.getBoundingClientRect();
      const edgeThreshold = 8;
      const nearLeft =
        Math.abs(event.clientX - patchRect.left) <= edgeThreshold;
      const nearRight =
        Math.abs(event.clientX - patchRect.right) <= edgeThreshold;
      const nearTop = Math.abs(event.clientY - patchRect.top) <= edgeThreshold;
      const nearBottom =
        Math.abs(event.clientY - patchRect.bottom) <= edgeThreshold;

      if (nearLeft && nearTop) handle = "nw";
      else if (nearRight && nearTop) handle = "ne";
      else if (nearLeft && nearBottom) handle = "sw";
      else if (nearRight && nearBottom) handle = "se";
      else if (nearLeft) handle = "w";
      else if (nearRight) handle = "e";
      else if (nearTop) handle = "n";
      else if (nearBottom) handle = "s";
    }

    setHoverPatchId(patchId);
    setHoverHandle(handle);

    if (!handle) {
      // Move mode (drag whole patch)
      dragStateRef.current = {
        mode: "move",
        id: patchId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        origX: patch.x,
        origY: patch.y,
        overlayRect,
      };
    } else {
      // Resize mode
      const relWidth = patch.relWidth;
      const relHeight = patch.relHeight;
      const origLeft = patch.x - relWidth / 2;
      const origRight = patch.x + relWidth / 2;
      const origTop = patch.y - relHeight / 2;
      const origBottom = patch.y + relHeight / 2;
      dragStateRef.current = {
        mode: "resize",
        id: patchId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        overlayRect,
        handle,
        origLeft,
        origRight,
        origTop,
        origBottom,
      };
    }
    setActivePatchId(patchId);
  };

  const handlePatchHover = (patchId, event) => {
    const patchRect = event.currentTarget.getBoundingClientRect();
    const edgeThreshold = 8;
    const nearLeft = Math.abs(event.clientX - patchRect.left) <= edgeThreshold;
    const nearRight =
      Math.abs(event.clientX - patchRect.right) <= edgeThreshold;
    const nearTop = Math.abs(event.clientY - patchRect.top) <= edgeThreshold;
    const nearBottom =
      Math.abs(event.clientY - patchRect.bottom) <= edgeThreshold;

    let handle = null;
    if (nearLeft && nearTop) handle = "nw";
    else if (nearRight && nearTop) handle = "ne";
    else if (nearLeft && nearBottom) handle = "sw";
    else if (nearRight && nearBottom) handle = "se";
    else if (nearLeft) handle = "w";
    else if (nearRight) handle = "e";
    else if (nearTop) handle = "n";
    else if (nearBottom) handle = "s";

    setHoverPatchId(patchId);
    setHoverHandle(handle);
  };

  const handleOverlayMouseDown = (event) => {
    if (!translatedOverlayRef.current) return;

    // Color-pick mode: sample color from the underlying translated canvas
    if (isColorPickMode && translatedCanvasRef.current) {
      event.preventDefault();
      const canvas = translatedCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
      const y = ((event.clientY - rect.top) * canvas.height) / rect.height;
      const ctx = canvas.getContext("2d");
      try {
        const data = ctx.getImageData(x, y, 1, 1).data;
        const toHex = (v) => v.toString(16).padStart(2, "0");
        const hex = `#${toHex(data[0])}${toHex(data[1])}${toHex(data[2])}`;
        setEraserColor(hex);
        setMessage(`Picked color ${hex} from translated page.`);
      } catch (err) {
        console.error("Error picking color from canvas:", err);
        setMessage("Could not pick color at this position.");
      }
      setIsColorPickMode(false);
      return;
    }

    // Eraser mode: start freehand drawing on the overlay
    if (isErasing) {
      event.preventDefault();
      eraseDragRef.current = true;

      const overlayRect = translatedOverlayRef.current.getBoundingClientRect();
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const xNorm = clamp01(
        (event.clientX - overlayRect.left) / overlayRect.width,
      );
      const yNorm = clamp01(
        (event.clientY - overlayRect.top) / overlayRect.height,
      );
      if (eraserCursorRef.current) {
        eraserCursorRef.current.style.left = `${xNorm * 100}%`;
        eraserCursorRef.current.style.top = `${yNorm * 100}%`;
      }
      eraseLastPointRef.current = { x: xNorm, y: yNorm };

      // First dab at mouse-down
      const brushWidth = eraserThickness / overlayRect.width;
      const brushHeight = eraserThickness / overlayRect.height;
      const id = `erase-${translatedPage}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      setEraseRegions((prev) => [
        ...prev,
        {
          id,
          page: translatedPage,
          x: xNorm,
          y: yNorm,
          relWidth: brushWidth,
          relHeight: brushHeight,
          color: eraserColor,
        },
      ]);
      return;
    }
  };

  const handleOverlayMouseMove = (event) => {
    // Eraser mode: cursor should always follow the mouse; if dragging, also paint
    if (isErasing && translatedOverlayRef.current) {
      const overlayRect = translatedOverlayRef.current.getBoundingClientRect();
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const xNorm = clamp01(
        (event.clientX - overlayRect.left) / overlayRect.width,
      );
      const yNorm = clamp01(
        (event.clientY - overlayRect.top) / overlayRect.height,
      );
      if (eraserCursorRef.current) {
        eraserCursorRef.current.style.left = `${xNorm * 100}%`;
        eraserCursorRef.current.style.top = `${yNorm * 100}%`;
      }

      // While dragging in eraser mode, add small "brush" regions along the path.
      // Throttle by distance so we don't add too many and overload React.
      if (eraseDragRef.current && event.buttons === 1) {
        const last = eraseLastPointRef.current;
        const dx = last ? xNorm - last.x : 0;
        const dy = last ? yNorm - last.y : 0;
        const distSq = dx * dx + dy * dy;
        const MIN_DIST_SQ = 0.0002; // ~1.4% of page diagonal
        if (last && distSq < MIN_DIST_SQ) {
          return;
        }

        const brushWidth = eraserThickness / overlayRect.width;
        const brushHeight = eraserThickness / overlayRect.height;
        const id = `erase-${translatedPage}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        setEraseRegions((prev) => [
          ...prev,
          {
            id,
            page: translatedPage,
            x: xNorm,
            y: yNorm,
            relWidth: brushWidth,
            relHeight: brushHeight,
            color: eraserColor,
          },
        ]);
        eraseLastPointRef.current = { x: xNorm, y: yNorm };
      }
      return;
    }

    if (isColorPickMode) return;

    const state = dragStateRef.current;
    if (!state) return;
    const dx = event.clientX - state.startClientX;
    const dy = event.clientY - state.startClientY;

    const clamp01 = (v) => Math.max(0, Math.min(1, v));

    if (state.mode === "move") {
      const { id, origX, origY, overlayRect } = state;
      const relDx = dx / overlayRect.width;
      const relDy = dy / overlayRect.height;

      setPlacedPatches((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                x: clamp01(origX + relDx),
                y: clamp01(origY + relDy),
              }
            : p,
        ),
      );
    } else if (state.mode === "resize") {
      const {
        id,
        overlayRect,
        handle,
        origLeft,
        origRight,
        origTop,
        origBottom,
      } = state;
      const dRelX = dx / overlayRect.width;
      const dRelY = dy / overlayRect.height;

      let newLeft = origLeft;
      let newRight = origRight;
      let newTop = origTop;
      let newBottom = origBottom;

      if (handle.includes("e")) newRight = origRight + dRelX;
      if (handle.includes("w")) newLeft = origLeft + dRelX;
      if (handle.includes("s")) newBottom = origBottom + dRelY;
      if (handle.includes("n")) newTop = origTop + dRelY;

      newLeft = clamp01(newLeft);
      newRight = clamp01(newRight);
      newTop = clamp01(newTop);
      newBottom = clamp01(newBottom);

      const minSize = 0.01;
      if (newRight - newLeft < minSize) {
        if (handle.includes("e")) newRight = newLeft + minSize;
        else if (handle.includes("w")) newLeft = newRight - minSize;
      }
      if (newBottom - newTop < minSize) {
        if (handle.includes("s")) newBottom = newTop + minSize;
        else if (handle.includes("n")) newTop = newBottom - minSize;
      }

      const newWidth = newRight - newLeft;
      const newHeight = newBottom - newTop;
      const newCenterX = (newLeft + newRight) / 2;
      const newCenterY = (newTop + newBottom) / 2;

      setPlacedPatches((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                x: clamp01(newCenterX),
                y: clamp01(newCenterY),
                relWidth: clamp01(newWidth),
                relHeight: clamp01(newHeight),
              }
            : p,
        ),
      );
    }
  };

  const handleOverlayMouseUp = () => {
    dragStateRef.current = null;
    setHoverPatchId(null);
    setHoverHandle(null);
    if (isErasing && eraseDragRef.current) {
      eraseDragRef.current = false;
      eraseLastPointRef.current = null;
    }
  };

  const handleDownloadMerged = async () => {
    try {
      setMessage("Generating merged PDF in browser...");

      const res = await fetch(translatedPdfCleanUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch translated PDF (${res.status})`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      // First, draw erase regions (colored rectangles) so patches can sit on top
      for (const region of eraseRegions) {
        const pageIndex = (region.page || 1) - 1;
        const page = pages[pageIndex];
        if (!page) continue;

        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const width = region.relWidth * pageWidth;
        const height = region.relHeight * pageHeight;
        const centerX = region.x * pageWidth;
        const centerYFromTop = region.y * pageHeight;
        const x = centerX - width / 2;
        const y = pageHeight - centerYFromTop - height / 2;

        const colorHex = (region.color || "#FFFFFF").replace("#", "");
        const r = parseInt(colorHex.slice(0, 2), 16) / 255;
        const g = parseInt(colorHex.slice(2, 4), 16) / 255;
        const b = parseInt(colorHex.slice(4, 6), 16) / 255;

        page.drawRectangle({
          x,
          y,
          width,
          height,
          color: rgb(r, g, b),
        });
      }

      // Then, draw image patches on top
      for (const patch of placedPatches) {
        const pageIndex = (patch.page || 1) - 1;
        const page = pages[pageIndex];
        if (!page) continue;

        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const scaleX = patch.scaleX || 1;
        const scaleY = patch.scaleY || 1;
        const width = patch.relWidth * scaleX * pageWidth;
        const height = patch.relHeight * scaleY * pageHeight;

        // Our on-screen overlay stores patch.x / patch.y as the CENTER of the patch
        // (we render with left/top at x,y and translate(-50%, -50%)).
        // Convert this center-based coordinate into the bottom-left origin
        // that pdf-lib expects, adjusting by half the width/height.
        const centerX = patch.x * pageWidth;
        const centerYFromTop = patch.y * pageHeight;
        const x = centerX - width / 2;
        const y = pageHeight - centerYFromTop - height / 2;

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Original PDF viewer with crop overlay and page navigation */}
            <div className="border rounded-lg flex flex-col">
              <div className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span>
                  Original PDF – page {currentPage} (drag to select a region)
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => (p > 1 ? p - 1 : 1))
                    }
                    className="px-2 py-0.5 border rounded disabled:opacity-40"
                    disabled={currentPage <= 1}
                  >
                    Prev
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={currentPage}
                    onChange={(e) => {
                      const v = parseInt(e.target.value || "1", 10);
                      setCurrentPage(isNaN(v) || v < 1 ? 1 : v);
                    }}
                    className="w-12 border rounded px-1 py-0.5 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-2 py-0.5 border rounded"
                  >
                    Next
                  </button>
                </div>
              </div>
              <div className="relative flex-1 bg-gray-50 flex items-center justify-center">
                {cropImageUrl ? (
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    keepSelection
                    ruleOfThirds={false}
                    className="w-full flex justify-center"
                  >
                    <img
                      ref={originalImgRef}
                      src={cropImageUrl}
                      alt="Original page 1"
                      crossOrigin="anonymous"
                      className="w-full h-auto"
                    />
                  </ReactCrop>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-gray-500 px-2">
                    Loading original page image...
                  </div>
                )}
              </div>
              <div className="p-2 border-t border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Crop an area on the image above, then create a draggable patch.
                </div>
                <button
                  onClick={createPatchFromCrop}
                  disabled={!cropImageUrl || !completedCrop}
                  className="px-2 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-40"
                >
                  Create patch from crop
                </button>
              </div>
            </div>

            {/* Right: Translated PDF viewer (single page) + drop area + patch editor */}
            <div className="border rounded-lg flex flex-col">
              <div className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span>
                  Translated PDF – page {translatedPage} (drop patches on this
                  page)
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setTranslatedPage((p) => (p > 1 ? p - 1 : 1))
                    }
                    className="px-2 py-0.5 border rounded disabled:opacity-40"
                    disabled={translatedPage <= 1}
                  >
                    Prev
                  </button>
                  <span>
                    {translatedPage} / {translatedNumPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setTranslatedPage((p) =>
                        p < translatedNumPages ? p + 1 : p,
                      )
                    }
                    className="px-2 py-0.5 border rounded disabled:opacity-40"
                    disabled={translatedPage >= translatedNumPages}
                  >
                    Next
                  </button>
                </div>
              </div>
              <div className="relative flex-1 bg-gray-50 flex items-center justify-center">
                <div className="relative w-full flex justify-center">
                  <canvas
                    ref={translatedCanvasRef}
                    className="block bg-white w-full h-auto"
                  />
                  {/* Drop & overlay area over current page canvas */}
                  <div
                    ref={translatedOverlayRef}
                    className="absolute inset-0"
                    onMouseDown={handleOverlayMouseDown}
                    onMouseMove={handleOverlayMouseMove}
                    onMouseUp={handleOverlayMouseUp}
                    onMouseLeave={handleOverlayMouseUp}
                    style={{
                      cursor: isErasing ? "none" : isColorPickMode ? "crosshair" : "default",
                    }}
                  >
                    {/* Erase regions (visual overlay as freehand brush dabs) */}
                    {eraseRegions
                      .filter((r) => r.page === translatedPage)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="absolute pointer-events-none"
                          style={{
                            left: `${r.x * 100}%`,
                            top: `${r.y * 100}%`,
                            width: `${r.relWidth * 100}%`,
                            height: `${r.relHeight * 100}%`,
                            transform: "translate(-50%, -50%)",
                            backgroundColor: r.color || "#FFFFFF",
                            opacity: 0.95,
                            borderRadius: "9999px",
                          }}
                        />
                      ))}
                    {/* Eraser cursor preview (DOM-controlled for performance) */}
                    {isErasing && (
                      <div
                        ref={eraserCursorRef}
                        className="absolute pointer-events-none border-2 border-red-500 bg-red-200 bg-opacity-40 rounded-full"
                        style={{
                          left: "50%",
                          top: "50%",
                          width: `${eraserThickness}px`,
                          height: `${eraserThickness}px`,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                    )}
                    {placedPatches
                      .filter((p) => p.page === translatedPage)
                      .map((p) => {
                        const isHover = hoverPatchId === p.id;
                        const handle = isHover ? hoverHandle : null;
                        let cursor = "move";
                        if (handle === "n" || handle === "s") cursor = "ns-resize";
                        else if (handle === "e" || handle === "w")
                          cursor = "ew-resize";
                        else if (handle === "ne" || handle === "sw")
                          cursor = "nesw-resize";
                        else if (handle === "nw" || handle === "se")
                          cursor = "nwse-resize";

                        const commonStyle = {
                          left: `${p.x * 100}%`,
                          top: `${p.y * 100}%`,
                          width: `${p.relWidth * (p.scaleX || 1) * 100}%`,
                          height: `${p.relHeight * (p.scaleY || 1) * 100}%`,
                          transform: "translate(-50%, -50%)",
                        };

                        return (
                          <div
                            key={p.id}
                            className="absolute"
                            style={commonStyle}
                            onMouseDown={(e) => handlePatchMouseDown(p.id, e)}
                            onMouseMove={(e) => handlePatchHover(p.id, e)}
                            onMouseLeave={() => {
                              if (hoverPatchId === p.id) {
                                setHoverPatchId(null);
                                setHoverHandle(null);
                              }
                            }}
                          >
                            <img
                              src={p.dataUrl}
                              alt={`Placed ${p.id}`}
                              className="w-full h-full object-contain border border-red-500"
                              style={{
                                boxShadow:
                                  p.id === activePatchId
                                    ? "0 0 0 2px rgba(59,130,246,0.8)"
                                    : undefined,
                                cursor,
                              }}
                              draggable={false}
                            />
                            {/* Corner resize handles */}
                            {[
                              { pos: "nw", style: { top: -6, left: -6 } },
                              { pos: "ne", style: { top: -6, right: -6 } },
                              { pos: "sw", style: { bottom: -6, left: -6 } },
                              { pos: "se", style: { bottom: -6, right: -6 } },
                            ].map((h) => (
                              <div
                                key={h.pos}
                                className="absolute w-3 h-3 rounded-full bg-white border border-blue-500"
                                style={{
                                  ...h.style,
                                  cursor:
                                    h.pos === "nw" || h.pos === "se"
                                      ? "nwse-resize"
                                      : "nesw-resize",
                                }}
                                onMouseDown={(e) =>
                                  handlePatchMouseDown(p.id, e, h.pos)
                                }
                              />
                            ))}
                          </div>
                        );
                      })}
                    <TranslatedDropArea />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Patch palette */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-2 bg-gray-50">
              <div className="text-sm font-semibold text-gray-700 mb-1">
                Patches (drag onto translated PDF):
              </div>
              <div className="flex flex-wrap">
                {patches.length === 0 && (
                  <div className="text-xs text-gray-500">
                    No patches yet. Crop an area from the original to create
                    one.
                  </div>
                )}
                {patches.map((p) => (
                  <DraggablePatch key={p.id} patch={p} />
                ))}
              </div>
            </div>

            {/* Eraser tools */}
            <div className="border rounded-lg p-2 bg-gray-50">
              <div className="text-sm font-semibold text-gray-700 mb-1">
                Eraser (cover translated content):
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-700">
                <button
                  type="button"
                  className={`px-2 py-1 border rounded ${
                    isErasing
                      ? "bg-red-600 text-white border-red-600"
                      : "border-red-400 text-red-600 hover:bg-red-50"
                  }`}
                  onClick={() => {
                    setIsErasing((prev) => {
                      const next = !prev;
                      if (next) {
                        // Initialize eraser cursor roughly at the center of the page
                        if (eraserCursorRef.current) {
                          eraserCursorRef.current.style.left = "50%";
                          eraserCursorRef.current.style.top = "50%";
                        }
                        eraseLastPointRef.current = null;
                      } else {
                        if (eraserCursorRef.current) {
                          eraserCursorRef.current.style.left = "-9999px";
                          eraserCursorRef.current.style.top = "-9999px";
                        }
                        eraseLastPointRef.current = null;
                      }
                      return next;
                    });
                    setIsColorPickMode(false);
                    setMessage(
                      !isErasing
                        ? "Eraser mode: drag on translated page to cover content."
                        : "",
                    );
                  }}
                >
                  {isErasing ? "Eraser ON" : "Eraser OFF"}
                </button>
                <label className="flex items-center gap-1">
                  <span>Thickness</span>
                  <input
                    type="range"
                    min={6}
                    max={80}
                    step={2}
                    value={eraserThickness}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setEraserThickness(isNaN(v) ? 20 : v);
                    }}
                  />
                  <span>{Math.round(eraserThickness)}px</span>
                </label>
                <label className="flex items-center gap-1">
                  <span>Color</span>
                  <input
                    type="color"
                    value={eraserColor}
                    onChange={(e) => setEraserColor(e.target.value)}
                    className="w-8 h-6 p-0 border rounded"
                  />
                </label>
                <button
                  type="button"
                  className={`px-2 py-1 border rounded ${
                    isColorPickMode
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-blue-400 text-blue-600 hover:bg-blue-50"
                  }`}
                  onClick={() => {
                    setIsColorPickMode((prev) => !prev);
                    setIsErasing(false);
                    setMessage(
                      !isColorPickMode
                        ? "Click on translated page to pick a color."
                        : "",
                    );
                  }}
                >
                  Pick color from page
                </button>
              </div>
            </div>
          </div>

          {/* Scale + download controls */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-gray-600">
              {activePatchId ? (
                <>
                  <span>Selected patch:</span>
                  {/* Page selector for the active patch */}
                  <label className="flex items-center gap-1">
                    <span>Page</span>
                    <input
                      type="number"
                      min={1}
                      value={
                        placedPatches.find((p) => p.id === activePatchId)
                          ?.page || 1
                      }
                      onChange={(e) => {
                        const value = parseInt(e.target.value || "1", 10);
                        const page = isNaN(value) || value < 1 ? 1 : value;
                        setPlacedPatches((prev) =>
                          prev.map((p) =>
                            p.id === activePatchId ? { ...p, page } : p,
                          ),
                        );
                      }}
                      className="w-12 border rounded px-1 py-0.5 text-center"
                    />
                  </label>
                  {/* Width slider for the active patch */}
                  <span>Width</span>
                  <input
                    type="range"
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={
                      placedPatches.find((p) => p.id === activePatchId)
                        ?.scaleX || 1
                    }
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setPlacedPatches((prev) =>
                        prev.map((p) =>
                          p.id === activePatchId
                            ? { ...p, scaleX: value }
                            : p,
                        ),
                      );
                    }}
                  />
                  {/* Height slider for the active patch */}
                  <span>Height</span>
                  <input
                    type="range"
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={
                      placedPatches.find((p) => p.id === activePatchId)
                        ?.scaleY || 1
                    }
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setPlacedPatches((prev) =>
                        prev.map((p) =>
                          p.id === activePatchId
                            ? { ...p, scaleY: value }
                            : p,
                        ),
                      );
                    }}
                  />
                  {/* Delete active patch */}
                  <button
                    type="button"
                    className="ml-2 px-2 py-1 border rounded text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => {
                      setPlacedPatches((prev) =>
                        prev.filter((p) => p.id !== activePatchId),
                      );
                      setActivePatchId(null);
                    }}
                  >
                    Delete
                  </button>
                </>
              ) : (
                <span>Select a placed patch to adjust its size.</span>
              )}
            </div>
            <button
              onClick={handleDownloadMerged}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Download merged translated PDF
            </button>
          </div>
        </DndContext>
      </main>
    </ProtectedRoute>
  );
}


