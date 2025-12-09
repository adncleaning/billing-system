"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useAuth, Api } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { useRouter } from "next/navigation"
import Table from "@/components/Table"
import Modal from "@/components/Modal"
import { Plus, Mail, Phone, User, FileText, Trash2, Pencil } from "lucide-react"
import SignatureCanvas from "react-signature-canvas"

interface Beneficiary {
  name: string
  relationship?: string
  phone?: string
  email?: string
  identification?: string
  address?: string
}

interface Client {
  _id: string
  name: string
  email: string
  phone: string
  identification?: string
  address: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
  }
  beneficiaries: Beneficiary[]
  createdAt: string
  createdBy?: {
    username: string
  }
}

interface ClientFormData {
  name: string
  email: string
  phone: string
  identification: string
  address: {
    street: string
    city: string
    state: string
    zipCode: string
  }
  beneficiaries: Beneficiary[]
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState<ClientFormData>({
    name: "",
    email: "",
    phone: "",
    identification: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
    },
    beneficiaries: [
      {
        name: "",
        relationship: "",
        phone: "",
        email: "",
        identification: "",
        address: "",
      },
    ],
  })
  const [submitting, setSubmitting] = useState(false)
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")


  const { token } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.co.uk/v1/api/"

  // Certificado
  const [showCertificateModal, setShowCertificateModal] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [attachPassport, setAttachPassport] = useState<boolean>(true)
  const sigCanvasRef = useRef<SignatureCanvas | null>(null)
  const [generating, setGenerating] = useState(false)
  const [selectedBeneficiaryIndex, setSelectedBeneficiaryIndex] = useState<number>(0)

  // Paginación
  const [currentPage, setCurrentPage] = useState<number>(1)
  const PAGE_SIZE = 10

  const fetchClients = async () => {
    try {
      const data: any = await Api("GET", "clients", null, router)
      if (data.success) {
        setClients(data.clients)
        setCurrentPage(1) // reset paginación al recargar
      } else {
        showToast("Error loading clients", "error")
      }
    } catch (error: any) {
      showToast(error.message || "Error loading clients", "error")
    } finally {
      setLoading(false)
    }
  }

  const loadClientForEdit = async (clientId: string) => {
    try {
      const data: any = await Api("GET", `clients/${clientId}`, null, router)

      if (!data.success) {
        showToast(data.message || "Error loading client", "error")
        return
      }

      const c = data.client as Client

      setFormData({
        name: c.name || "",
        email: c.email || "",
        phone: c.phone || "",
        identification: c.identification || "",
        address: {
          street: c.address?.street || "",
          city: c.address?.city || "",
          state: c.address?.state || "",
          zipCode: c.address?.zipCode || "",
        },
        beneficiaries:
          c.beneficiaries?.length > 0
            ? c.beneficiaries.map((b) => ({
              name: b.name || "",
              relationship: b.relationship || "",
              phone: b.phone || "",
              email: b.email || "",
              identification: b.identification || "",
              address: b.address || "",
            }))
            : [
              {
                name: "",
                relationship: "",
                phone: "",
                email: "",
                identification: "",
                address: "",
              },
            ],
      })

      setEditingClientId(clientId)
      setShowCreateModal(true)
    } catch (error: any) {
      console.error(error)
      showToast(error.message || "Error loading client", "error")
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
          beneficiaryIndex: selectedBeneficiaryIndex,
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
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        identification: formData.identification,
        address: formData.address,
        beneficiaries: formData.beneficiaries,
      }

      let data: any
      if (editingClientId) {
        data = await Api("PUT", `clients/${editingClientId}`, payload, router)
      } else {
        data = await Api("POST", "clients", payload, router)
      }

      if (data.success) {
        showToast(
          editingClientId ? "Client updated successfully" : "Client created successfully",
          "success",
        )
        setShowCreateModal(false)
        setEditingClientId(null)
        setFormData({
          name: "",
          email: "",
          phone: "",
          identification: "",
          address: { street: "", city: "", state: "", zipCode: "" },
          beneficiaries: [
            {
              name: "",
              relationship: "",
              phone: "",
              email: "",
              identification: "",
              address: "",
            },
          ],
        })
        fetchClients()
      } else {
        showToast(data.message || "Error saving client", "error")
      }
    } catch (error: any) {
      console.error(error)
      showToast(error.message || "Error saving client", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const updateFormField = (path: string, value: string) => {
    setFormData((prev) => {
      const keys = path.split(".")
      const newData: any = { ...prev }
      let current = newData

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] }
        current = current[keys[i]]
      }

      current[keys[keys.length - 1]] = value
      return newData
    })
  }

  const updateBeneficiaryField = (index: number, field: keyof Beneficiary, value: string) => {
    setFormData((prev) => {
      const newBeneficiaries = [...prev.beneficiaries]
      newBeneficiaries[index] = { ...newBeneficiaries[index], [field]: value }
      return { ...prev, beneficiaries: newBeneficiaries }
    })
  }

  const addBeneficiary = () => {
    setFormData((prev) => ({
      ...prev,
      beneficiaries: [
        ...prev.beneficiaries,
        {
          name: "",
          relationship: "",
          phone: "",
          email: "",
          identification: "",
          address: "",
        },
      ],
    }))
  }

  const removeBeneficiary = (index: number) => {
    setFormData((prev) => {
      if (prev.beneficiaries.length === 1) return prev
      const newBeneficiaries = prev.beneficiaries.filter((_, i) => i !== index)
      return { ...prev, beneficiaries: newBeneficiaries }
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
      key: "beneficiaries",
      label: "Beneficiaries",
      render: (_: any, row: Client) => {
        const first = row.beneficiaries?.[0]
        const extraCount = (row.beneficiaries?.length || 0) - 1
        return (
          <div>
            {first ? (
              <>
                <p className="font-medium text-sm">{first.name}</p>
                {first.relationship && <p className="text-xs text-gray-500">{first.relationship}</p>}
                {extraCount > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    +{extraCount} more beneficiary{extraCount > 1 ? "ies" : ""}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400 italic">No beneficiaries</p>
            )}
          </div>
        )
      },
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
        <div className="flex items-center space-x-2">
          {/* Edit button (icon) */}
          <button
            type="button"
            onClick={() => loadClientForEdit(row._id)}
            className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600"
            title="Edit client"
          >
            <Pencil className="h-4 w-4" />
          </button>

          {/* Generate certificate button (icon) */}
          <button
            type="button"
            onClick={() => {
              setSelectedClientId(row._id)
              setAttachPassport(true)
              setSelectedBeneficiaryIndex(0)
              setShowCertificateModal(true)
            }}
            className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 text-blue-600"
            title="Generate certificate"
          >
            <FileText className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]
  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return true

    const inName = client.name?.toLowerCase().includes(term)
    const inEmail = client.email?.toLowerCase().includes(term)
    const inPhone = client.phone?.toLowerCase().includes(term)
    const inIdentification = client.identification?.toLowerCase().includes(term)

    const inBeneficiaries =
      client.beneficiaries &&
      client.beneficiaries.some((b) =>
        [
          b.name,
          b.relationship,
          b.phone,
          b.email,
          b.identification,
          b.address,
        ]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(term)),
      )

    return inName || inEmail || inPhone || inIdentification || inBeneficiaries
  })

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))

  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])


  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-2">Manage your clients and their information</p>
        </div>
        <button
          onClick={() => {
            setEditingClientId(null)
            setFormData({
              name: "",
              email: "",
              phone: "",
              identification: "",
              address: { street: "", city: "", state: "", zipCode: "" },
              beneficiaries: [
                {
                  name: "",
                  relationship: "",
                  phone: "",
                  email: "",
                  identification: "",
                  address: "",
                },
              ],
            })
            setShowCreateModal(true)
          }}
          className="btn-primary flex items-center"
        >
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
        {/* 🔍 Buscador */}
        
        <div className="w-full md:w-64 mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
            placeholder="Search by name, email, phone..."
          />
        </div>

        <Table
          columns={columns}
          data={paginatedClients}
          loading={loading}
          emptyMessage="No clients found. Create your first client to get started."
        />

        {/* Controles de paginación */}
        {clients.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Client Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setEditingClientId(null)
        }}
        title={editingClientId ? "Edit Client" : "Create New Client"}
        size="large"
      >
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
                  onChange={(e) => updateFormField("name", e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormField("email", e.target.value)}
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
                  onChange={(e) => updateFormField("phone", e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Identification *</label>
                <input
                  type="text"
                  value={formData.identification}
                  onChange={(e) => updateFormField("identification", e.target.value)}
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
                  onChange={(e) => updateFormField("address.street", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={formData.address.city}
                  onChange={(e) => updateFormField("address.city", e.target.value)}
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
                  onChange={(e) => updateFormField("address.state", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
                <input
                  type="text"
                  value={formData.address.zipCode}
                  onChange={(e) => updateFormField("address.zipCode", e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Beneficiaries */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Beneficiaries</h3>
              <button
                type="button"
                className="btn-outline text-sm flex items-center"
                onClick={addBeneficiary}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Beneficiary
              </button>
            </div>

            <div className="space-y-4">
              {formData.beneficiaries.map((beneficiary, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold">Beneficiary #{index + 1}</p>
                    {formData.beneficiaries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBeneficiary(index)}
                        className="flex items-center text-xs text-red-600 hover:underline"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Beneficiary Name *
                      </label>
                      <input
                        type="text"
                        value={beneficiary.name}
                        onChange={(e) => updateBeneficiaryField(index, "name", e.target.value)}
                        className="input"
                        required={index === 0}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Relationship
                      </label>
                      <input
                        type="text"
                        value={beneficiary.relationship || ""}
                        onChange={(e) => updateBeneficiaryField(index, "relationship", e.target.value)}
                        className="input"
                        placeholder="e.g., Spouse, Child, etc."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Beneficiary Phone
                      </label>
                      <input
                        type="tel"
                        value={beneficiary.phone || ""}
                        onChange={(e) => updateBeneficiaryField(index, "phone", e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Beneficiary Email
                      </label>
                      <input
                        type="email"
                        value={beneficiary.email || ""}
                        onChange={(e) => updateBeneficiaryField(index, "email", e.target.value)}
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
                      value={beneficiary.identification || ""}
                      onChange={(e) =>
                        updateBeneficiaryField(index, "identification", e.target.value)
                      }
                      className="input"
                      placeholder="e.g., ID number, passport, etc."
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Beneficiary Address
                    </label>
                    <input
                      type="text"
                      value={beneficiary.address || ""}
                      onChange={(e) =>
                        updateBeneficiaryField(index, "address", e.target.value)
                      }
                      className="input"
                      placeholder="e.g., Full address of the beneficiary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false)
                setEditingClientId(null)
              }}
              className="btn-outline"
            >
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Saving..." : editingClientId ? "Update Client" : "Create Client"}
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
          {(() => {
            const currentClient = clients.find((c) => c._id === selectedClientId)

            return (
              <>
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

                {currentClient && currentClient.beneficiaries?.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Select beneficiary
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Selecciona el miembro del núcleo familiar que aparecerá como beneficiario en
                      la carta.
                    </p>

                    <select
                      className="input"
                      value={selectedBeneficiaryIndex}
                      onChange={(e) => setSelectedBeneficiaryIndex(Number(e.target.value))}
                    >
                      {currentClient.beneficiaries.map((b, index) => (
                        <option key={index} value={index}>
                          {`#${index + 1} - ${b.name || "Sin nombre"}${b.relationship ? ` (${b.relationship})` : ""
                            }`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Signature</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Firma dentro del recuadro. Esta firma se insertará en el documento.
                  </p>
                  <div className="border border-gray-300 rounded-md p-2 bg-white">
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
              </>
            )
          })()}

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
