"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.com/v1/api"

interface CreateClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientCreated: () => void
}

export function CreateClientDialog({ open, onOpenChange, onClientCreated }: CreateClientDialogProps) {
  const [loading, setLoading] = useState(false)
  const { token } = useAuth()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: { street: "", city: "", state: "", zipCode: "" },
    beneficiary: { name: "", relationship: "", phone: "", email: "" },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log("Sending data:", formData)
      console.log("Token:", token ? "Present" : "Missing")

      const response = await fetch(`${API_URL}/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `jwt ${token}`, // Asegurar que hay espacio después de jwt
        },
        body: JSON.stringify(formData),
      })

      console.log("Response status:", response.status)

      const data = await response.json()
      console.log("Response data:", data)

      if (response.ok && data.success) {
        toast({
          title: "Éxito",
          description: "Cliente creado exitosamente",
          variant: "default",
        })
        onClientCreated()
        onOpenChange(false)
        setFormData({
          name: "",
          email: "",
          phone: "",
          address: { street: "", city: "", state: "", zipCode: "" },
          beneficiary: { name: "", relationship: "", phone: "", email: "" },
        })
      } else {
        // Manejar diferentes tipos de errores
        let errorMessage = "Error al crear cliente"

        if (response.status === 401) {
          errorMessage = "No autorizado. Por favor, inicia sesión nuevamente."
        } else if (response.status === 400) {
          errorMessage = data.message || "Datos inválidos"
        } else if (response.status === 500) {
          errorMessage = "Error interno del servidor. Verifica los logs del backend."
        } else if (data.message) {
          errorMessage = data.message
        }

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Network error:", error)
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor. Verifica tu conexión a internet.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Cliente</DialogTitle>
          <DialogDescription>Completa la información del cliente y su beneficiario</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información del Cliente */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Información del Cliente</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateFormData("name", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateFormData("phone", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="street">Dirección</Label>
                <Input
                  id="street"
                  value={formData.address.street}
                  onChange={(e) => updateFormData("address.street", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  value={formData.address.city}
                  onChange={(e) => updateFormData("address.city", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.address.state}
                  onChange={(e) => updateFormData("address.state", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">Código Postal</Label>
                <Input
                  id="zipCode"
                  value={formData.address.zipCode}
                  onChange={(e) => updateFormData("address.zipCode", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Información del Beneficiario */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Información del Beneficiario</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="beneficiaryName">Nombre del Beneficiario *</Label>
                <Input
                  id="beneficiaryName"
                  value={formData.beneficiary.name}
                  onChange={(e) => updateFormData("beneficiary.name", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">Parentesco</Label>
                <Input
                  id="relationship"
                  value={formData.beneficiary.relationship}
                  onChange={(e) => updateFormData("beneficiary.relationship", e.target.value)}
                  placeholder="Ej: Esposo/a, Hijo/a, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="beneficiaryPhone">Teléfono del Beneficiario</Label>
                <Input
                  id="beneficiaryPhone"
                  value={formData.beneficiary.phone}
                  onChange={(e) => updateFormData("beneficiary.phone", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="beneficiaryEmail">Email del Beneficiario</Label>
                <Input
                  id="beneficiaryEmail"
                  type="email"
                  value={formData.beneficiary.email}
                  onChange={(e) => updateFormData("beneficiary.email", e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
