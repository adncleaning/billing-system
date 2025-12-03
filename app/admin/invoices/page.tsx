"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useAuth, Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useRouter } from "next/navigation";
import Table from "@/components/Table";
import Modal from "@/components/Modal";
import { Plus, FileText, DollarSign, Calendar, Trash2 } from "lucide-react";

interface Client {
  _id: string;
  name: string;
  email: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  client: Client;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "pending" | "paid" | "partial" | "cancelled";
  dueDate: string;
  notes?: string;
  createdAt: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { token } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );
  const [pdfTemplate, setPdfTemplate] = useState<
    | "amazon"
    | "ebay"
    | "barnardos"
    | "shelter"
    | "fight_for_sight"
    | "st_christophers"
  >("amazon");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.adncleaningservices.co.uk/v1/api/";

  const [formData, setFormData] = useState({
    client: "",
    items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
    tax: 0,
    dueDate: "",
    notes: "",
  });

  const fetchInvoices = async () => {
    try {
      const data: any = await Api("GET", "invoices", null, router);
      if (data.success) {
        setInvoices(data.invoices);
      }
    } catch (error) {
      showToast("Error loading invoices", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const data: any = await Api("GET", "clients", null, router);
      if (data.success) {
        setClients(data.clients);
      }
    } catch (error) {
      showToast("Error loading clients", "error");
    }
  };

  const handleGenerateInvoicePdf = async () => {
    try {
      if (!selectedInvoiceId) return;

      let authToken = token;
      if (!authToken && typeof window !== "undefined") {
        authToken = localStorage.getItem("token");
      }

      if (!authToken) {
        showToast("Sesión no válida. Inicia sesión nuevamente.", "error");
        return;
      }

      setGeneratingPdf(true);

      const res = await fetch(`${API_URL}/invoices/${selectedInvoiceId}/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `jwt ${authToken}`,
        },
        body: JSON.stringify({ template: pdfTemplate }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            router.push("/");
          }
        }
        throw new Error("Error generating PDF");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice_${selectedInvoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast("Invoice PDF generated", "success");
      setShowPdfModal(false);
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Error generating invoice PDF", "error");
    } finally {
      setGeneratingPdf(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchInvoices();
      fetchClients();
    }
  }, [token]);

  const calculateItemTotal = (quantity: number, unitPrice: number) => {
    return quantity * unitPrice;
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal + formData.tax;
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "quantity" || field === "unitPrice") {
      newItems[index].total = calculateItemTotal(
        newItems[index].quantity,
        newItems[index].unitPrice
      );
    }

    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { description: "", quantity: 1, unitPrice: 0, total: 0 },
      ],
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({ ...formData, items: newItems });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const subtotal = calculateSubtotal();
      const total = calculateTotal();

      const invoiceData = {
        client: formData.client,
        items: formData.items,
        subtotal,
        tax: formData.tax,
        total,
        dueDate: formData.dueDate,
        notes: formData.notes,
      };

      const data: any = await Api("POST", "invoices", invoiceData, router);

      if (data.success) {
        showToast("Invoice created successfully", "success");
        setShowCreateModal(false);
        setFormData({
          client: "",
          items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
          tax: 0,
          dueDate: "",
          notes: "",
        });
        fetchInvoices();
      } else {
        showToast(data.message || "Error creating invoice", "error");
      }
    } catch (error: any) {
      showToast(error.message || "Error creating invoice", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      partial: "bg-blue-100 text-blue-800",
      cancelled: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          statusClasses[status as keyof typeof statusClasses]
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const columns = [
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
      render: (_: any, row: Invoice) => row.client.name,
    },
    {
      key: "total",
      label: "Amount",
      render: (value: number) => (
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          <span className="font-medium">${value.toFixed(2)}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value: string) => getStatusBadge(value),
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
      key: "createdAt",
      label: "Created",
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: Invoice) => (
        <button
          type="button"
          onClick={() => {
            setSelectedInvoiceId(row._id);
            setPdfTemplate("amazon");
            setShowPdfModal(true);
          }}
          className="inline-flex items-center text-sm text-blue-600 hover:underline"
        >
          <FileText className="h-4 w-4 mr-1" />
          Generate PDF
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-2">
            Create and manage invoices for your clients
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Invoice
        </button>
      </div>

      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Invoice List</h2>
          <span className="text-sm text-gray-500">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} total
          </span>
        </div>

        <Table
          columns={columns}
          data={invoices}
          loading={loading}
          emptyMessage="No invoices found. Create your first invoice to get started."
        />
      </div>

      {/* Create Invoice Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Invoice"
        size="xlarge"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Client *
            </label>
            <select
              value={formData.client}
              onChange={(e) =>
                setFormData({ ...formData, client: e.target.value })
              }
              className="input"
              required
            >
              <option value="">Choose a client...</option>
              {clients.map((client) => (
                <option key={client._id} value={client._id}>
                  {client.name} - {client.email}
                </option>
              ))}
            </select>
          </div>

          {/* Invoice Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Invoice Items
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="btn-outline text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </button>
            </div>

            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-4 items-end p-4 bg-gray-50 rounded-lg"
                >
                  <div className="col-span-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, "description", e.target.value)
                      }
                      className="input"
                      placeholder="Service or product description"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "quantity",
                          Number.parseInt(e.target.value) || 1
                        )
                      }
                      className="input"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit Price *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "unitPrice",
                          Number.parseFloat(e.target.value) || 0
                        )
                      }
                      className="input"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total
                    </label>
                    <div className="input bg-gray-100 text-gray-600">
                      ${item.total.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-1">
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice Totals */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Tax Amount:</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tax}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tax: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                  className="input w-24 text-right"
                />
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Due Date and Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date *
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="input"
                rows={3}
                placeholder="Additional notes or terms..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </Modal>
      {/* Generate Invoice PDF Modal */}
      <Modal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        title="Generate Invoice PDF"
        size="medium"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Available invoice formats
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Select the type of invoice you need for this shipment. Order codes
              and payment references will be generated automatically.
            </p>

            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="amazon"
                  checked={pdfTemplate === "amazon"}
                  onChange={() => setPdfTemplate("amazon")}
                />
                <span className="text-sm">Amazon UK Invoice</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="ebay"
                  checked={pdfTemplate === "ebay"}
                  onChange={() => setPdfTemplate("ebay")}
                />
                <span className="text-sm">eBay UK Invoice</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="barnardos"
                  checked={pdfTemplate === "barnardos"}
                  onChange={() => setPdfTemplate("barnardos")}
                />
                <span className="text-sm">Barnardo&apos;s Charity Receipt</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="shelter"
                  checked={pdfTemplate === "shelter"}
                  onChange={() => setPdfTemplate("shelter")}
                />
                <span className="text-sm">Shelter Charity Receipt</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="fight_for_sight"
                  checked={pdfTemplate === "fight_for_sight"}
                  onChange={() => setPdfTemplate("fight_for_sight")}
                />
                <span className="text-sm">Fight for Sight Charity Receipt</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="st_christophers"
                  checked={pdfTemplate === "st_christophers"}
                  onChange={() => setPdfTemplate("st_christophers")}
                />
                <span className="text-sm">
                  St Christopher&apos;s Charity Receipt
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowPdfModal(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerateInvoicePdf}
              className="btn-primary"
              disabled={generatingPdf}
            >
              {generatingPdf ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
