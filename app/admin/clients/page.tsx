"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth, Api } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { useRouter } from "next/navigation"
import Table from "@/components/Table"
import Modal from "@/components/Modal"
import { Plus, Mail, Phone, User } from "lucide-react"

interface Client {
  _id: string
  name: string
  email: string
  phone: string
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

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => updateFormData("phone", e.target.value)}
                className="input"
                required
              />
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
    </div>
  )
}
