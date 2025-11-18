"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { motion } from "framer-motion"

export default function UploadArea({ file, setFile }) {
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        setFile(acceptedFiles[0])
      }
    },
    [setFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  })

  return (
    <div>
      <motion.div
        {...getRootProps()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors duration-300 ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : file
              ? "border-green-500 bg-green-50"
              : "border-blue-300 hover:border-blue-500"
        }`}
      >
        <input {...getInputProps()} />

        {file ? (
          <div className="space-y-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex justify-center"
            >
              <svg
                className="w-16 h-16 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </motion.div>
            <h3 className="text-xl font-semibold text-green-700">Selected Document</h3>
            <p className="text-green-600">{file.name}</p>
            <p className="text-sm text-green-500">Click or drag to change the document</p>
          </div>
        ) : isDragActive ? (
          <div className="space-y-4">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
              className="flex justify-center"
            >
              <svg
                className="w-16 h-16 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
            </motion.div>
            <h3 className="text-xl font-semibold text-blue-700">Drag & drop files here</h3>
          </div>
        ) : (
          <div className="space-y-4">
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
              className="flex justify-center"
            >
              <svg
                className="w-16 h-16 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </motion.div>
            <h3 className="text-xl font-semibold text-blue-700">Drag and drop your PDF document here</h3>
            <p className="text-blue-600">or click to select a file</p>
            <p className="text-sm text-blue-400">PDF file only</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
