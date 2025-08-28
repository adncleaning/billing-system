"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import Table from "@/components/Table"
import Modal from "@/components/Modal"
import { Plus, Calculator, DollarSign, Calendar, FileText, Banknote, CreditCard, Smartphone, Check } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.com/v1/api"

interface Payment {
  _id: string
  invoice: {
    invoiceNumber: string
    client: {
      name: string
    }
  }
  amount: number
  paymentMethod: "cash" | "card" | "transfer" | "check" | "other"
  paymentDetails: string
  paymentDate: string
  notes?: string
  cashClosure?: string // Agregar esta línea - ID del cash closure si existe
}

interface CashClosure {
  _id: string
  closureDate: string
  payments: Payment[]
  totalCash: number
  totalCard: number
  totalTransfer: number
  totalOther: number
  grandTotal: number
  notes?: string
  status: "open" | "closed"
}

export default function CashClosurePage() {
  const [availablePayments, setAvailablePayments] = useState<Payment[]>([])
  const [cashClosures, setCashClosures] = useState<CashClosure[]>([])
  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState("")
  const { user, token } = useAuth()
  const { showToast } = useToast()

  const fetchAvailablePayments = async () => {
    try {
      const response = await fetch(`${API_URL}/payments/driver/${user?.id}`, {
        headers: { Authorization: `jwt ${token}` }, // Updated from Bearer to jwt
      })
      const data = await response.json()
      if (data.success) {
        // Filter payments that haven't been included in a cash closure
        const unclosedPayments = data.payments.filter((payment: Payment) => !payment.cashClosure)
        setAvailablePayments(unclosedPayments)
      }
    } catch (error) {
      showToast("Error loading payments", "error")
    }
  }

  const fetchCashClosures = async () => {
    try {
      const response = await fetch(`${API_URL}/cash-closures/driver/${user?.id}`, {
        headers: { Authorization: `jwt ${token}` }, // Updated from Bearer to jwt
      })
      const data = await response.json()
      if (data.success) {
        setCashClosures(data.closures)
      }
    } catch (error) {
      showToast("Error loading cash closures", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token && user) {
      fetchAvailablePayments()
      fetchCashClosures()
    }
  }, [token, user])

  const handlePaymentSelection = (paymentId: string) => {
    setSelectedPayments((prev) =>
      prev.includes(paymentId) ? prev.filter((id) => id !== paymentId) : [...prev, paymentId],
    )
  }

  const calculateTotals = () => {
    const selectedPaymentObjects = availablePayments.filter((p) => selectedPayments.includes(p._id))

    const totals = selectedPaymentObjects.reduce(
      (acc, payment) => {
        switch (payment.paymentMethod) {
          case "cash":
            acc.totalCash += payment.amount
            break
          case "card":
            acc.totalCard += payment.amount
            break
          case "transfer":
            acc.totalTransfer += payment.amount
            break
          default:
            acc.totalOther += payment.amount
        }
        acc.grandTotal += payment.amount
        return acc
      },
      {
        totalCash: 0,
        totalCard: 0,
        totalTransfer: 0,
        totalOther: 0,
        grandTotal: 0,
      },
    )

    return totals
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedPayments.length === 0) {
      showToast("Please select at least one payment", "error")
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/cash-closures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `jwt ${token}`, // Updated from Bearer to jwt
        },
        body: JSON.stringify({
          paymentIds: selectedPayments,
          notes,
        }),
      })

      const data = await response.json()

      if (data.success) {
        showToast("Cash closure created successfully", "success")
        setShowCreateModal(false)
        setSelectedPayments([])
        setNotes("")
        fetchAvailablePayments()
        fetchCashClosures()
      } else {
        showToast(data.message || "Error creating cash closure", "error")
      }
    } catch (error) {
      showToast("Error creating cash closure", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "cash":
        return <Banknote className="h-4 w-4 text-green-600" />
      case "card":
        return <CreditCard className="h-4 w-4 text-blue-600" />
      case "transfer":
        return <Smartphone className="h-4 w-4 text-purple-600" />
      case "check":
        return <FileText className="h-4 w-4 text-orange-600" />
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />
    }
  }

  const paymentColumns = [
    {
      key: "select",
      label: "Select",
      render: (_: any, row: Payment) => (
        <input
          type="checkbox"
          checked={selectedPayments.includes(row._id)}
          onChange={() => handlePaymentSelection(row._id)}
          className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
        />
      ),
    },
    {
      key: "invoice",
      label: "Invoice",
      render: (_: any, row: Payment) => (
        <div>
          <div className="flex items-center">
            <FileText className="h-4 w-4 text-gray-400 mr-2" />
            <span className="font-medium">{row.invoice.invoiceNumber}</span>
          </div>
          <div className="text-sm text-gray-500">{row.invoice.client.name}</div>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (value: number) => (
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          <span className="font-medium">${value.toFixed(2)}</span>
        </div>
      ),
    },
    {
      key: "paymentMethod",
      label: "Method",
      render: (value: string) => (
        <div className="flex items-center">
          {getPaymentMethodIcon(value)}
          <span className="ml-2 capitalize">{value}</span>
        </div>
      ),
    },
    {
      key: "paymentDate",
      label: "Date",
      render: (value: string) => (
        <div className="flex items-center">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          {new Date(value).toLocaleDateString()}
        </div>
      ),
    },
  ]

  const closureColumns = [
    {
      key: "closureDate",
      label: "Date",
      render: (value: string) => (
        <div className="flex items-center">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          {new Date(value).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: "payments",
      label: "Payments",
      render: (value: Payment[]) => <span className="font-medium">{value.length} payments</span>,
    },
    {
      key: "grandTotal",
      label: "Total Amount",
      render: (value: number) => (
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          <span className="font-medium text-green-600">${value.toFixed(2)}</span>
        </div>
      ),
    },
    {
      key: "breakdown",
      label: "Breakdown",
      render: (_: any, row: CashClosure) => (
        <div className="text-sm space-y-1">
          <div className="flex items-center">
            <Banknote className="h-3 w-3 text-green-600 mr-1" />
            <span>Cash: ${row.totalCash.toFixed(2)}</span>
          </div>
          <div className="flex items-center">
            <CreditCard className="h-3 w-3 text-blue-600 mr-1" />
            <span>Card: ${row.totalCard.toFixed(2)}</span>
          </div>
          {row.totalTransfer > 0 && (
            <div className="flex items-center">
              <Smartphone className="h-3 w-3 text-purple-600 mr-1" />
              <span>Transfer: ${row.totalTransfer.toFixed(2)}</span>
            </div>
          )}
          {row.totalOther > 0 && (
            <div className="flex items-center">
              <FileText className="h-3 w-3 text-orange-600 mr-1" />
              <span>Other: ${row.totalOther.toFixed(2)}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value: string) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            value === "closed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
  ]

  const totals = calculateTotals()

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cash Closure</h1>
          <p className="text-gray-600 mt-2">Create cash closure reports for your collected payments</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center"
          disabled={availablePayments.length === 0}
        >
          <Plus className="h-5 w-5 mr-2" />
          New Cash Closure
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Available Payments</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{availablePayments.length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Closures</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{cashClosures.length}</p>
            </div>
            <Calculator className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unclosed Amount</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">
                ${availablePayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                {cashClosures.filter((c) => new Date(c.closureDate).getMonth() === new Date().getMonth()).length}
              </p>
            </div>
            <Check className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Cash Closures History */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Cash Closure History</h2>
          <span className="text-sm text-gray-500">
            {cashClosures.length} closure{cashClosures.length !== 1 ? "s" : ""} created
          </span>
        </div>

        <Table
          columns={closureColumns}
          data={cashClosures}
          loading={loading}
          emptyMessage="No cash closures created yet."
        />
      </div>

      {/* Create Cash Closure Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Cash Closure"
        size="xlarge"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Select Payments to Include</h3>
            <div className="max-h-96 overflow-y-auto">
              <Table
                columns={paymentColumns}
                data={availablePayments}
                loading={false}
                emptyMessage="No payments available for cash closure."
              />
            </div>
          </div>

          {selectedPayments.length > 0 && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Cash Closure Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Banknote className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600">Cash</p>
                  <p className="text-xl font-bold text-green-600">${totals.totalCash.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <CreditCard className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-600">Card</p>
                  <p className="text-xl font-bold text-blue-600">${totals.totalCard.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Smartphone className="h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-600">Transfer</p>
                  <p className="text-xl font-bold text-purple-600">${totals.totalTransfer.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <DollarSign className="h-6 w-6 text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-600">Other</p>
                  <p className="text-xl font-bold text-gray-600">${totals.totalOther.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-600">Grand Total</p>
                <p className="text-2xl font-bold text-gray-900">${totals.grandTotal.toFixed(2)}</p>
                <p className="text-sm text-gray-500">{selectedPayments.length} payments selected</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              rows={3}
              placeholder="Additional notes for this cash closure..."
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={submitting || selectedPayments.length === 0} className="btn-primary">
              {submitting ? "Creating..." : "Create Cash Closure"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
