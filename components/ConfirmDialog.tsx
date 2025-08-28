"use client"

import { AlertTriangle } from "lucide-react"
import Modal from "./Modal"

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: "danger" | "warning" | "info"
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning",
}: ConfirmDialogProps) {
  const typeStyles = {
    danger: {
      icon: "text-red-600",
      button: "btn-danger",
    },
    warning: {
      icon: "text-yellow-600",
      button: "btn-primary",
    },
    info: {
      icon: "text-blue-600",
      button: "btn-primary",
    },
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <div className="flex items-start space-x-4">
        <div className={`flex-shrink-0 ${typeStyles[type].icon}`}>
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>

      <div className="flex justify-end space-x-4 mt-6">
        <button onClick={onClose} className="btn-outline">
          {cancelText}
        </button>
        <button onClick={onConfirm} className={typeStyles[type].button}>
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
