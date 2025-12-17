'use client';

import { use, useEffect, useState, useCallback, useRef } from "react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { BACK_HOST } from "@/lib/constants";
import { useAuth } from "../../../context/AuthContext";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ReactCrop from "react-image-crop";
import { DndContext, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import {
  Crop,
  PlusSquare,
  Eraser as EraserIcon,
  Droplet,
  SquareDashedMousePointer as SelectionIcon,
  Type as TypeIcon,
  Table as TableIcon,
  Undo2,
  Redo2,
  X as CloseIcon,
} from "lucide-react";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "react-image-crop/dist/ReactCrop.css";

// Configure pdf.js worker for client-side rendering of translated PDF pages
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js";
}

const hexToRgb = (hex, fallback = { r: 1, g: 1, b: 1 }) => {
  if (!hex) return fallback;
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return fallback;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return fallback;
  return { r: r / 255, g: g / 255, b: b / 255 };
};

const cloneDeep = (value) => {
  if (value === undefined) return undefined;
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
  } catch (err) {
    // Fallback to JSON path below
  }
  return JSON.parse(JSON.stringify(value));
};

const MAX_HISTORY = 75;

const IconButton = ({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={`h-11 w-11 flex items-center justify-center rounded border text-sm transition
      ${
        disabled
          ? "opacity-30 cursor-not-allowed border-gray-200"
          : active
            ? "bg-blue-600 text-white border-blue-600 shadow-inner"
            : "border-gray-300 text-gray-600 hover:bg-gray-100"
      }`}
  >
    <Icon className="h-4 w-4" />
  </button>
);

function DraggablePatch({ patch }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: patch.id,
    data: { patch },
  });

  const style = {
    opacity: isDragging ? 0.3 : 1,
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
  const [placedPatches, setPlacedPatches] = useState([]); // { id, page, x, y, relWidth, relHeight, scaleX?, scaleY?, dataUrl, createdAt }
  const [textBoxes, setTextBoxes] = useState([]); // { id, page, x, y, relWidth, relHeight, text, fontSize, color, align, createdAt }
  const [tables, setTables] = useState([]); // { id, page, x, y, relWidth, relHeight, rows, columns, borderColor, borderWidth, createdAt }
  const [activePatchId, setActivePatchId] = useState(null);
  const [activeTextBoxId, setActiveTextBoxId] = useState(null);
  const [activeTableId, setActiveTableId] = useState(null);
  const [hoverElement, setHoverElement] = useState(null); // { type, id }
  const [hoverHandle, setHoverHandle] = useState(null);
  const dragStateRef = useRef(null); // { type, id, startClientX, startClientY, origX, origY, overlayRect }
  const [isErasing, setIsErasing] = useState(false);
  const [isColorPickMode, setIsColorPickMode] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionRect, setSelectionRect] = useState(null); // { page, left, top, width, height }
  const selectionStartRef = useRef(null);
  const MIN_SELECTION_SIZE = 0.01;
  const [eraserColor, setEraserColor] = useState("#FFFFFF");
  const [eraseRegions, setEraseRegions] = useState([]); // { id, page, x, y, relWidth, relHeight, color, shape?, createdAt }
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
  const [history, setHistory] = useState(() => ({
    stack: [
      {
        label: "initial",
        placedPatches: [],
        textBoxes: [],
        tables: [],
        eraseRegions: [],
      },
    ],
    pointer: 0,
  }));
  const [historyTick, setHistoryTick] = useState(0);
  const [activeDragPatch, setActiveDragPatch] = useState(null);
  const historyPendingRef = useRef(null);
  const isRestoringRef = useRef(false);
  const pendingEraserStrokeRef = useRef(false);
  const requestHistorySnapshot = useCallback(
    (label = "edit", forceCommit = false) => {
      if (isRestoringRef.current) return;
      historyPendingRef.current = label;
      if (forceCommit) {
        setHistoryTick((tick) => tick + 1);
      }
    },
    [],
  );
  useEffect(() => {
    if (isRestoringRef.current) {
      historyPendingRef.current = null;
      return;
    }
    if (!historyPendingRef.current) return;
    const label = historyPendingRef.current;
    historyPendingRef.current = null;
    const snapshot = {
      label,
      placedPatches: cloneDeep(placedPatches),
      textBoxes: cloneDeep(textBoxes),
      tables: cloneDeep(tables),
      eraseRegions: cloneDeep(eraseRegions),
    };
    setHistory((prev) => {
      const baseStack =
        prev.pointer < prev.stack.length - 1
          ? prev.stack.slice(0, prev.pointer + 1)
          : prev.stack;
      let stack = [...baseStack, snapshot];
      if (stack.length > MAX_HISTORY) {
        stack = stack.slice(stack.length - MAX_HISTORY);
      }
      return {
        stack,
        pointer: stack.length - 1,
      };
    });
  }, [placedPatches, textBoxes, tables, eraseRegions, historyTick]);

  const confirmRemoval = useCallback((message, action) => {
    if (typeof window === "undefined") {
      action();
      return true;
    }
    if (window.confirm(message)) {
      action();
      return true;
    }
    return false;
  }, []);

  const handleRemovePatch = useCallback(
    (id) => {
      setPlacedPatches((prev) => prev.filter((patch) => patch.id !== id));
      setActivePatchId((current) => (current === id ? null : current));
      setMessage("Patch removed.");
      requestHistorySnapshot("patch-delete");
    },
    [setPlacedPatches, setActivePatchId, setMessage, requestHistorySnapshot],
  );

  const handleRemoveTextBox = useCallback(
    (id) => {
      setTextBoxes((prev) => prev.filter((box) => box.id !== id));
      setActiveTextBoxId((current) => (current === id ? null : current));
      setMessage("Text box removed.");
      requestHistorySnapshot("text-delete");
    },
    [setTextBoxes, setActiveTextBoxId, setMessage, requestHistorySnapshot],
  );

  const handleRemoveTable = useCallback(
    (id) => {
      setTables((prev) => prev.filter((table) => table.id !== id));
      setActiveTableId((current) => (current === id ? null : current));
      setMessage("Table removed.");
      requestHistorySnapshot("table-delete");
    },
    [setTables, setActiveTableId, setMessage, requestHistorySnapshot],
  );

  const canUndo = history.pointer > 0;
  const canRedo = history.pointer < history.stack.length - 1;
  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.pointer <= 0) return prev;
      const target = prev.stack[prev.pointer - 1];
      isRestoringRef.current = true;
      setPlacedPatches(cloneDeep(target.placedPatches));
      setTextBoxes(cloneDeep(target.textBoxes));
      setTables(cloneDeep(target.tables || []));
      setEraseRegions(cloneDeep(target.eraseRegions));
      setActivePatchId(null);
      setActiveTextBoxId(null);
      setActiveTableId(null);
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
      return { ...prev, pointer: prev.pointer - 1 };
    });
  }, [
    setPlacedPatches,
    setTextBoxes,
    setTables,
    setEraseRegions,
    setActivePatchId,
    setActiveTextBoxId,
    setActiveTableId,
  ]);
  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (prev.pointer >= prev.stack.length - 1) return prev;
      const target = prev.stack[prev.pointer + 1];
      isRestoringRef.current = true;
      setPlacedPatches(cloneDeep(target.placedPatches));
      setTextBoxes(cloneDeep(target.textBoxes));
      setTables(cloneDeep(target.tables || []));
      setEraseRegions(cloneDeep(target.eraseRegions));
      setActivePatchId(null);
      setActiveTextBoxId(null);
      setActiveTableId(null);
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
      return { ...prev, pointer: prev.pointer + 1 };
    });
  }, [
    setPlacedPatches,
    setTextBoxes,
    setTables,
    setEraseRegions,
    setActivePatchId,
    setActiveTextBoxId,
    setActiveTableId,
  ]);
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
        if (!context) return;

        // Fit the translated page to the available width while preserving aspect ratio
        const initialViewport = page.getViewport({ scale: 1 });
        const container = canvas.parentElement;
        const containerWidth =
          (container && container.clientWidth) || initialViewport.width;
        const scale = containerWidth / initialViewport.width;
        const viewport = page.getViewport({ scale });
        const outputScale =
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

        const renderWidth = Math.floor(viewport.width * outputScale);
        const renderHeight = Math.floor(viewport.height * outputScale);
        canvas.width = renderWidth;
        canvas.height = renderHeight;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, renderWidth, renderHeight);

        await page
          .render({
            canvasContext: context,
            viewport,
            transform:
              outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : undefined,
          })
          .promise;
      } catch (error) {
        console.error("Error rendering translated page:", error);
      }
    };
    renderPage();
  }, [translatedPdfDoc, translatedPage, translatedNumPages]);

  const [removePatchBackground, setRemovePatchBackground] = useState(false);

  const createPatchFromCrop = useCallback(async () => {
    if (!cropImageUrl || !completedCrop || !originalImgRef.current) return;
    try {
      const image = originalImgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const sourceWidth = Math.max(
        1,
        Math.round(completedCrop.width * scaleX),
      );
      const sourceHeight = Math.max(
        1,
        Math.round(completedCrop.height * scaleY),
      );

      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight,
      );

      // Optional simple background removal: make near-white pixels transparent
      if (removePatchBackground) {
        const imageData = ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const data = imageData.data;
        const threshold = 245; // 0-255; higher = more aggressive
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Treat pixels that are very close to pure white as background
          if (r >= threshold && g >= threshold && b >= threshold) {
            data[i + 3] = 0; // alpha
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }

      const dataUrl = canvas.toDataURL("image/png");
      const newPatch = {
        id: `patch-${patches.length + 1}`,
        page: currentPage,
        width: completedCrop.width,
        height: completedCrop.height,
        bitmapWidth: canvas.width,
        bitmapHeight: canvas.height,
        dataUrl,
        createdAt: Date.now(),
      };

      setPatches((prev) => [...prev, newPatch]);
      setMessage("Patch created from original PDF.");
      setCompletedCrop(null);
      setIsCropMode(false);
    } catch (error) {
      console.error("Error creating patch from crop:", error);
      setMessage("Error creating patch from crop. Check console for details.");
    }
  }, [
    cropImageUrl,
    completedCrop,
    currentPage,
    patches.length,
    removePatchBackground,
    setIsCropMode,
  ]);

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

  const handleToggleCropMode = useCallback(() => {
    setIsCropMode((prev) => {
      const next = !prev;
      if (!next) {
        setCompletedCrop(null);
      } else {
        setMessage(
          "Crop mode enabled. Drag on the original page to pick an area, then click Create patch.",
        );
      }
      return next;
    });
  }, [setMessage]);

  const handleDragStart = useCallback((event) => {
    const patch = event.active.data.current?.patch;
    if (patch) {
      setActiveDragPatch(patch);
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDragPatch(null);
  }, []);

  const handleDragEnd = (event) => {
    setActiveDragPatch(null);
    if (isErasing) {
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
      createdAt: Date.now(),
    };

    setPlacedPatches((prev) => [...prev, placed]);
    setActivePatchId(placedId);
    setActiveTextBoxId(null);
    setActiveTableId(null);
    setMessage("Patch dropped on translated PDF.");
  };

  const handleElementMouseDown = (type, elementId, event, forcedHandle = null) => {
    // Disable direct manipulation when other tools need pointer capture.
    if (isErasing || isColorPickMode || isSelectionMode) return;
    event.preventDefault();
    event.stopPropagation();
    const overlayEl = translatedOverlayRef.current;
    if (!overlayEl) return;
    const overlayRect = overlayEl.getBoundingClientRect();
    const collection =
      type === "patch" ? placedPatches : type === "text" ? textBoxes : tables;
    const element = collection.find((entry) => entry.id === elementId);
    if (!element) return;

    let handle = forcedHandle;
    if (!handle) {
      const elementRect = event.currentTarget.getBoundingClientRect();
      const edgeThreshold = 8;
      const nearLeft = Math.abs(event.clientX - elementRect.left) <= edgeThreshold;
      const nearRight = Math.abs(event.clientX - elementRect.right) <= edgeThreshold;
      const nearTop = Math.abs(event.clientY - elementRect.top) <= edgeThreshold;
      const nearBottom = Math.abs(event.clientY - elementRect.bottom) <= edgeThreshold;

      if (nearLeft && nearTop) handle = "nw";
      else if (nearRight && nearTop) handle = "ne";
      else if (nearLeft && nearBottom) handle = "sw";
      else if (nearRight && nearBottom) handle = "se";
      else if (nearLeft) handle = "w";
      else if (nearRight) handle = "e";
      else if (nearTop) handle = "n";
      else if (nearBottom) handle = "s";
    }

    setHoverElement({ type, id: elementId });
    setHoverHandle(handle);

    if (!handle) {
      dragStateRef.current = {
        mode: "move",
        type,
        id: elementId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        origX: element.x,
        origY: element.y,
        overlayRect,
      };
    } else {
      const relWidth = element.relWidth;
      const relHeight = element.relHeight;
      const origLeft = element.x - relWidth / 2;
      const origRight = element.x + relWidth / 2;
      const origTop = element.y - relHeight / 2;
      const origBottom = element.y + relHeight / 2;
      dragStateRef.current = {
        mode: "resize",
        type,
        id: elementId,
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

    if (type === "patch") {
      setActivePatchId(elementId);
      setActiveTextBoxId(null);
      setActiveTableId(null);
    } else if (type === "text") {
      setActiveTextBoxId(elementId);
      setActivePatchId(null);
      setActiveTableId(null);
    } else {
      setActiveTableId(elementId);
      setActivePatchId(null);
      setActiveTextBoxId(null);
    }
  };

  const handleElementHover = (type, elementId, event) => {
    const elementRect = event.currentTarget.getBoundingClientRect();
    const edgeThreshold = 8;
    const nearLeft = Math.abs(event.clientX - elementRect.left) <= edgeThreshold;
    const nearRight = Math.abs(event.clientX - elementRect.right) <= edgeThreshold;
    const nearTop = Math.abs(event.clientY - elementRect.top) <= edgeThreshold;
    const nearBottom = Math.abs(event.clientY - elementRect.bottom) <= edgeThreshold;

    let handle = null;
    if (nearLeft && nearTop) handle = "nw";
    else if (nearRight && nearTop) handle = "ne";
    else if (nearLeft && nearBottom) handle = "sw";
    else if (nearRight && nearBottom) handle = "se";
    else if (nearLeft) handle = "w";
    else if (nearRight) handle = "e";
    else if (nearTop) handle = "n";
    else if (nearBottom) handle = "s";

    setHoverElement({ type, id: elementId });
    setHoverHandle(handle);
  };

  const handleOverlayMouseDown = (event) => {
    if (!translatedOverlayRef.current) return;

    if (isSelectionMode) {
      event.preventDefault();
      const overlayRect = translatedOverlayRef.current.getBoundingClientRect();
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const xNorm = clamp01(
        (event.clientX - overlayRect.left) / overlayRect.width,
      );
      const yNorm = clamp01(
        (event.clientY - overlayRect.top) / overlayRect.height,
      );
      if (
        selectionRect &&
        selectionRect.page === translatedPage &&
        !selectionStartRef.current
      ) {
        const withinX =
          xNorm >= selectionRect.left &&
          xNorm <= selectionRect.left + selectionRect.width;
        const withinY =
          yNorm >= selectionRect.top &&
          yNorm <= selectionRect.top + selectionRect.height;
        if (withinX && withinY) {
          handleSelectionMouseDown(event);
          return;
        }
      }
      selectionStartRef.current = { x: xNorm, y: yNorm };
      setSelectionRect({
        page: translatedPage,
        left: xNorm,
        top: yNorm,
        width: 0,
        height: 0,
      });
      return;
    }

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
          shape: "brush",
          createdAt: Date.now(),
        },
      ]);
      pendingEraserStrokeRef.current = true;
      return;
    }
  };

  const handleOverlayMouseMove = (event) => {
    if (
      isSelectionMode &&
      translatedOverlayRef.current &&
      selectionStartRef.current
    ) {
      const overlayRect = translatedOverlayRef.current.getBoundingClientRect();
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const xNorm = clamp01(
        (event.clientX - overlayRect.left) / overlayRect.width,
      );
      const yNorm = clamp01(
        (event.clientY - overlayRect.top) / overlayRect.height,
      );
      const start = selectionStartRef.current;
      const left = Math.min(start.x, xNorm);
      const top = Math.min(start.y, yNorm);
      const width = Math.abs(start.x - xNorm);
      const height = Math.abs(start.y - yNorm);
      setSelectionRect({
        page: translatedPage,
        left,
        top,
        width,
        height,
      });
      return;
    }

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
            shape: "brush",
            createdAt: Date.now(),
          },
        ]);
        pendingEraserStrokeRef.current = true;
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

    if (state.type === "selection") {
      if (!selectionRect) return;
      const relDx = dx / state.overlayRect.width;
      const relDy = dy / state.overlayRect.height;
      if (state.mode === "move") {
        const width = state.width ?? selectionRect.width;
        const height = state.height ?? selectionRect.height;
        let newLeft = clamp01(state.origLeft + relDx);
        let newTop = clamp01(state.origTop + relDy);
        newLeft = Math.min(Math.max(0, newLeft), 1 - width);
        newTop = Math.min(Math.max(0, newTop), 1 - height);
        setSelectionRect((prev) =>
          prev
            ? {
                ...prev,
                left: newLeft,
                top: newTop,
              }
            : prev,
        );
      } else if (state.mode === "resize") {
        const minSize = MIN_SELECTION_SIZE;
        let newLeft = state.origLeft;
        let newTop = state.origTop;
        let newWidth = state.origWidth;
        let newHeight = state.origHeight;
        if (state.handle.includes("e")) {
          newWidth = Math.max(minSize, state.origWidth + relDx);
        }
        if (state.handle.includes("s")) {
          newHeight = Math.max(minSize, state.origHeight + relDy);
        }
        if (state.handle.includes("w")) {
          const delta = Math.min(relDx, state.origWidth - minSize);
          newWidth = Math.max(minSize, state.origWidth - delta);
          newLeft = clamp01(state.origLeft + delta);
        }
        if (state.handle.includes("n")) {
          const delta = Math.min(relDy, state.origHeight - minSize);
          newHeight = Math.max(minSize, state.origHeight - delta);
          newTop = clamp01(state.origTop + delta);
        }
        const maxLeft = 1 - minSize;
        newLeft = Math.min(Math.max(0, newLeft), maxLeft);
        const maxWidth = 1 - newLeft;
        newWidth = Math.min(Math.max(minSize, newWidth), maxWidth);
        const maxTop = 1 - minSize;
        newTop = Math.min(Math.max(0, newTop), maxTop);
        const maxHeight = 1 - newTop;
        newHeight = Math.min(Math.max(minSize, newHeight), maxHeight);
        setSelectionRect((prev) =>
          prev
            ? {
                ...prev,
                left: newLeft,
                top: newTop,
                width: newWidth,
                height: newHeight,
              }
            : prev,
        );
      }
      return;
    }

    if (state.mode === "move") {
      const { type, id, origX, origY, overlayRect } = state;
      const relDx = dx / overlayRect.width;
      const relDy = dy / overlayRect.height;
      const setter =
        type === "patch"
          ? setPlacedPatches
          : type === "text"
            ? setTextBoxes
            : setTables;

      setter((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                x: clamp01(origX + relDx),
                y: clamp01(origY + relDy),
              }
            : item,
        ),
      );
    } else if (state.mode === "resize") {
      const {
        type,
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

      const setter =
        type === "patch"
          ? setPlacedPatches
          : type === "text"
            ? setTextBoxes
            : setTables;
      setter((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                x: clamp01(newCenterX),
                y: clamp01(newCenterY),
                relWidth: clamp01(newWidth),
                relHeight: clamp01(newHeight),
              }
            : item,
        ),
      );
    }
  };

  const handleOverlayMouseUp = () => {
    const completedDrag = dragStateRef.current;
    const wasSelectionDrag = completedDrag?.type === "selection";
    dragStateRef.current = null;
    setHoverElement(null);
    setHoverHandle(null);

    if (isSelectionMode && selectionStartRef.current) {
      selectionStartRef.current = null;
      if (
        !selectionRect ||
        selectionRect.width < MIN_SELECTION_SIZE ||
        selectionRect.height < MIN_SELECTION_SIZE
      ) {
        setSelectionRect(null);
      } else {
        setMessage("Selection captured. Choose an action.");
      }
    }

    if (isErasing && eraseDragRef.current) {
      eraseDragRef.current = false;
      eraseLastPointRef.current = null;
    }
    if (pendingEraserStrokeRef.current) {
      requestHistorySnapshot("eraser", true);
      pendingEraserStrokeRef.current = false;
    }
    if (wasSelectionDrag && selectionRect) {
      setMessage("Selection adjusted. Choose an action or convert it.");
    }
    if (completedDrag && !wasSelectionDrag) {
      if (completedDrag.type === "text") {
        requestHistorySnapshot("text-transform");
      } else if (completedDrag.type === "patch") {
        requestHistorySnapshot("patch-transform");
      } else if (completedDrag.type === "table") {
        requestHistorySnapshot("table-transform");
      }
    }
  };

  const captureSelectionToPatch = useCallback(
    async (eraseOriginal = false) => {
      if (!selectionRect || !translatedCanvasRef.current) return;
      const { left, top, width, height, page } = selectionRect;
      if (width < MIN_SELECTION_SIZE || height < MIN_SELECTION_SIZE) {
        setSelectionRect(null);
        selectionStartRef.current = null;
        return;
      }
      try {
        const canvas = translatedCanvasRef.current;
        if (!canvas.width || !canvas.height) {
          setMessage("Translated page not ready yet.");
          return;
        }
        const sx = Math.round(left * canvas.width);
        const sy = Math.round(top * canvas.height);
        const sw = Math.round(width * canvas.width);
        const sh = Math.round(height * canvas.height);
        if (sw <= 0 || sh <= 0) {
          setSelectionRect(null);
          selectionStartRef.current = null;
          return;
        }
        const offscreen = document.createElement("canvas");
        offscreen.width = Math.max(1, sw);
        offscreen.height = Math.max(1, sh);
        const ctx = offscreen.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            canvas,
            sx,
            sy,
            sw,
            sh,
            0,
            0,
            offscreen.width,
            offscreen.height,
          );
        }
        const dataUrl = offscreen.toDataURL("image/png");
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        const timestamp = Date.now();
        const newPatch = {
          id: `selection-patch-${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
          page,
          x: centerX,
          y: centerY,
          relWidth: width,
          relHeight: height,
          scaleX: 1,
          scaleY: 1,
          dataUrl,
          createdAt: timestamp,
        };
        setPlacedPatches((prev) => [...prev, newPatch]);
        setActivePatchId(newPatch.id);
        setActiveTextBoxId(null);
        setActiveTableId(null);
        if (eraseOriginal) {
          const eraseId = `erase-selection-${timestamp}-${Math.random()
            .toString(36)
            .slice(2, 6)}`;
          setEraseRegions((prev) => [
            ...prev,
            {
              id: eraseId,
              page,
              x: centerX,
              y: centerY,
              relWidth: width,
              relHeight: height,
              color: eraserColor,
              shape: "rect",
              createdAt: timestamp - 1,
            },
          ]);
        }
        setSelectionRect(null);
        selectionStartRef.current = null;
        setMessage(
          eraseOriginal
            ? "Selection converted into a movable patch and original area cleared."
            : "Selection converted into a movable patch.",
        );
        requestHistorySnapshot(
          eraseOriginal ? "selection-move" : "selection-copy",
        );
        return newPatch;
      } catch (error) {
        console.error("Error capturing translated selection:", error);
        setMessage("Could not capture selection. Check console for details.");
      }
    },
    [
      selectionRect,
      eraserColor,
      MIN_SELECTION_SIZE,
      setPlacedPatches,
      setActivePatchId,
      setActiveTextBoxId,
      setEraseRegions,
      setMessage,
      requestHistorySnapshot,
    ],
  );

  const handleMoveSelection = useCallback(async () => {
    const patch = await captureSelectionToPatch(true);
    if (patch) {
      setIsSelectionMode(false);
      setMessage(
        "Selection moved into a draggable patch. Selection tool turned off so you can adjust it.",
      );
    }
  }, [captureSelectionToPatch, setIsSelectionMode, setMessage]);

  const handleDeleteSelection = useCallback(() => {
    if (!selectionRect) return;
    const { left, top, width, height, page } = selectionRect;
    if (width < MIN_SELECTION_SIZE || height < MIN_SELECTION_SIZE) {
      setSelectionRect(null);
      selectionStartRef.current = null;
      return;
    }
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const id = `erase-selection-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    setEraseRegions((prev) => [
      ...prev,
      {
        id,
        page,
        x: centerX,
        y: centerY,
        relWidth: width,
        relHeight: height,
        color: eraserColor,
        shape: "rect",
        createdAt: Date.now(),
      },
    ]);
    setSelectionRect(null);
    selectionStartRef.current = null;
    setMessage("Selected area deleted.");
    requestHistorySnapshot("selection-delete");
  }, [
    selectionRect,
    eraserColor,
    MIN_SELECTION_SIZE,
    setEraseRegions,
    setMessage,
    requestHistorySnapshot,
  ]);

  const handleCancelSelection = useCallback(() => {
    selectionStartRef.current = null;
    setSelectionRect(null);
    setMessage("Selection cleared.");
  }, [setSelectionRect, setMessage]);

  const requestDeleteActiveElement = useCallback(() => {
    if (selectionRect) {
      return confirmRemoval("Delete the current selection area?", () => {
        handleDeleteSelection();
      });
    }
    if (activePatchId) {
      return confirmRemoval("Delete the selected patch?", () => {
        handleRemovePatch(activePatchId);
      });
    }
    if (activeTextBoxId) {
      return confirmRemoval("Delete the selected text box?", () => {
        handleRemoveTextBox(activeTextBoxId);
      });
    }
    if (activeTableId) {
      return confirmRemoval("Delete the selected table?", () => {
        handleRemoveTable(activeTableId);
      });
    }
    return false;
  }, [
    selectionRect,
    activePatchId,
    activeTextBoxId,
    activeTableId,
    confirmRemoval,
    handleDeleteSelection,
    handleRemovePatch,
    handleRemoveTextBox,
    handleRemoveTable,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleKeyDown = (event) => {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      const isModifier = event.metaKey || event.ctrlKey;
      if (isModifier) {
        if (key === "z" && !event.shiftKey) {
          event.preventDefault();
          handleUndo();
          return;
        }
        if ((key === "z" && event.shiftKey) || key === "y") {
          event.preventDefault();
          handleRedo();
          return;
        }
      }

      const target = event.target;
      const tagName =
        target && target.tagName ? target.tagName.toLowerCase() : "";
      const isEditable =
        (target && target.isContentEditable) ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select";
      const isDeleteKey =
        event.key === "Delete" || event.key === "Backspace" || key === "delete";
      if (!isEditable && isDeleteKey) {
        const removed = requestDeleteActiveElement();
        if (removed) {
          event.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, requestDeleteActiveElement]);

  const handleSelectionMouseDown = useCallback(
    (event, forcedHandle = null) => {
      if (
        !isSelectionMode ||
        !selectionRect ||
        selectionRect.page !== translatedPage ||
        selectionStartRef.current
      ) {
        return;
      }
      const overlayEl = translatedOverlayRef.current;
      if (!overlayEl) return;
      event.preventDefault();
      event.stopPropagation();
      const overlayRect = overlayEl.getBoundingClientRect();
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const xNorm = clamp01(
        (event.clientX - overlayRect.left) / overlayRect.width,
      );
      const yNorm = clamp01(
        (event.clientY - overlayRect.top) / overlayRect.height,
      );
      const { left, top, width, height } = selectionRect;
      const normalizedThresholdX = 8 / overlayRect.width;
      const normalizedThresholdY = 8 / overlayRect.height;
      let handle = forcedHandle;
      if (!handle) {
        const nearLeft = Math.abs(xNorm - left) <= normalizedThresholdX;
        const nearRight =
          Math.abs(xNorm - (left + width)) <= normalizedThresholdX;
        const nearTop = Math.abs(yNorm - top) <= normalizedThresholdY;
        const nearBottom =
          Math.abs(yNorm - (top + height)) <= normalizedThresholdY;
        const insideHorizontal = xNorm >= left && xNorm <= left + width;
        const insideVertical = yNorm >= top && yNorm <= top + height;
        if (!insideHorizontal || !insideVertical) {
          selectionStartRef.current = { x: xNorm, y: yNorm };
          setSelectionRect({
            page: translatedPage,
            left: xNorm,
            top: yNorm,
            width: 0,
            height: 0,
          });
          return;
        }
        if (nearLeft && nearTop) handle = "nw";
        else if (nearRight && nearTop) handle = "ne";
        else if (nearLeft && nearBottom) handle = "sw";
        else if (nearRight && nearBottom) handle = "se";
      }
      if (!handle) {
        dragStateRef.current = {
          type: "selection",
          mode: "move",
          startClientX: event.clientX,
          startClientY: event.clientY,
          overlayRect,
          origLeft: left,
          origTop: top,
          width,
          height,
        };
      } else {
        dragStateRef.current = {
          type: "selection",
          mode: "resize",
          handle,
          startClientX: event.clientX,
          startClientY: event.clientY,
          overlayRect,
          origLeft: left,
          origTop: top,
          origWidth: width,
          origHeight: height,
        };
      }
    },
    [isSelectionMode, selectionRect, translatedPage, setSelectionRect],
  );

  const handleAddTextBox = useCallback(() => {
    const timestamp = Date.now();
    const newBox = {
      id: `text-${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      page: translatedPage,
      x: 0.5,
      y: 0.3,
      relWidth: 0.3,
      relHeight: 0.1,
      text: "New text",
      fontSize: 18,
      color: "#111111",
      align: "left",
      createdAt: timestamp,
    };
    setTextBoxes((prev) => [...prev, newBox]);
    setActiveTextBoxId(newBox.id);
    setActivePatchId(null);
    setActiveTableId(null);
    setMessage("Text box added. Drag or resize it on the translated page.");
    requestHistorySnapshot("text-add");
  }, [
    translatedPage,
    setTextBoxes,
    setActiveTextBoxId,
    setActivePatchId,
    setActiveTableId,
    setMessage,
    requestHistorySnapshot,
  ]);

  const updateTextBox = useCallback((id, updater) => {
    setTextBoxes((prev) =>
      prev.map((box) =>
        box.id === id
          ? typeof updater === "function"
            ? updater(box)
            : { ...box, ...updater }
          : box,
      ),
    );
    requestHistorySnapshot("text-edit");
  }, [setTextBoxes, requestHistorySnapshot]);

  const handleAddTable = useCallback(() => {
    const timestamp = Date.now();
    const newTable = {
      id: `table-${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      page: translatedPage,
      x: 0.5,
      y: 0.5,
      relWidth: 0.4,
      relHeight: 0.25,
      rows: 3,
      columns: 3,
      borderColor: "#111111",
      borderWidth: 1,
      fillColor: null,
      createdAt: timestamp,
    };
    setTables((prev) => [...prev, newTable]);
    setActiveTableId(newTable.id);
    setActivePatchId(null);
    setActiveTextBoxId(null);
    setMessage("Table added. Drag or resize it on the translated page.");
    requestHistorySnapshot("table-add");
  }, [
    translatedPage,
    setTables,
    setActiveTableId,
    setActivePatchId,
    setActiveTextBoxId,
    setMessage,
    requestHistorySnapshot,
  ]);

  const updateTable = useCallback((id, updater) => {
    setTables((prev) =>
      prev.map((table) =>
        table.id === id
          ? typeof updater === "function"
            ? updater(table)
            : { ...table, ...updater }
          : table,
      ),
    );
    requestHistorySnapshot("table-edit");
  }, [setTables, requestHistorySnapshot]);

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
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Apply patches, text overlays, and erase regions in the same creation order as preview,
      // so new items drawn after an erase appear on top of that erase.
      const ops = [
        ...placedPatches.map((p) => ({ type: "patch", item: p })),
        ...textBoxes.map((t) => ({ type: "text", item: t })),
        ...tables.map((tbl) => ({ type: "table", item: tbl })),
        ...eraseRegions.map((r) => ({ type: "erase", item: r })),
      ].sort(
        (a, b) => (a.item.createdAt || 0) - (b.item.createdAt || 0),
      );

      for (const op of ops) {
        if (op.type === "patch") {
          const patch = op.item;
          const pageIndex = (patch.page || 1) - 1;
          const page = pages[pageIndex];
          if (!page) continue;

          const pageWidth = page.getWidth();
          const pageHeight = page.getHeight();

          const scaleX = patch.scaleX || 1;
          const scaleY = patch.scaleY || 1;
          const width = patch.relWidth * scaleX * pageWidth;
          const height = patch.relHeight * scaleY * pageHeight;

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
        } else if (op.type === "text") {
          const textBox = op.item;
          const pageIndex = (textBox.page || 1) - 1;
          const page = pages[pageIndex];
          if (!page) continue;

          const pageWidth = page.getWidth();
          const pageHeight = page.getHeight();
          const width = textBox.relWidth * pageWidth;
          const height = textBox.relHeight * pageHeight;
          const centerX = textBox.x * pageWidth;
          const centerYFromTop = textBox.y * pageHeight;
          const x = centerX - width / 2;
          const boxTop = pageHeight - centerYFromTop + height / 2;
          const fontSize = textBox.fontSize || 16;
          const color = hexToRgb(textBox.color || "#111111", {
            r: 0,
            g: 0,
            b: 0,
          });
          const alignment = textBox.align || "left";
          const lines = (textBox.text || "").split(/\r?\n/);
          let currentY = boxTop - fontSize;
          for (const rawLine of lines) {
            const line = rawLine === "" ? " " : rawLine;
            const lineWidth = helveticaFont.widthOfTextAtSize(
              line,
              fontSize,
            );
            let lineX = x;
            if (alignment === "center") {
              lineX = x + (width - lineWidth) / 2;
            } else if (alignment === "right") {
              lineX = x + width - lineWidth;
            }
            page.drawText(line, {
              x: lineX,
              y: currentY,
              size: fontSize,
              font: helveticaFont,
              color: rgb(color.r, color.g, color.b),
              maxWidth: width,
              lineHeight: fontSize * 1.2,
            });
            currentY -= fontSize * 1.2;
          }
        } else if (op.type === "table") {
          const table = op.item;
          const pageIndex = (table.page || 1) - 1;
          const page = pages[pageIndex];
          if (!page) continue;

          const pageWidth = page.getWidth();
          const pageHeight = page.getHeight();
          const width = table.relWidth * pageWidth;
          const height = table.relHeight * pageHeight;
          const centerX = table.x * pageWidth;
          const centerYFromTop = table.y * pageHeight;
          const x = centerX - width / 2;
          const y = pageHeight - centerYFromTop - height / 2;
          const rows = Math.max(1, table.rows || 1);
          const columns = Math.max(1, table.columns || 1);
          const borderWidth = table.borderWidth || 1;
          const borderColor = hexToRgb(table.borderColor || "#111111", {
            r: 0,
            g: 0,
            b: 0,
          });
          const fillColorHex =
            table.fillColor && table.fillColor !== "#FFFFFF"
              ? table.fillColor
              : null;
          const fillColor = fillColorHex
            ? hexToRgb(fillColorHex, { r: 1, g: 1, b: 1 })
            : null;
          const borderRgb = rgb(borderColor.r, borderColor.g, borderColor.b);

          if (fillColor) {
            page.drawRectangle({
              x,
              y,
              width,
              height,
              borderWidth,
              borderColor: borderRgb,
              color: rgb(fillColor.r, fillColor.g, fillColor.b),
            });
          } else {
            // Draw only the outline so the table stays transparent in the merged PDF
            page.drawLine({
              start: { x, y },
              end: { x: x + width, y },
              thickness: borderWidth,
              color: borderRgb,
            });
            page.drawLine({
              start: { x, y: y + height },
              end: { x: x + width, y: y + height },
              thickness: borderWidth,
              color: borderRgb,
            });
            page.drawLine({
              start: { x, y },
              end: { x, y: y + height },
              thickness: borderWidth,
              color: borderRgb,
            });
            page.drawLine({
              start: { x: x + width, y },
              end: { x: x + width, y: y + height },
              thickness: borderWidth,
              color: borderRgb,
            });
          }

          const rowHeight = height / rows;
          for (let i = 1; i < rows; i += 1) {
            const yPos = y + rowHeight * i;
            page.drawLine({
              start: { x, y: yPos },
              end: { x: x + width, y: yPos },
              thickness: borderWidth,
              color: rgb(borderColor.r, borderColor.g, borderColor.b),
            });
          }

          const columnWidth = width / columns;
          for (let i = 1; i < columns; i += 1) {
            const xPos = x + columnWidth * i;
            page.drawLine({
              start: { x: xPos, y },
              end: { x: xPos, y: y + height },
              thickness: borderWidth,
              color: rgb(borderColor.r, borderColor.g, borderColor.b),
            });
          }
        } else if (op.type === "erase") {
          const region = op.item;
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

  const activePatch = activePatchId
    ? placedPatches.find((p) => p.id === activePatchId)
    : null;
  const activeTextBox =
    activeTextBoxId && textBoxes.length
      ? textBoxes.find((t) => t.id === activeTextBoxId)
      : null;
  const canCreatePatchNow =
    isCropMode &&
    completedCrop &&
    completedCrop.width >= 5 &&
    completedCrop.height >= 5;

  return (
    <ProtectedRoute>
      <main className="container mx-auto px-4 py-8">
        {message && (
          <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded">
            {message}
          </div>
        )}
        <DndContext
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <aside className="w-full lg:w-56 flex-shrink-0 space-y-3">
              <div className="border rounded-lg bg-white shadow-sm p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Toolbox
                </div>
                <div className="grid grid-cols-4 lg:grid-cols-2 gap-2">
                  <IconButton
                    icon={Undo2}
                    label="Undo (Ctrl+Z)"
                    disabled={!canUndo}
                    onClick={handleUndo}
                  />
                  <IconButton
                    icon={Redo2}
                    label="Redo (Ctrl+Shift+Z)"
                    disabled={!canRedo}
                    onClick={handleRedo}
                  />
                  <IconButton
                    icon={Crop}
                    label={isCropMode ? "Exit crop mode" : "Create patch area"}
                    active={isCropMode}
                    onClick={() => {
                      setIsErasing(false);
                      setIsSelectionMode(false);
                      setIsColorPickMode(false);
                      handleToggleCropMode();
                    }}
                  />
                  <IconButton
                    icon={PlusSquare}
                    label="Add patch to palette"
                    disabled={!canCreatePatchNow}
                    onClick={createPatchFromCrop}
                  />
                  <IconButton
                    icon={EraserIcon}
                    label={isErasing ? "Disable eraser" : "Eraser"}
                    active={isErasing}
                    onClick={() => {
                      setIsErasing((prev) => {
                        const next = !prev;
                        if (next) {
                          if (eraserCursorRef.current) {
                            eraserCursorRef.current.style.left = "50%";
                            eraserCursorRef.current.style.top = "50%";
                          }
                          eraseLastPointRef.current = null;
                        } else if (eraserCursorRef.current) {
                          eraserCursorRef.current.style.left = "-9999px";
                          eraserCursorRef.current.style.top = "-9999px";
                        }
                        return next;
                      });
                      setIsColorPickMode(false);
                      setIsSelectionMode(false);
                      setIsCropMode(false);
                      setMessage(
                        !isErasing
                          ? "Eraser mode: drag on translated page to cover content."
                          : "",
                      );
                    }}
                  />
                  <IconButton
                    icon={Droplet}
                    label="Pick color from page"
                    active={isColorPickMode}
                    onClick={() => {
                      setIsColorPickMode((prev) => !prev);
                      setIsErasing(false);
                      setIsSelectionMode(false);
                      setIsCropMode(false);
                      setMessage(
                        !isColorPickMode
                          ? "Click on translated page to pick a color."
                          : "",
                      );
                    }}
                  />
                  <IconButton
                    icon={SelectionIcon}
                    label={isSelectionMode ? "Exit selection" : "Selection tool"}
                    active={isSelectionMode}
                    onClick={() => {
                      setIsSelectionMode((prev) => {
                        const next = !prev;
                        if (next) {
                          setIsErasing(false);
                          setIsColorPickMode(false);
                          setIsCropMode(false);
                        } else {
                          handleCancelSelection();
                        }
                        return next;
                      });
                    }}
                  />
                  <IconButton
                    icon={TypeIcon}
                    label="Add text box"
                    onClick={() => {
                      setIsCropMode(false);
                      setIsSelectionMode(false);
                      setIsErasing(false);
                      setIsColorPickMode(false);
                      handleAddTextBox();
                    }}
                  />
                  <IconButton
                    icon={TableIcon}
                    label="Insert table"
                    onClick={() => {
                      setIsCropMode(false);
                      setIsSelectionMode(false);
                      setIsErasing(false);
                      setIsColorPickMode(false);
                      handleAddTable();
                    }}
                  />
                </div>
              </div>

              {isCropMode && (
                <div className="border rounded-lg bg-white shadow-sm p-3 space-y-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-700">Crop mode</p>
                  <p>Drag on the Original PDF, then click the plus icon to save that area.</p>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={removePatchBackground}
                      onChange={(e) => setRemovePatchBackground(e.target.checked)}
                    />
                    <span>Remove white background</span>
                  </label>
                </div>
              )}

              {isErasing && (
                <div className="border rounded-lg bg-white shadow-sm p-3 space-y-2 text-xs text-gray-700">
                  <div className="font-semibold text-gray-700 text-sm">Eraser settings</div>
                  <label className="flex items-center gap-2">
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
                      className="flex-1"
                    />
                    <span>{Math.round(eraserThickness)}px</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span>Color</span>
                    <input
                      type="color"
                      value={eraserColor}
                      onChange={(e) => setEraserColor(e.target.value)}
                      className="w-10 h-7 border rounded"
                    />
                  </label>
                </div>
              )}

              <div className="border rounded-lg bg-white shadow-sm p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
                  <span>Patches</span>
                  <span className="text-[10px] text-gray-400">{patches.length}</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1">
                  {patches.length === 0 ? (
                    <div className="text-xs text-gray-500">
                      Create a patch to populate this palette.
                    </div>
                  ) : (
                    patches.map((p) => <DraggablePatch key={p.id} patch={p} />)
                  )}
                </div>
              </div>

              <div className="border rounded-lg bg-white shadow-sm p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-gray-700">Text overlays</div>
                  <span className="text-xs text-gray-400">{textBoxes.length}</span>
                </div>
                {textBoxes.length === 0 ? (
                  <div className="text-xs text-gray-500">
                    Use the "T" icon to drop a correction on the translated page.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {textBoxes
                      .slice()
                      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
                      .map((box, idx) => (
                        <div
                          key={box.id}
                          className="border border-gray-200 rounded p-2 bg-gray-50"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                            <span>Text #{idx + 1} (p{box.page})</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="px-2 py-0.5 border rounded text-blue-600 border-blue-400"
                                onClick={() => {
                                  setTranslatedPage(box.page);
                                  setActiveTextBoxId(box.id);
                                  setActivePatchId(null);
                                }}
                              >
                                Select
                              </button>
                              <button
                                type="button"
                                className="px-2 py-0.5 border rounded text-red-600 border-red-300"
                                onClick={() => handleRemoveTextBox(box.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <textarea
                            className="mt-2 w-full border rounded px-2 py-1 text-xs"
                            rows={2}
                            value={box.text}
                            onChange={(e) =>
                              updateTextBox(box.id, { text: e.target.value })
                            }
                          />
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                            <label className="flex flex-col gap-1">
                              <span>Page</span>
                              <input
                                type="number"
                                min={1}
                                className="border rounded px-1 py-0.5"
                                value={box.page}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value || "1", 10);
                                  updateTextBox(box.id, {
                                    page: Number.isNaN(value) ? 1 : value,
                                  });
                                }}
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span>Font px</span>
                              <input
                                type="number"
                                min={8}
                                max={96}
                                className="border rounded px-1 py-0.5"
                                value={box.fontSize}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value || "12", 10);
                                  updateTextBox(box.id, {
                                    fontSize: Number.isNaN(value) ? 12 : value,
                                  });
                                }}
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span>Color</span>
                              <input
                                type="color"
                                className="w-full h-7 border rounded"
                                value={box.color}
                                onChange={(e) =>
                                  updateTextBox(box.id, { color: e.target.value })
                                }
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span>Align</span>
                              <select
                                className="border rounded px-1 py-0.5"
                                value={box.align || "left"}
                                onChange={(e) =>
                                  updateTextBox(box.id, { align: e.target.value })
                                }
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </label>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="border rounded-lg bg-white shadow-sm p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-gray-700">Tables</div>
                  <span className="text-xs text-gray-400">{tables.length}</span>
                </div>
                {tables.length === 0 ? (
                  <div className="text-xs text-gray-500">
                    Use the table icon to add a grid overlay to the translated PDF.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {tables
                      .slice()
                      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
                      .map((table, idx) => (
                        <div
                          key={table.id}
                          className="border border-gray-200 rounded p-2 bg-gray-50 text-xs text-gray-700 space-y-2"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span>Table #{idx + 1} (p{table.page})</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="px-2 py-0.5 border rounded text-blue-600 border-blue-400"
                                onClick={() => {
                                  setTranslatedPage(table.page);
                                  setActiveTableId(table.id);
                                  setActivePatchId(null);
                                  setActiveTextBoxId(null);
                                }}
                              >
                                Select
                              </button>
                              <button
                                type="button"
                                className="px-2 py-0.5 border rounded text-red-600 border-red-300"
                                onClick={() => handleRemoveTable(table.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex flex-col gap-1">
                              <span>Page</span>
                              <input
                                type="number"
                                min={1}
                                className="border rounded px-1 py-0.5"
                                value={table.page}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value || "1", 10);
                                  updateTable(table.id, {
                                    page: Number.isNaN(value) || value < 1 ? 1 : value,
                                  });
                                }}
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span>Rows</span>
                              <input
                                type="number"
                                min={1}
                                max={25}
                                className="border rounded px-1 py-0.5"
                                value={table.rows}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value || "1", 10);
                                  updateTable(table.id, {
                                    rows: Number.isNaN(value) || value < 1 ? 1 : Math.min(50, value),
                                  });
                                }}
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span>Columns</span>
                              <input
                                type="number"
                                min={1}
                                max={25}
                                className="border rounded px-1 py-0.5"
                                value={table.columns}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value || "1", 10);
                                  updateTable(table.id, {
                                    columns: Number.isNaN(value) || value < 1 ? 1 : Math.min(50, value),
                                  });
                                }}
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span>Border color</span>
                              <input
                                type="color"
                                className="w-full h-7 border rounded"
                                value={table.borderColor || "#111111"}
                                onChange={(e) =>
                                  updateTable(table.id, { borderColor: e.target.value })
                                }
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span>Border width</span>
                              <input
                                type="number"
                                min={0.25}
                                max={8}
                                step={0.25}
                                className="border rounded px-1 py-0.5"
                                value={table.borderWidth ?? 1}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  updateTable(table.id, {
                                    borderWidth: Number.isNaN(value) ? 1 : Math.max(0.25, value),
                                  });
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </aside>
            <div className="flex-1 space-y-4">
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
                <div className="relative flex-1 bg-gray-50 flex items-center justify-center p-3">
                {cropImageUrl ? (
                  isCropMode ? (
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
                        alt={`Original page ${currentPage}`}
                        crossOrigin="anonymous"
                        className="w-full h-auto"
                      />
                    </ReactCrop>
                  ) : (
                    <img
                      ref={originalImgRef}
                      src={cropImageUrl}
                      alt={`Original page ${currentPage}`}
                      crossOrigin="anonymous"
                      className="w-full h-auto"
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-gray-500 px-2">
                    Loading original page image...
                  </div>
                )}
                {!isCropMode && cropImageUrl && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 border border-emerald-200 text-xs text-emerald-700 px-2 py-1 rounded shadow">
                    Enable "Create patch area" to draw a rectangle here.
                  </div>
                )}
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
                <div className="relative flex-1 bg-gray-50 flex items-center justify-center p-3">
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
                      cursor: isErasing
                        ? "none"
                        : isColorPickMode || isSelectionMode
                          ? "crosshair"
                          : "default",
                    }}
                  >
                    {/* Combined layer: draw patches, text boxes, and eraser dabs in creation order */}
                    {[
                      ...placedPatches
                        .filter((p) => p.page === translatedPage)
                        .map((p) => ({ type: "patch", item: p })),
                      ...textBoxes
                        .filter((t) => t.page === translatedPage)
                        .map((t) => ({ type: "text", item: t })),
                      ...tables
                        .filter((tbl) => tbl.page === translatedPage)
                        .map((tbl) => ({ type: "table", item: tbl })),
                      ...eraseRegions
                        .filter((r) => r.page === translatedPage)
                        .map((r) => ({ type: "erase", item: r })),
                    ]
                      .sort(
                        (a, b) =>
                          (a.item.createdAt || 0) - (b.item.createdAt || 0),
                      )
                      .map((entry) => {
                        if (entry.type === "erase") {
                          const r = entry.item;
                          return (
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
                                borderRadius:
                                  r.shape === "rect" ? "0" : "9999px",
                              }}
                            />
                          );
                        }

                        const element = entry.item;
                        const isHover =
                          hoverElement &&
                          hoverElement.type === entry.type &&
                          hoverElement.id === element.id;
                        const handle = isHover ? hoverHandle : null;
                        let cursor = "move";
                        if (isErasing) {
                          cursor = "none";
                        } else if (isSelectionMode) {
                          cursor = "crosshair";
                        } else {
                          if (handle === "n" || handle === "s")
                            cursor = "ns-resize";
                          else if (handle === "e" || handle === "w")
                            cursor = "ew-resize";
                          else if (handle === "ne" || handle === "sw")
                            cursor = "nesw-resize";
                          else if (handle === "nw" || handle === "se")
                            cursor = "nwse-resize";
                        }

                        if (entry.type === "text") {
                          const style = {
                            left: `${element.x * 100}%`,
                            top: `${element.y * 100}%`,
                            width: `${element.relWidth * 100}%`,
                            height: `${element.relHeight * 100}%`,
                            transform: "translate(-50%, -50%)",
                          };
                          return (
                            <div
                              key={element.id}
                              className="absolute"
                              style={style}
                              onMouseDown={(e) =>
                                handleElementMouseDown("text", element.id, e)
                              }
                              onMouseMove={(e) =>
                                handleElementHover("text", element.id, e)
                              }
                              onMouseLeave={() => {
                                if (
                                  hoverElement &&
                                  hoverElement.type === "text" &&
                                  hoverElement.id === element.id
                                ) {
                                  setHoverElement(null);
                                  setHoverHandle(null);
                                }
                              }}
                            >
                              <div
                                className="w-full h-full border border-blue-400 bg-white/80 rounded-sm px-1 py-0.5 overflow-hidden"
                                style={{
                                  fontSize: `${element.fontSize}px`,
                                  color: element.color || "#111111",
                                  textAlign: element.align || "left",
                                  whiteSpace: "pre-wrap",
                                  lineHeight: 1.2,
                                  boxShadow:
                                    element.id === activeTextBoxId
                                      ? "0 0 0 2px rgba(59,130,246,0.5)"
                                      : undefined,
                                  cursor,
                                }}
                              >
                                {element.text || ""}
                              </div>
                              {["nw", "ne", "sw", "se"].map((pos) => (
                                <div
                                  key={pos}
                                  className="absolute w-3 h-3 rounded-full bg-white border border-blue-500"
                                  style={{
                                    ...(pos === "nw"
                                      ? { top: -6, left: -6 }
                                      : pos === "ne"
                                        ? { top: -6, right: -6 }
                                        : pos === "sw"
                                          ? { bottom: -6, left: -6 }
                                          : { bottom: -6, right: -6 }),
                                    cursor:
                                      pos === "nw" || pos === "se"
                                        ? "nwse-resize"
                                        : "nesw-resize",
                                  }}
                                  onMouseDown={(e) =>
                                    handleElementMouseDown("text", element.id, e, pos)
                                  }
                                />
                              ))}
                              {element.id === activeTextBoxId && (
                                <button
                                  type="button"
                                  className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-white border border-gray-300 shadow text-gray-500 hover:bg-red-50 hover:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveTextBox(element.id);
                                  }}
                                >
                                  <CloseIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        }

                        if (entry.type === "table") {
                          const style = {
                            left: `${element.x * 100}%`,
                            top: `${element.y * 100}%`,
                            width: `${element.relWidth * 100}%`,
                            height: `${element.relHeight * 100}%`,
                            transform: "translate(-50%, -50%)",
                          };
                          const rows = Math.max(1, element.rows || 1);
                          const columns = Math.max(1, element.columns || 1);
                          const borderHex = element.borderColor || "#111111";
                          const backgroundImage = `
                            linear-gradient(to right, ${borderHex} 0, ${borderHex} 1px, transparent 1px),
                            linear-gradient(to bottom, ${borderHex} 0, ${borderHex} 1px, transparent 1px)
                          `;
                          const backgroundSize = `${100 / columns}% 100%, 100% ${100 / rows}%`;
                          return (
                            <div
                              key={element.id}
                              className="absolute"
                              style={style}
                              onMouseDown={(e) =>
                                handleElementMouseDown("table", element.id, e)
                              }
                              onMouseMove={(e) =>
                                handleElementHover("table", element.id, e)
                              }
                              onMouseLeave={() => {
                                if (
                                  hoverElement &&
                                  hoverElement.type === "table" &&
                                  hoverElement.id === element.id
                                ) {
                                  setHoverElement(null);
                                  setHoverHandle(null);
                                }
                              }}
                            >
                              <div
                                className="w-full h-full rounded-sm"
                                style={{
                                  border: `${element.borderWidth ?? 1}px solid ${borderHex}`,
                                  backgroundColor: "transparent",
                                  backgroundImage,
                                  backgroundSize,
                                  backgroundPosition: "center",
                                  boxShadow:
                                    element.id === activeTableId
                                      ? "0 0 0 2px rgba(59,130,246,0.5)"
                                      : undefined,
                                  cursor,
                                }}
                              />
                              {["nw", "ne", "sw", "se"].map((pos) => (
                                <div
                                  key={pos}
                                  className="absolute w-3 h-3 rounded-full bg-white border border-blue-500"
                                  style={{
                                    ...(pos === "nw"
                                      ? { top: -6, left: -6 }
                                      : pos === "ne"
                                        ? { top: -6, right: -6 }
                                        : pos === "sw"
                                          ? { bottom: -6, left: -6 }
                                          : { bottom: -6, right: -6 }),
                                    cursor:
                                      pos === "nw" || pos === "se"
                                        ? "nwse-resize"
                                        : "nesw-resize",
                                  }}
                                  onMouseDown={(e) =>
                                    handleElementMouseDown("table", element.id, e, pos)
                                  }
                                />
                              ))}
                              {element.id === activeTableId && (
                                <button
                                  type="button"
                                  className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-white border border-gray-300 shadow text-gray-500 hover:bg-red-50 hover:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveTable(element.id);
                                  }}
                                >
                                  <CloseIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        }

                        const commonStyle = {
                          left: `${element.x * 100}%`,
                          top: `${element.y * 100}%`,
                          width: `${element.relWidth * (element.scaleX || 1) * 100}%`,
                          height: `${element.relHeight * (element.scaleY || 1) * 100}%`,
                          transform: "translate(-50%, -50%)",
                        };

                        return (
                          <div
                            key={element.id}
                            className="absolute"
                            style={commonStyle}
                            onMouseDown={(e) =>
                              handleElementMouseDown("patch", element.id, e)
                            }
                            onMouseMove={(e) =>
                              handleElementHover("patch", element.id, e)
                            }
                            onMouseLeave={() => {
                              if (
                                hoverElement &&
                                hoverElement.type === "patch" &&
                                hoverElement.id === element.id
                              ) {
                                setHoverElement(null);
                                setHoverHandle(null);
                              }
                            }}
                          >
                            <img
                              src={element.dataUrl}
                              alt={`Placed ${element.id}`}
                              className="w-full h-full object-contain"
                              style={{
                                outline: "1px solid rgba(239,68,68,0.8)",
                                outlineOffset: 0,
                                boxShadow:
                                  element.id === activePatchId
                                    ? "0 0 0 2px rgba(59,130,246,0.8)"
                                    : undefined,
                                cursor,
                              }}
                              draggable={false}
                            />
                            {["nw", "ne", "sw", "se"].map((pos) => (
                              <div
                                key={pos}
                                className="absolute w-3 h-3 rounded-full bg-white border border-blue-500"
                                style={{
                                  ...(pos === "nw"
                                    ? { top: -6, left: -6 }
                                    : pos === "ne"
                                      ? { top: -6, right: -6 }
                                      : pos === "sw"
                                        ? { bottom: -6, left: -6 }
                                        : { bottom: -6, right: -6 }),
                                  cursor:
                                    pos === "nw" || pos === "se"
                                      ? "nwse-resize"
                                      : "nesw-resize",
                                }}
                                onMouseDown={(e) =>
                                  handleElementMouseDown("patch", element.id, e, pos)
                                }
                              />
                            ))}
                            {element.id === activePatchId && (
                              <button
                                type="button"
                                className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-white border border-gray-300 shadow text-gray-500 hover:bg-red-50 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePatch(element.id);
                                }}
                              >
                                <CloseIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                    {selectionRect &&
                      selectionRect.page === translatedPage && (
                        <>
                          <div
                            className="absolute border-2 border-blue-500 bg-blue-200/15 cursor-move"
                            style={{
                              left: `${selectionRect.left * 100}%`,
                              top: `${selectionRect.top * 100}%`,
                              width: `${selectionRect.width * 100}%`,
                              height: `${selectionRect.height * 100}%`,
                            }}
                            onMouseDown={(e) => handleSelectionMouseDown(e)}
                          />
                          {["nw", "ne", "sw", "se"].map((pos) => (
                            <div
                              key={`selection-handle-${pos}`}
                              className="absolute w-3 h-3 rounded-full bg-white border border-blue-500"
                              style={{
                                ...(pos === "nw"
                                  ? { top: `${selectionRect.top * 100}%`, left: `${selectionRect.left * 100}%` }
                                  : pos === "ne"
                                    ? {
                                        top: `${selectionRect.top * 100}%`,
                                        left: `${(selectionRect.left + selectionRect.width) * 100}%`,
                                      }
                                    : pos === "sw"
                                      ? {
                                          top: `${(selectionRect.top + selectionRect.height) * 100}%`,
                                          left: `${selectionRect.left * 100}%`,
                                        }
                                      : {
                                          top: `${(selectionRect.top + selectionRect.height) * 100}%`,
                                          left: `${(selectionRect.left + selectionRect.width) * 100}%`,
                                        }),
                                transform: "translate(-50%, -50%)",
                                cursor:
                                  pos === "nw" || pos === "se"
                                    ? "nwse-resize"
                                    : "nesw-resize",
                              }}
                              onMouseDown={(e) =>
                                handleSelectionMouseDown(e, pos)
                              }
                            />
                          ))}
                          {selectionRect.width > 0 &&
                            selectionRect.height > 0 &&
                            !selectionStartRef.current && (
                              <button
                                type="button"
                                className="absolute h-7 w-7 rounded-full bg-white border border-gray-300 shadow text-gray-600 hover:bg-red-50 hover:text-red-600"
                                style={{
                                  left: `${(selectionRect.left + selectionRect.width) * 100}%`,
                                  top: `${selectionRect.top * 100}%`,
                                  transform: "translate(40%, -140%)",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelSelection();
                                }}
                              >
                                <CloseIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                          {!selectionStartRef.current &&
                            selectionRect.width >= MIN_SELECTION_SIZE &&
                            selectionRect.height >= MIN_SELECTION_SIZE && (
                              <div
                                className="absolute"
                                style={{
                                  left: `${(selectionRect.left + selectionRect.width) * 100}%`,
                                  top: `${selectionRect.top * 100}%`,
                                  transform: "translate(-100%, -110%)",
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <div className="bg-white border border-blue-300 rounded shadow px-2 py-1 flex flex-wrap gap-2 text-xs text-gray-700">
                                  <button
                                    type="button"
                                    className="px-2 py-0.5 bg-blue-600 text-white rounded"
                                    onClick={handleMoveSelection}
                                  >
                                    Move selection
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-0.5 border border-red-400 text-red-600 rounded hover:bg-red-50"
                                    onClick={handleDeleteSelection}
                                  >
                                    Delete selection
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-0.5 border rounded"
                                    onClick={handleCancelSelection}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                        </>
                      )}

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
                    <TranslatedDropArea />
                  </div>
                </div>
              </div>
            </div>
              </div>
            </div>
          </div>

          {/* Scale + download controls */}
          <div className="mt-4 flex flex-col md:flex-row items-start md:items-center justify-end gap-4">
            {/* <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
              {activePatch ? (
                <>
                  <span>Selected patch:</span>
                  <label className="flex items-center gap-1">
                    <span>Page</span>
                    <input
                      type="number"
                      min={1}
                      value={activePatch.page || 1}
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
                  <span>Width</span>
                  <input
                    type="range"
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={activePatch.scaleX || 1}
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
                  <span>Height</span>
                  <input
                    type="range"
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={activePatch.scaleY || 1}
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
              ) : activeTextBox ? (
                <>
                  <span>Selected text box:</span>
                  <label className="flex items-center gap-1">
                    <span>Page</span>
                    <input
                      type="number"
                      min={1}
                      value={activeTextBox.page || 1}
                      onChange={(e) => {
                        const value = parseInt(e.target.value || "1", 10);
                        updateTextBox(activeTextBoxId, {
                          page: Number.isNaN(value) || value < 1 ? 1 : value,
                        });
                      }}
                      className="w-12 border rounded px-1 py-0.5 text-center"
                    />
                  </label>
                  <span>Box width</span>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.01}
                    value={activeTextBox.relWidth}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      updateTextBox(activeTextBoxId, {
                        relWidth: Number.isNaN(value)
                          ? activeTextBox.relWidth
                          : value,
                      });
                    }}
                  />
                  <span>Box height</span>
                  <input
                    type="range"
                    min={0.03}
                    max={0.6}
                    step={0.01}
                    value={activeTextBox.relHeight}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      updateTextBox(activeTextBoxId, {
                        relHeight: Number.isNaN(value)
                          ? activeTextBox.relHeight
                          : value,
                      });
                    }}
                  />
                  <label className="flex items-center gap-1">
                    <span>Font px</span>
                    <input
                      type="number"
                      min={8}
                      max={96}
                      value={activeTextBox.fontSize}
                      onChange={(e) => {
                        const value = parseInt(e.target.value || "12", 10);
                        updateTextBox(activeTextBoxId, {
                          fontSize: Number.isNaN(value) ? 12 : value,
                        });
                      }}
                      className="w-16 border rounded px-1 py-0.5"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span>Color</span>
                    <input
                      type="color"
                      value={activeTextBox.color}
                      onChange={(e) =>
                        updateTextBox(activeTextBoxId, { color: e.target.value })
                      }
                      className="w-10 h-6 border rounded"
                    />
                  </label>
                  <button
                    type="button"
                    className="ml-2 px-2 py-1 border rounded text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => {
                      handleRemoveTextBox(activeTextBoxId);
                    }}
                  >
                    Delete
                  </button>
                </>
              ) : (
                <span>Select a patch or text box to adjust it.</span>
              )}
            </div> */}
            <button
              onClick={handleDownloadMerged}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Download merged translated PDF
            </button>
          </div>
          <DragOverlay>
            {activeDragPatch ? (
              <div className="inline-block border border-gray-400 rounded bg-white p-1 shadow-lg">
                <img
                  src={activeDragPatch.dataUrl}
                  alt="Dragging patch"
                  className="w-20 h-20 object-contain pointer-events-none"
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </ProtectedRoute>
  );
}
