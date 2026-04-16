"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useAuth, Api } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { useRouter } from "next/navigation"
import Table from "@/components/Table"
import Modal from "@/components/Modal"
import {
  Plus,
  Mail,
  Phone,
  User,
  FileText,
  Trash2,
  Pencil,
  Upload,
  X,
  FileCheck,
  Eye,
  Loader2,
} from "lucide-react"
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

interface RawBeneficiary {
  name?: string
  relationship?: string
  phone?: string
  email?: string
  identification?: string
  address?: string

  entityType?: string
  firstName?: string | null
  lastName?: string | null
  companyName?: string | null
  mobile?: string | null
  addressLine?: string | null
  cityLabel?: string | null
  zipCode?: string | null
}

interface RawClient {
  _id: string
  name?: string
  email?: string
  phone?: string
  identification?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
  }
  profile?: {
    entityType?: string
    firstName?: string | null
    lastName?: string | null
    companyName?: string | null
    identification?: string | null
    email?: string | null
    phone?: string | null
    mobile?: string | null
    addressLine?: string | null
    cityLabel?: string | null
    zipCode?: string | null
  }
  beneficiaries?: RawBeneficiary[]
  createdAt: string
  createdBy?: {
    username?: string
    _id?: string
  }
  ecuadorCustomsVerificationDocument?: CustomsVerificationDocument | null
}

interface CustomsVerificationDocument {
  originalName?: string | null
  filename?: string | null
  mimeType?: string | null
  size?: number | null
  path?: string | null
  uploadedAt?: string | null
  uploadedBy?: {
    _id?: string
    username?: string
    email?: string
  } | null
}

const EMPTY_BENEFICIARY: Beneficiary = {
  name: "",
  relationship: "",
  phone: "",
  email: "",
  identification: "",
  address: "",
}

const EMPTY_FORM_DATA: ClientFormData = {
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
  beneficiaries: [{ ...EMPTY_BENEFICIARY }],
}

const getDisplayName = (value?: {
  name?: string
  firstName?: string | null
  lastName?: string | null
  companyName?: string | null
}) => {
  if (value?.name?.trim()) return value.name.trim()
  if (value?.companyName?.trim()) return value.companyName.trim()

  const fullName = [value?.firstName, value?.lastName].filter(Boolean).join(" ").trim()
  return fullName || ""
}

const normalizeBeneficiary = (beneficiary: RawBeneficiary): Beneficiary => ({
  name: getDisplayName(beneficiary) || "",
  relationship: beneficiary.relationship || "",
  phone: beneficiary.phone || beneficiary.mobile || "",
  email: beneficiary.email || "",
  identification: beneficiary.identification || "",
  address:
    beneficiary.address ||
    [beneficiary.addressLine, beneficiary.cityLabel, beneficiary.zipCode]
      .filter(Boolean)
      .join(", ")
      .trim(),
})

const normalizeClient = (client: RawClient): Client => {
  const normalizedName = client.name || getDisplayName(client.profile) || "Unnamed client"

  return {
    _id: client._id,
    name: normalizedName,
    email: client.email || client.profile?.email || "",
    phone: client.phone || client.profile?.phone || client.profile?.mobile || "",
    identification: client.identification || client.profile?.identification || "",
    address: {
      street: client.address?.street || client.profile?.addressLine || "",
      city: client.address?.city || client.profile?.cityLabel || "",
      state: client.address?.state || "",
      zipCode: client.address?.zipCode || client.profile?.zipCode || "",
    },
    beneficiaries: Array.isArray(client.beneficiaries)
      ? client.beneficiaries.map(normalizeBeneficiary)
      : [],
    createdAt: client.createdAt,
    createdBy: {
      username: client.createdBy?.username || "",
    },
  }
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState<ClientFormData>(EMPTY_FORM_DATA)
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

  // Documento de aduana Ecuador
  const [ecuadorCustomsFile, setEcuadorCustomsFile] = useState<File | null>(null)
  const [ecuadorCustomsFileError, setEcuadorCustomsFileError] = useState<string>("")
  const [existingCustomsDocument, setExistingCustomsDocument] =
    useState<CustomsVerificationDocument | null>(null)
  const [loadingCustomsDocument, setLoadingCustomsDocument] = useState(false)
  const [uploadingCustomsDocument, setUploadingCustomsDocument] = useState(false)
  const [deletingCustomsDocument, setDeletingCustomsDocument] = useState(false)
  const customsFileInputRef = useRef<HTMLInputElement | null>(null)

  // Paginación
  const [currentPage, setCurrentPage] = useState<number>(1)
  const PAGE_SIZE = 10

  const resetForm = () => {
    setFormData({
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
      beneficiaries: [{ ...EMPTY_BENEFICIARY }],
    })
  }

  const resetCertificateModalState = () => {
    setSelectedClientId(null)
    setAttachPassport(true)
    setSelectedBeneficiaryIndex(0)
    setEcuadorCustomsFile(null)
    setEcuadorCustomsFileError("")
    setExistingCustomsDocument(null)
    setLoadingCustomsDocument(false)
    setUploadingCustomsDocument(false)
    setDeletingCustomsDocument(false)

    if (customsFileInputRef.current) {
      customsFileInputRef.current.value = ""
    }

    sigCanvasRef.current?.clear()
  }

  const getAuthToken = () => {
    let authToken = token

    if (!authToken && typeof window !== "undefined") {
      authToken = localStorage.getItem("token")
    }

    return authToken
  }

  const validateCustomsFile = (file: File) => {
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ]

    const maxSizeInMb = 10
    const maxSizeInBytes = maxSizeInMb * 1024 * 1024

    if (!allowedTypes.includes(file.type)) {
      return "Only PDF, PNG, JPG, JPEG, or WEBP files are allowed."
    }

    if (file.size > maxSizeInBytes) {
      return `The file must be smaller than ${maxSizeInMb}MB.`
    }

    return ""
  }

  const fetchCustomsDocument = async (clientId: string) => {
    try {
      const authToken = getAuthToken()

      if (!authToken) {
        showToast("Sesión no válida. Inicia sesión nuevamente.", "error")
        return
      }

      setLoadingCustomsDocument(true)
      setExistingCustomsDocument(null)
      setEcuadorCustomsFile(null)
      setEcuadorCustomsFileError("")

      const res = await fetch(`${API_URL}/clients/${clientId}/customs-verification-document`, {
        method: "GET",
        headers: {
          Authorization: `jwt ${authToken}`,
        },
      })

      if (res.status === 404) {
        setExistingCustomsDocument(null)
        return
      }

      if (!res.ok) {
        throw new Error("Error loading customs verification document")
      }

      const data = await res.json()
      setExistingCustomsDocument(data.document || null)
    } catch (error: any) {
      console.error(error)
      showToast(error.message || "Error loading customs verification document", "error")
    } finally {
      setLoadingCustomsDocument(false)
    }
  }

  const openCertificateModal = async (clientId: string) => {
    setSelectedClientId(clientId)
    setAttachPassport(true)
    setSelectedBeneficiaryIndex(0)
    setEcuadorCustomsFile(null)
    setEcuadorCustomsFileError("")
    setExistingCustomsDocument(null)
    setShowCertificateModal(true)

    setTimeout(() => {
      sigCanvasRef.current?.clear()
    }, 0)

    await fetchCustomsDocument(clientId)
  }

  const closeCertificateModal = () => {
    setShowCertificateModal(false)
    resetCertificateModalState()
  }

  const uploadCustomsDocument = async (file: File) => {
    if (!selectedClientId) return

    try {
      const authToken = getAuthToken()

      if (!authToken) {
        showToast("Sesión no válida. Inicia sesión nuevamente.", "error")
        return
      }

      setUploadingCustomsDocument(true)

      const payload = new FormData()
      payload.append("file", file)

      const res = await fetch(
        `${API_URL}/clients/${selectedClientId}/customs-verification-document`,
        {
          method: "POST",
          headers: {
            Authorization: `jwt ${authToken}`,
          },
          body: payload,
        }
      )

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.message || "Error uploading customs verification document")
      }

      setExistingCustomsDocument(data?.document || null)
      setEcuadorCustomsFile(null)
      setEcuadorCustomsFileError("")

      if (customsFileInputRef.current) {
        customsFileInputRef.current.value = ""
      }

      showToast("Customs verification document uploaded successfully", "success")
    } catch (error: any) {
      console.error(error)
      setEcuadorCustomsFileError(error.message || "Error uploading file")
      showToast(error.message || "Error uploading customs verification document", "error")
    } finally {
      setUploadingCustomsDocument(false)
    }
  }

  const handleCustomsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {
      return
    }

    const validationError = validateCustomsFile(file)

    if (validationError) {
      setEcuadorCustomsFile(null)
      setEcuadorCustomsFileError(validationError)
      return
    }

    setEcuadorCustomsFile(file)
    setEcuadorCustomsFileError("")

    await uploadCustomsDocument(file)
  }

  const removeCustomsFile = async () => {
    if (!selectedClientId) return

    try {
      const authToken = getAuthToken()

      if (!authToken) {
        showToast("Sesión no válida. Inicia sesión nuevamente.", "error")
        return
      }

      setDeletingCustomsDocument(true)

      const res = await fetch(
        `${API_URL}/clients/${selectedClientId}/customs-verification-document`,
        {
          method: "DELETE",
          headers: {
            Authorization: `jwt ${authToken}`,
          },
        }
      )

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.message || "Error deleting customs verification document")
      }

      setExistingCustomsDocument(null)
      setEcuadorCustomsFile(null)
      setEcuadorCustomsFileError(
        "The Ecuador customs declaration verification document is required."
      )

      if (customsFileInputRef.current) {
        customsFileInputRef.current.value = ""
      }

      showToast("Customs verification document removed successfully", "success")
    } catch (error: any) {
      console.error(error)
      showToast(error.message || "Error deleting customs verification document", "error")
    } finally {
      setDeletingCustomsDocument(false)
    }
  }

  const openExistingCustomsDocument = async () => {
    try {
      if (!selectedClientId) return

      const authToken = getAuthToken()

      if (!authToken) {
        showToast("Sesión no válida. Inicia sesión nuevamente.", "error")
        return
      }

      const res = await fetch(
        `${API_URL}/clients/${selectedClientId}/customs-verification-document/file`,
        {
          method: "GET",
          headers: {
            Authorization: `jwt ${authToken}`,
          },
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message || "Error opening customs verification document")
      }

      const blob = await res.blob()
      const fileUrl = window.URL.createObjectURL(blob)

      const newWindow = window.open(fileUrl, "_blank")

      if (!newWindow) {
        showToast("Pop-up blocked by the browser. Please allow pop-ups and try again.", "error")
        window.URL.revokeObjectURL(fileUrl)
        return
      }

      setTimeout(() => {
        window.URL.revokeObjectURL(fileUrl)
      }, 60000)
    } catch (error: any) {
      console.error(error)
      showToast(error.message || "Error opening customs verification document", "error")
    }
  }

  const fetchClients = async () => {
    try {
      setLoading(true)

      const data: any = await Api("GET", "clients", null, router)

      if (data.success) {
        const rawClients: RawClient[] = Array.isArray(data.clients) ? data.clients : []

        const normalizedClients = rawClients
          .filter((client) => !!client.profile)
          .map((client) => normalizeClient(client))

        setClients(normalizedClients)
        setCurrentPage(1)
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

      const c = normalizeClient(data.client as RawClient)

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
            : [{ ...EMPTY_BENEFICIARY }],
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

      if (!existingCustomsDocument) {
        setEcuadorCustomsFileError(
          "The Ecuador customs declaration verification document is required."
        )
        showToast("You must upload the Ecuador customs declaration verification document.", "error")
        return
      }

      const authToken = getAuthToken()

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

        const data = await res.json().catch(() => null)
        throw new Error(data?.message || "Error al generar la carta")
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
      closeCertificateModal()
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
        resetForm()
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
          <span className="font-medium">{value || "Unnamed client"}</span>
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
            <span>{row.email || "No email"}</span>
          </div>
          <div className="flex items-center text-sm">
            <Phone className="h-3 w-3 text-gray-400 mr-2" />
            <span>{row.phone || "No phone"}</span>
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
                <p className="font-medium text-sm">{first.name || "Unnamed beneficiary"}</p>
                {first.relationship && (
                  <p className="text-xs text-gray-500">{first.relationship}</p>
                )}
                {extraCount > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    +{extraCount} more beneficiar{extraCount > 1 ? "ies" : "y"}
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
          <button
            type="button"
            onClick={() => loadClientForEdit(row._id)}
            className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600"
            title="Edit client"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => openCertificateModal(row._id)}
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

    const inName = (client.name || "").toLowerCase().includes(term)
    const inEmail = (client.email || "").toLowerCase().includes(term)
    const inPhone = (client.phone || "").toLowerCase().includes(term)
    const inIdentification = (client.identification || "").toLowerCase().includes(term)

    const inBeneficiaries =
      Array.isArray(client.beneficiaries) &&
      client.beneficiaries.some((b) =>
        [b.name, b.relationship, b.phone, b.email, b.identification, b.address]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term)),
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

  const currentClient = clients.find((c) => c._id === selectedClientId)
  const hasCustomsDocument = !!existingCustomsDocument

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
            resetForm()
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

        {filteredClients.length > PAGE_SIZE && (
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
                        onChange={(e) =>
                          updateBeneficiaryField(index, "relationship", e.target.value)
                        }
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
                      onChange={(e) => updateBeneficiaryField(index, "address", e.target.value)}
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

      <Modal
        isOpen={showCertificateModal}
        onClose={closeCertificateModal}
        title="Generate Certificate"
        size="large"
      >
        <div className="space-y-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <FileCheck className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900">
                  Required before continuing
                </h3>
                <p className="text-sm text-amber-800 mt-1">
                  Upload the Ecuador customs declaration verification document first. Until this
                  file is stored successfully, the rest of the form will remain locked.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              1. Ecuador customs declaration verification document
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Accepted formats: PDF, PNG, JPG, JPEG, WEBP. Maximum size: 10MB.
            </p>

            <input
              ref={customsFileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={handleCustomsFileChange}
              className="hidden"
            />

            {loadingCustomsDocument ? (
              <div className="w-full border border-gray-200 rounded-lg p-6 flex items-center justify-center gap-2 bg-white">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                <span className="text-sm text-gray-600">Loading existing document...</span>
              </div>
            ) : existingCustomsDocument ? (
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-800 truncate">
                    {existingCustomsDocument.originalName || "Uploaded document"}
                  </p>
                  <div className="text-xs text-green-700 mt-1 space-y-1">
                    {typeof existingCustomsDocument.size === "number" && (
                      <p>{(existingCustomsDocument.size / 1024 / 1024).toFixed(2)} MB</p>
                    )}
                    {existingCustomsDocument.uploadedAt && (
                      <p>
                        Uploaded: {new Date(existingCustomsDocument.uploadedAt).toLocaleString()}
                      </p>
                    )}
                    {existingCustomsDocument.uploadedBy?.username && (
                      <p>By: {existingCustomsDocument.uploadedBy.username}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={openExistingCustomsDocument}
                    className="px-3 py-1.5 text-sm border rounded-md hover:bg-white flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() => customsFileInputRef.current?.click()}
                    disabled={uploadingCustomsDocument || deletingCustomsDocument}
                    className="px-3 py-1.5 text-sm border rounded-md hover:bg-white disabled:opacity-50"
                  >
                    {uploadingCustomsDocument ? "Uploading..." : "Replace"}
                  </button>

                  <button
                    type="button"
                    onClick={removeCustomsFile}
                    disabled={uploadingCustomsDocument || deletingCustomsDocument}
                    className="p-2 rounded-md border hover:bg-white text-red-600 disabled:opacity-50"
                    title="Remove file"
                  >
                    {deletingCustomsDocument ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => customsFileInputRef.current?.click()}
                disabled={uploadingCustomsDocument}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 hover:bg-blue-50 transition disabled:opacity-50"
              >
                <div className="flex flex-col items-center justify-center text-center">
                  {uploadingCustomsDocument ? (
                    <Loader2 className="h-8 w-8 text-gray-400 mb-2 animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {uploadingCustomsDocument ? "Uploading document..." : "Click to upload document"}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    Ecuador customs declaration verification document
                  </span>
                </div>
              </button>
            )}

            {ecuadorCustomsFileError && (
              <p className="text-sm text-red-600 mt-3">{ecuadorCustomsFileError}</p>
            )}
          </div>

          <div
            className={
              !hasCustomsDocument || loadingCustomsDocument || uploadingCustomsDocument
                ? "opacity-50 pointer-events-none select-none"
                : ""
            }
          >
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-2">2. Passport attachment</h3>
              <p className="text-sm text-gray-600 mb-3">
                Indica si adjuntaste una copia legible del pasaporte o cédula.
              </p>

              <div className="flex items-center space-x-6">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={attachPassport === true}
                    onChange={() => setAttachPassport(true)}
                    disabled={!hasCustomsDocument}
                  />
                  <span>Sí, está adjunto</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={attachPassport === false}
                    onChange={() => setAttachPassport(false)}
                    disabled={!hasCustomsDocument}
                  />
                  <span>No está adjunto</span>
                </label>
              </div>
            </div>

            {currentClient && currentClient.beneficiaries?.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4 bg-white mt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">3. Select beneficiary</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Selecciona el miembro del núcleo familiar que aparecerá como beneficiario en la
                  carta.
                </p>

                <select
                  className="input"
                  value={selectedBeneficiaryIndex}
                  onChange={(e) => setSelectedBeneficiaryIndex(Number(e.target.value))}
                  disabled={!hasCustomsDocument}
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

            <div className="border border-gray-200 rounded-lg p-4 bg-white mt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">4. Signature</h3>
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
                className="mt-2 text-sm text-gray-600 hover:underline disabled:opacity-50"
                onClick={() => sigCanvasRef.current?.clear()}
                disabled={!hasCustomsDocument}
              >
                Clear signature
              </button>
            </div>
          </div>

          {!hasCustomsDocument && !loadingCustomsDocument && (
            <p className="text-sm text-amber-700">
              Upload the required document to unlock the rest of this form.
            </p>
          )}

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button type="button" onClick={closeCertificateModal} className="btn-outline">
              Cancel
            </button>

            <button
              type="button"
              onClick={generateCertificate}
              className="btn-primary"
              disabled={
                generating || !hasCustomsDocument || loadingCustomsDocument || uploadingCustomsDocument
              }
            >
              {generating ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}