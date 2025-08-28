"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import Table from "@/components/Table"
import Modal from "@/components/Modal"
import { Plus, DollarSign, FileText, Calendar, CreditCard, Banknote, Smartphone, Check } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.com/v1/api"

interface Invoice {
  _id: string
  invoiceNumber: string
  client: {
    name: string
    phone: string
  }
  total: number
  status: "pending" | "paid" | "partial" | "cancelled"
  dueDate: string
}

interface Payment {
  _id: string
  invoice: {
    invoiceNumber: string
    client: {
      name: string
    }
  }
  amount: number
  paymentMethod: string
  paymentDetails: string
  paymentDate: string
  notes?: string
}

export default function DriverPaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { user, token } = useAuth()
  const { showToast } = useToast()

  const [formData, setFormData] = useState({
    invoiceId: "",
    amount: "",
    paymentMethod: "cash",
    paymentDetails: "",
    notes: "",
  })

  const fetchInvoices = async () => {
    try {
      const response = await fetch(`${API_URL}/invoices`, {
        headers: { Authorization: `jwt ${token}` }, // Updated from Bearer to jwt
      })
      const data = await response.json()
      if (data.success) {
        // Filter only pending invoices for payment recording
        const pendingInvoices = data.invoices.filter((inv: Invoice) => inv.status === "pending")
        setInvoices(pendingInvoices)
      }
    } catch (error) {
      showToast("Error loading invoices", "error")
    }
  }

  const fetchPayments = async () => {
    try {
      const response = await fetch(`${API_URL}/payments/driver/${user?.id}`, {
        headers: { Authorization: `jwt ${token}` }, // Updated from Bearer to jwt
      })
      const data = await response.json()
      if (data.success) {
        setPayments(data.payments)
      }
    } catch (error) {
      showToast("Error loading payments", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token && user) {
      fetchInvoices()
      fetchPayments()
    }
  }, [token, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `jwt ${token}`, // Updated from Bearer to jwt
        },
        body: JSON.stringify({
          invoiceId: formData.invoiceId,
          amount: Number.parseFloat(formData.amount),
          paymentMethod: formData.paymentMethod,
          paymentDetails: formData.paymentDetails,
          notes: formData.notes,
        }),
      })

      const data = await response.json()

      if (data.success) {
        showToast("Payment recorded successfully", "success")
        setShowRecordModal(false)
        setFormData({
          invoiceId: "",
          amount: "",
          paymentMethod: "cash",
          paymentDetails: "",
          notes: "",
        })
        fetchInvoices()
        fetchPayments()
      } else {
        showToast(data.message || "Error recording payment", "error")
      }
    } catch (error) {
      showToast("Error recording payment", "error")
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

  const selectedInvoice = invoices.find((inv) => inv._id === formData.invoiceId)

  const invoiceColumns = [
    {
      key: "invoiceNumber",
      label: "Invoice #",
      render: (value: string) => (
        <div className="flex items-center">
          <FileText className="h-4 w-4 text-gray-400 mr-2" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "client",
      label: "Client",
      render: (_: any, row: Invoice) => (
        <div>
          <div className="font-medium">{row.client.name}</div>
          <div className="text-sm text-gray-500">{row.client.phone}</div>
        </div>
      ),
    },
    {
      key: "total",
      label: "Amount Due",
      render: (value: number) => (
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          <span className="font-medium text-red-600">${value.toFixed(2)}</span>
        </div>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      render: (value: string) => (
        <div className="flex items-center">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          {new Date(value).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: Invoice) => (
        <button
          onClick={() => {
            setFormData({ ...formData, invoiceId: row._id, amount: row.total.toString() })
            setShowRecordModal(true)
          }}
          className="btn-primary text-sm py-1 px-3"
        >
          Record Payment
        </button>
      ),
    },
  ]

  const paymentColumns = [
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
          <span className="font-medium text-green-600">${value.toFixed(2)}</span>
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

  const todayPayments = payments.filter(
    (payment) => new Date(payment.paymentDate).toDateString() === new Date().toDateString(),
  )
  const todayTotal = todayPayments.reduce((sum, payment) => sum + payment.amount, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Record Payments</h1>
          <p className="text-gray-600 mt-2">Record payments received from clients</p>
        </div>
        <button onClick={() => setShowRecordModal(true)} className="btn-primary flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          Record Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Invoices</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">{invoices.length}</p>
            </div>
            <FileText className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Collections</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{todayPayments.length}</p>
            </div>
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Amount</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">${todayTotal.toFixed(2)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">{payments.length}</p>
            </div>
            <CreditCard className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Pending Invoices */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Pending Invoices</h2>
          <span className="text-sm text-gray-500">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} awaiting payment
          </span>
        </div>

        <Table
          columns={invoiceColumns}
          data={invoices}
          loading={loading}
          emptyMessage="No pending invoices found. All invoices have been paid!"
        />
      </div>

      {/* Recent Payments */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Payments</h2>
          <span className="text-sm text-gray-500">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} recorded
          </span>
        </div>

        <Table
          columns={paymentColumns}
          data={payments.slice(0, 10)}
          loading={loading}
          emptyMessage="No payments recorded yet."
        />
      </div>

      {/* Record Payment Modal */}
      <Modal isOpen={showRecordModal} onClose={() => setShowRecordModal(false)} title="Record Payment" size="large">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Invoice *</label>
            <select
              value={formData.invoiceId}
              onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
              className="input"
              required
            >
              <option value="">Choose an invoice...</option>
              {invoices.map((invoice) => (
                <option key={invoice._id} value={invoice._id}>
                  {invoice.invoiceNumber} - {invoice.client.name} - ${invoice.total.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {selectedInvoice && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Invoice Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Client:</span>
                  <span className="ml-2 font-medium">{selectedInvoice.client.name}</span>
                </div>
                <div>
                  <span className="text-blue-700">Total Amount:</span>
                  <span className="ml-2 font-medium">${selectedInvoice.total.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-blue-700">Due Date:</span>
                  <span className="ml-2 font-medium">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-blue-700">Phone:</span>
                  <span className="ml-2 font-medium">{selectedInvoice.client.phone}</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="input"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="input"
                required
              >
                <option value="cash">Cash</option>
                <option value="card">Credit/Debit Card</option>
                <option value="transfer">Bank Transfer</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Details *</label>
            <input
              type="text"
              value={formData.paymentDetails}
              onChange={(e) => setFormData({ ...formData, paymentDetails: e.target.value })}
              className="input"
              placeholder="e.g., Cash received, Card ending in 1234, Check #12345"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input"
              rows={3}
              placeholder="Additional notes about the payment..."
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button type="button" onClick={() => setShowRecordModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
