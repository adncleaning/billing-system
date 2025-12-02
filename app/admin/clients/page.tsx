"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useAuth, Api } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { useRouter } from "next/navigation"
import Table from "@/components/Table"
import Modal from "@/components/Modal"
import { Plus, Mail, Phone, User, FileText } from "lucide-react"
import SignatureCanvas from "react-signature-canvas"

interface Client {
  _id: string
  name: string
  email: string
  phone: string
  identification: ""
  address: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
  }
  beneficiary: {
    name: string
    relationship?: string
    phone?: string
    email?: string
    identification?: string   // 👈 NUEVO
  }
  createdAt: string
  createdBy?: {
    username: string
  }
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    identification: "", // 👈 NUEVO
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
    },
    beneficiary: {
      name: "",
      relationship: "",
      phone: "",
      email: "",
      identification: "", // 👈 NUEVO
    },
  })
  const [submitting, setSubmitting] = useState(false)
  const { token } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.co.uk/v1/api/"
  const [showCertificateModal, setShowCertificateModal] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [attachPassport, setAttachPassport] = useState<boolean>(true)
  const sigCanvasRef = useRef<SignatureCanvas | null>(null)
  const [generating, setGenerating] = useState(false)

  const fetchClients = async () => {
    try {
      const data: any = await Api("GET", "clients", null, router)
      if (data.success) {
        setClients(data.clients)
      } else {
        showToast("Error loading clients", "error")
      }
    } catch (error: any) {
      showToast(error.message || "Error loading clients", "error")
    } finally {
      setLoading(false)
    }
  }
  const generateCertificate = async () => {
    try {
      if (!selectedClientId) return

      let authToken = token
      if (!authToken && typeof window !== "undefined") {
        authToken = localStorage.getItem("token")
      }

      if (!authToken) {
        showToast("Sesión no válida. Inicia sesión nuevamente.", "error")
        return
      }

      if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
        showToast("Por favor firma antes de generar el documento.", "error")
        return
      }

      setGenerating(true)

      const signatureDataUrl = sigCanvasRef.current.toDataURL("image/png")

      const res = await fetch(`${API_URL}/clients/${selectedClientId}/certificate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `jwt ${authToken}`,
        },
        body: JSON.stringify({
          attachPassport,
          signature: signatureDataUrl,
        }),
      })

      if (!res.ok) {
        if (res.status === 401) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("token")
            localStorage.removeItem("user")
            router.push("/")
          }
        }
        throw new Error("Error al generar la carta")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `certificado_${selectedClientId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      showToast("Carta generada correctamente", "success")
      setShowCertificateModal(false)
    } catch (error: any) {
      console.error(error)
      showToast(error.message || "Error al generar la carta", "error")
    } finally {
      setGenerating(false)
    }
  }


  useEffect(() => {
    if (token) {
      fetchClients()
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const data: any = await Api("POST", "clients", formData, router)
      if (data.success) {
        showToast("Client created successfully", "success")
        setShowCreateModal(false)
        setFormData({
          name: "",
          email: "",
          phone: "",
          identification: "",    // 👈 NUEVO
          address: { street: "", city: "", state: "", zipCode: "" },
          beneficiary: { name: "", relationship: "", phone: "", email: "", identification: "" },
        })
        fetchClients()
      } else {
        showToast(data.message || "Error creating client", "error")
      }
    } catch (error: any) {
      showToast(error.message || "Error creating client", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const updateFormData = (path: string, value: string) => {
    setFormData((prev) => {
      const keys = path.split(".")
      const newData = { ...prev }
      let current: any = newData

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }

      current[keys[keys.length - 1]] = value
      return newData
    })
  }

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (value: string) => (
        <div className="flex items-center">
          <User className="h-5 w-5 text-gray-400 mr-2" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      render: (_: any, row: Client) => (
        <div className="space-y-1">
          <div className="flex items-center text-sm">
            <Mail className="h-3 w-3 text-gray-400 mr-2" />
            {row.email}
          </div>
          <div className="flex items-center text-sm">
            <Phone className="h-3 w-3 text-gray-400 mr-2" />
            {row.phone}
          </div>
        </div>
      ),
    },
    {
      key: "beneficiary",
      label: "Beneficiary",
      render: (_: any, row: Client) => (
        <div>
          <p className="font-medium text-sm">{row.beneficiary.name}</p>
          {row.beneficiary.relationship && <p className="text-xs text-gray-500">{row.beneficiary.relationship}</p>}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: Client) => (
        <button
          type="button"
          onClick={() => {
            setSelectedClientId(row._id)
            setAttachPassport(true) // por defecto "Sí"
            setShowCertificateModal(true)
          }}
          className="inline-flex items-center text-sm text-blue-600 hover:underline"
        >
          <FileText className="h-4 w-4 mr-1" />
          Generate letter
        </button>
      ),
    }

  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-2">Manage your clients and their information</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          New Client
        </button>
      </div>

      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Client List</h2>
          <span className="text-sm text-gray-500">
            {clients.length} client{clients.length !== 1 ? "s" : ""} total
          </span>
        </div>

        <Table
          columns={columns}
          data={clients}
          loading={loading}
          emptyMessage="No clients found. Create your first client to get started."
        />
      </div>

      {/* Create Client Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Client" size="large">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData("name", e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData("phone", e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Identification *</label>
                <input
                  type="text"
                  value={formData.identification}
                  onChange={(e) => updateFormData("identification", e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>


            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                <input
                  type="text"
                  value={formData.address.street}
                  onChange={(e) => updateFormData("address.street", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={formData.address.city}
                  onChange={(e) => updateFormData("address.city", e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <input
                  type="text"
                  value={formData.address.state}
                  onChange={(e) => updateFormData("address.state", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
                <input
                  type="text"
                  value={formData.address.zipCode}
                  onChange={(e) => updateFormData("address.zipCode", e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Beneficiary Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Beneficiary Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Beneficiary Name *</label>
                <input
                  type="text"
                  value={formData.beneficiary.name}
                  onChange={(e) => updateFormData("beneficiary.name", e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Relationship</label>
                <input
                  type="text"
                  value={formData.beneficiary.relationship}
                  onChange={(e) => updateFormData("beneficiary.relationship", e.target.value)}
                  className="input"
                  placeholder="e.g., Spouse, Child, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Beneficiary Phone</label>
                <input
                  type="tel"
                  value={formData.beneficiary.phone}
                  onChange={(e) => updateFormData("beneficiary.phone", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Beneficiary Email</label>
                <input
                  type="email"
                  value={formData.beneficiary.email}
                  onChange={(e) => updateFormData("beneficiary.email", e.target.value)}
                  className="input"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beneficiary Identification
              </label>
              <input
                type="text"
                value={formData.beneficiary.identification}
                onChange={(e) => updateFormData("beneficiary.identification", e.target.value)}
                className="input"
                placeholder="e.g., ID number, passport, etc."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Creating..." : "Create Client"}
            </button>
          </div>
        </form>
      </Modal>
      {/* Modal para generar carta */}
      <Modal
        isOpen={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        title="Generate Certificate"
        size="large"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Passport attachment
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Indica si adjuntaste una copia legible del pasaporte o cédula.
            </p>
            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={attachPassport === true}
                  onChange={() => setAttachPassport(true)}
                />
                <span>Sí, está adjunto</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={attachPassport === false}
                  onChange={() => setAttachPassport(false)}
                />
                <span>No está adjunto</span>
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Signature</h3>
            <p className="text-sm text-gray-600 mb-3">
              Firma dentro del recuadro. Esta firma se insertará en el documento.
            </p>
            <div className="border border-gray-300 rounded-md p-2 bg-white">
              {/* Signature canvas */}
              <SignatureCanvas
                ref={sigCanvasRef}
                penColor="black"
                canvasProps={{
                  width: 500,
                  height: 150,
                  className: "w-full h-40",
                }}
              />
            </div>
            <button
              type="button"
              className="mt-2 text-sm text-gray-600 hover:underline"
              onClick={() => sigCanvasRef.current?.clear()}
            >
              Clear signature
            </button>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowCertificateModal(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={generateCertificate}
              className="btn-primary"
              disabled={generating}
            >
              {generating ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
