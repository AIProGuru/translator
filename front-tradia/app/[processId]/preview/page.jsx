"use client";

import { use } from "react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { BACK_HOST } from "@/lib/constants";

export default function PreviewPage({ params }) {
  const { processId } = use(params);

  const originalUrl = `${BACK_HOST}/api/preview/original/${processId}`;
  const translatedUrl = `${BACK_HOST}/api/preview/translated/${processId}`;

  return (
    <ProtectedRoute>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4 text-blue-800">
          Preview: Original vs Translated
        </h1>
        <p className="mb-4 text-sm text-gray-600">
          The original PDF is shown on the left; the translated PDF is on the right.
          Use this view to visually check missing images, logos, signatures, and layout
          before downloading.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[80vh]">
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
              Original PDF
            </div>
            <iframe
              src={originalUrl}
              className="flex-1 w-full h-full"
              title="Original PDF preview"
            />
          </div>
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
              Translated PDF
            </div>
            <iframe
              src={translatedUrl}
              className="flex-1 w-full h-full"
              title="Translated PDF preview"
            />
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}


