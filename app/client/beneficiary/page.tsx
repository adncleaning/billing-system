"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { Users, User, Phone, Mail, Heart, Save } from "lucide-react"

export default function BeneficiaryPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.co.uk/v1/api/"
  const { user, token } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    relationship: "",
    phone: "",
  })

  useEffect(() => {
    if (user?.clientData?.beneficiary) {
      setFormData({
        name: user.clientData.beneficiary.name || "",
        relationship: user.clientData.beneficiary.relationship || "",
        phone: user.clientData.beneficiary.phone || "",
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `jwt ${token}`, // Cambiar de Bearer a jwt
        },
        body: JSON.stringify({
          clientData: {
            ...user?.clientData,
            beneficiary: formData,
          },
        }),
      })

      const data = await response.json()

      if (data.success) {
        showToast("Beneficiary information updated successfully", "success")
      } else {
        showToast(data.message || "Error updating beneficiary information", "error")
      }
    } catch (error) {
      showToast("Error updating beneficiary information", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Beneficiary Information</h1>
        <p className="text-gray-600 mt-2">Manage your beneficiary details</p>
      </div>

      <div className="card p-8 max-w-2xl">
        <div className="flex items-center mb-6">
          <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mr-4">
            <Users className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Beneficiary Details</h2>
            <p className="text-gray-600">Person designated to receive benefits</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 inline mr-2" />
              Beneficiary Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="Enter beneficiary's full name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Heart className="h-4 w-4 inline mr-2" />
              Relationship
            </label>
            <select
              value={formData.relationship}
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
              className="input"
            >
              <option value="">Select relationship</option>
              <option value="Spouse">Spouse</option>
              <option value="Child">Child</option>
              <option value="Parent">Parent</option>
              <option value="Sibling">Sibling</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="h-4 w-4 inline mr-2" />
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
              placeholder="Enter beneficiary's phone number"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-blue-900">Important Information</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Your beneficiary information is used for emergency contacts and benefit distribution. Please ensure
                  all information is accurate and up to date.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-primary flex items-center">
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save Beneficiary Info"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
