"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useAuth, Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useRouter } from "next/navigation";
import Table from "@/components/Table";
import Modal from "@/components/Modal";
import {
  Plus,
  DollarSign,
  FileText,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  Check,
} from "lucide-react";

/** -------------------- Types (Bills) -------------------- */
interface Bill {
  _id: string;
  number?: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
  totals?: {
    total?: number;
    paid?: number;
    balance?: number;
  };
  client?: {
    name?: string;
    phone?: string;
  };
  createdAt?: string;
}

interface Payment {
  _id: string;
  bill?: {
    _id?: string;
    number?: string;
    client?: { name?: string };
  };
  amount: number;
  paymentMethod: string;
  paymentDetails: string;
  paymentDate: string;
  notes?: string;
}

export default function DriverPaymentsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { user, token } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = useState({
    billId: "",
    amount: "",
    paymentMethod: "cash",
    paymentDetails: "",
    notes: "",
  });

  /** -------------------- API -------------------- */
  const fetchBills = async () => {
    try {
      // Igual que tu BillsPage: GET /bills
      const data: any = await Api("GET", "bills", null, router);

      // En BillsPage usas data.data
      const list: Bill[] = data?.data || [];

      // Pendientes: PENDING o PARTIAL con balance > 0
      const pending = (list || []).filter((b) => {
        const balance = Number(b?.totals?.balance || 0);
        return (b.status === "PENDING" || b.status === "PARTIAL") && balance > 0;
      });

      setBills(pending);
    } catch (error) {
      showToast("Error loading bills", "error");
      setBills([]);
    }
  };

  const fetchPayments = async () => {
    try {
      const data: any = await Api("GET", `payments/driver/${user?.id}`, null, router);
      if (data.success) {
        setPayments(data.payments || []);
      } else {
        setPayments([]);
      }
    } catch (error) {
      showToast("Error loading payments", "error");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && user) {
      fetchBills();
      fetchPayments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  /** -------------------- Helpers -------------------- */
  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "cash":
        return <Banknote className="h-4 w-4 text-green-600" />;
      case "card":
        return <CreditCard className="h-4 w-4 text-blue-600" />;
      case "transfer":
        return <Smartphone className="h-4 w-4 text-purple-600" />;
      case "check":
        return <FileText className="h-4 w-4 text-orange-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const selectedBill = useMemo(
    () => bills.find((b) => b._id === formData.billId),
    [bills, formData.billId]
  );

  const todayPayments = useMemo(
    () =>
      payments.filter(
        (p) => new Date(p.paymentDate).toDateString() === new Date().toDateString()
      ),
    [payments]
  );

  const todayTotal = useMemo(
    () => todayPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [todayPayments]
  );

  /** -------------------- Submit -------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        // ✅ CAMBIO: billId (en vez de invoiceId)
        billId: formData.billId,
        amount: Number.parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        paymentDetails: formData.paymentDetails,
        notes: formData.notes,
      };

      const data: any = await Api("POST", "payments", payload, router);

      if (data.success) {
        showToast("Payment recorded successfully", "success");
        setShowRecordModal(false);
        setFormData({
          billId: "",
          amount: "",
          paymentMethod: "cash",
          paymentDetails: "",
          notes: "",
        });

        // refresca
        fetchBills();
        fetchPayments();
      } else {
        showToast(data.message || "Error recording payment", "error");
      }
    } catch (error: any) {
      showToast(error.message || "Error recording payment", "error");
    } finally {
      setSubmitting(false);
    }
  };

  /** -------------------- Columns -------------------- */
  const billColumns = [
    {
      key: "number",
      label: "Bill #",
      render: (_: any, row: Bill) => (
        <div className="flex items-center">
          <FileText className="h-4 w-4 text-gray-400 mr-2" />
          <span className="font-medium">{row.number || row._id.slice(-6)}</span>
        </div>
      ),
    },
    {
      key: "client",
      label: "Client",
      render: (_: any, row: Bill) => (
        <div>
          <div className="font-medium">{row.client?.name || "—"}</div>
          <div className="text-sm text-gray-500">{row.client?.phone || "—"}</div>
        </div>
      ),
    },
    {
      key: "balance",
      label: "Amount Due",
      render: (_: any, row: Bill) => {
        const balance = Number(row.totals?.balance || 0);
        return (
          <div className="flex items-center">
            <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
            <span className="font-medium text-red-600">${balance.toFixed(2)}</span>
          </div>
        );
      },
    },
    {
      key: "createdAt",
      label: "Created",
      render: (value: string) => (
        <div className="flex items-center">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          {value ? new Date(value).toLocaleDateString() : "—"}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: Bill) => {
        const balance = Number(row.totals?.balance || 0);
        return (
          <button
            onClick={() => {
              setFormData((p) => ({
                ...p,
                billId: row._id,
                amount: balance.toString(),
              }));
              setShowRecordModal(true);
            }}
            className="btn-primary text-sm py-1 px-3"
          >
            Record Payment
          </button>
        );
      },
    },
  ];

  const paymentColumns = [
    {
      key: "bill",
      label: "Bill",
      render: (_: any, row: Payment) => (
        <div>
          <div className="flex items-center">
            <FileText className="h-4 w-4 text-gray-400 mr-2" />
            <span className="font-medium">
              {row.bill?.number || row.bill?._id?.slice(-6) || "—"}
            </span>
          </div>
          <div className="text-sm text-gray-500">{row.bill?.client?.name || "—"}</div>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (value: number) => (
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          <span className="font-medium text-green-600">${Number(value || 0).toFixed(2)}</span>
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
          {value ? new Date(value).toLocaleDateString() : "—"}
        </div>
      ),
    },
  ];

  /** -------------------- UI -------------------- */
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
              <p className="text-sm font-medium text-gray-600">Pending Bills</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">{bills.length}</p>
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

      {/* Pending Bills */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Pending Bills</h2>
          <span className="text-sm text-gray-500">
            {bills.length} bill{bills.length !== 1 ? "s" : ""} awaiting payment
          </span>
        </div>

        <Table
          columns={billColumns}
          data={bills}
          loading={loading}
          emptyMessage="No pending bills found. All bills have been paid!"
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
      <Modal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        title="Record Payment"
        size="large"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Bill *</label>
            <select
              value={formData.billId}
              onChange={(e) => setFormData((p) => ({ ...p, billId: e.target.value }))}
              className="input"
              required
            >
              <option value="">Choose a bill...</option>
              {bills.map((b) => {
                const balance = Number(b.totals?.balance || 0);
                return (
                  <option key={b._id} value={b._id}>
                    {(b.number || b._id.slice(-6))} - {b.client?.name || "—"} - ${balance.toFixed(2)}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedBill && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Bill Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Client:</span>
                  <span className="ml-2 font-medium">{selectedBill.client?.name || "—"}</span>
                </div>
                <div>
                  <span className="text-blue-700">Total:</span>
                  <span className="ml-2 font-medium">
                    ${(Number(selectedBill.totals?.total || 0)).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Paid:</span>
                  <span className="ml-2 font-medium">
                    ${(Number(selectedBill.totals?.paid || 0)).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Balance:</span>
                  <span className="ml-2 font-medium">
                    ${(Number(selectedBill.totals?.balance || 0)).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Phone:</span>
                  <span className="ml-2 font-medium">{selectedBill.client?.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-blue-700">Created:</span>
                  <span className="ml-2 font-medium">
                    {selectedBill.createdAt ? new Date(selectedBill.createdAt).toLocaleDateString() : "—"}
                  </span>
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
                onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                className="input"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData((p) => ({ ...p, paymentMethod: e.target.value }))}
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
              onChange={(e) => setFormData((p) => ({ ...p, paymentDetails: e.target.value }))}
              className="input"
              placeholder="e.g., Cash received, Card ending in 1234, Check #12345"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
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
  );
}
