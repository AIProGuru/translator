"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { BACK_HOST } from "@/lib/constants";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../app/context/AuthContext";

const ITEMS_PER_PAGE = 6;

export default function ProcessList({ processes }) {
  const router = useRouter();
  const { token } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [allProcesses, setAllProcesses] = useState(processes);
  const [modalOpen, setModalOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState(null);

  useEffect(() => {
    if (processes && processes.length > 0) {
      setAllProcesses(processes);
    }
  }, [processes]);

  const openModal = (id) => {
    setProcessToDelete(id);
    setModalOpen(true);
  };

  if (!allProcesses || allProcesses.length === 0) {
    return (
      <div className="text-center py-8 text-blue-500">
        No hay procesos activos
      </div>
    );
  }

  const totalPages = Math.ceil(allProcesses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = allProcesses.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };
  const handleDelete = async () => {
    try {
      await fetch(`${BACK_HOST}/api/processes/${processToDelete}`, {
        method: "DELETE",
        credentials: "include",
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });
      setAllProcesses((prev) => prev.filter((p) => p.id !== processToDelete));
    } catch (error) {
      console.error("Error al eliminar el proceso:", error);
      alert("Error al eliminar el proceso.");
    } finally {
      setModalOpen(false);
      setProcessToDelete(null);
    }
  };
  

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {currentItems.map((process, index) => (
          <motion.div
            key={process.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(`/${process.id}`)}
            className="p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors duration-300 flex items-center justify-between relative"
          >
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-3 animate-pulse"></div>
              <span className="font-medium text-blue-800">
                Process #{process.id}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full 
                ${
                  process.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : process.status === "error"
                    ? "bg-red-100 text-red-700"
                    : process.status === "processing"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {process.status.toUpperCase()}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openModal(process.id);
                }}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </motion.div>
        ))}
        <ConfirmModal
          isOpen={modalOpen}
          message={`Are you sure you want to delete the process #${processToDelete}?`}
          onConfirm={handleDelete}
          onCancel={() => setModalOpen(false)}
        />
      </div>

      {/* Controles de paginación */}
      <div className="flex justify-center items-center space-x-2 mt-4">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 bg-blue-200 text-blue-700 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-blue-800 font-medium">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 bg-blue-200 text-blue-700 rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
