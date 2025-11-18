"use client"

import { motion } from "framer-motion"

export default function ProgressBar({ progress }) {
  return (
    <div className="w-full bg-blue-100 rounded-full h-6 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5 }}
        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center text-xs text-white font-semibold"
      >
        {/* {progress}% */}
      </motion.div>
    </div>
  )
}
