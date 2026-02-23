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
  Calculator,
} from "lucide-react";

/** -------------------- Backend base (MISMO ESTILO que tu ejemplo) -------------------- */
const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.co.uk/v1/api/";
const API_URL = RAW_API_URL.replace(/\/+$/, ""); // sin slash final

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** -------------------- UK denominations (pence) --------------------
 * Notes: £5 £10 £20 £50 (Bank of England)
 * Coins: 1p 2p 5p 10p 20p 50p £1 £2
 */
const UK_DENOMS = [
  { key: "50", label: "£50", pence: 5000, type: "note" as const },
  { key: "20", label: "£20", pence: 2000, type: "note" as const },
  { key: "10", label: "£10", pence: 1000, type: "note" as const },
  { key: "5", label: "£5", pence: 500, type: "note" as const },

  { key: "2", label: "£2", pence: 200, type: "coin" as const },
  { key: "1", label: "£1", pence: 100, type: "coin" as const },
  { key: "0.50", label: "50p", pence: 50, type: "coin" as const },
  { key: "0.20", label: "20p", pence: 20, type: "coin" as const },
  { key: "0.10", label: "10p", pence: 10, type: "coin" as const },
  { key: "0.05", label: "5p", pence: 5, type: "coin" as const },
  { key: "0.02", label: "2p", pence: 2, type: "coin" as const },
  { key: "0.01", label: "1p", pence: 1, type: "coin" as const },
];

/** -------------------- Types -------------------- */
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

type PaymentMethod = "cash" | "card" | "transfer" | "check" | "other" | string;

interface Payment {
  _id: string;
  bill?: {
    _id?: string;
    number?: string;
    client?: { name?: string };
  };
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDetails: string;
  paymentDate: string;
  notes?: string;

  cashClosure?: string | null;
}

interface CashClosure {
  _id: string;
  closureDate?: string;
  createdAt?: string;
  status?: "open" | "closed" | string;
  notes?: string;

  payments?: Payment[];
  paymentIds?: string[];

  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalOther: number;
  grandTotal: number;

  // opcional si luego lo devuelves
  cashBreakdown?: Record<string, number>;
  cashCountedTotal?: number;
  cashExpectedTotal?: number;
  cashDifference?: number;
}

export default function DriverPaymentsPage() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  // Bills/Payments
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Record payment modal
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [formData, setFormData] = useState({
    billId: "",
    amount: "",
    paymentMethod: "cash",
    paymentDetails: "",
    notes: "",
  });

  // Cash closures
  const [cashClosures, setCashClosures] = useState<CashClosure[]>([]);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [submittingClosure, setSubmittingClosure] = useState(false);
  const [closureNotes, setClosureNotes] = useState("");
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  // NEW: cash breakdown counts
  const [cashCounts, setCashCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    UK_DENOMS.forEach((d) => (init[d.key] = 0));
    return init;
  });

  const [showClosureDetailsModal, setShowClosureDetailsModal] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState<any>(null);

  const [guardStatus, setGuardStatus] = useState<{ allow: boolean; message?: string; requiredClosureDate?: string | null } | null>(null);
  const [showGuardModal, setShowGuardModal] = useState(false);

  /** -------------------- API: Bills & Payments (con Api helper) -------------------- */
  const fetchBills = async () => {
    try {
      const data: any = await Api("GET", "bills", null, router);
      const list: Bill[] = data?.data || [];

      const pending = (list || []).filter((b) => {
        const balance = Number(b?.totals?.balance || 0);
        return (b.status === "PENDING" || b.status === "PARTIAL") && balance > 0;
      });

      setBills(pending);
    } catch {
      showToast("Error loading bills", "error");
      setBills([]);
    }
  };

  const fetchPayments = async () => {
    try {
      const data: any = await Api("GET", `payments/driver/${user?.id}`, null, router);
      if (data?.success) setPayments(data.payments || []);
      else setPayments([]);
    } catch {
      showToast("Error loading payments", "error");
      setPayments([]);
    }
  };

  /** -------------------- API: Cash closures (fetch directo como tu ejemplo) -------------------- */
  const fetchCashClosures = async () => {
    try {
      if (!token || !user?.id) return;

      const res = await fetch(`${API_URL}/cashClosure/driver/${user.id}`, {
        headers: { Authorization: `jwt ${token}` },
      });

      if (res.status === 404) {
        setCashClosures([]);
        return;
      }

      if (!res.ok) {
        showToast("Error loading cash closures", "error");
        setCashClosures([]);
        return;
      }

      const data: any = await safeJson(res);
      if (data?.success) setCashClosures(data.closures || []);
      else setCashClosures([]);
    } catch {
      showToast("Error loading cash closures", "error");
      setCashClosures([]);
    }
  };

  useEffect(() => {
    (async () => {
      if (!token || !user) return;
      setLoading(true);
      await Promise.all([fetchBills(), fetchPayments(), fetchCashClosures()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  useEffect(() => {
  const loadGuard = async () => {
    try {
      const data: any = await Api(
        "GET",
        `cashClosure/guard/${user?.id}/status`,
        null,
        router
      );

      // si llega aquí es que el backend permitió continuar
      setGuardStatus({ allow: true });

    } catch (err: any) {

      // 🔒 Cuando el backend bloquea por cierre pendiente
      if (err?.response?.status === 423) {
        setGuardStatus({
          allow: false,
          message: err.response.data?.message,
          requiredClosureDate: err.response.data?.requiredClosureDate,
        });
        setShowGuardModal(true);
      } else {
        // cualquier otro error no bloquea la app
        setGuardStatus({ allow: true });
      }
    }
  };

  if (user?.id) loadGuard();
}, [user?.id]);



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
    [bills, formData.billId],
  );

  const todayPayments = useMemo(() => {
    const today = new Date().toDateString();
    return payments.filter((p) => new Date(p.paymentDate).toDateString() === today);
  }, [payments]);

  const todayTotal = useMemo(
    () => todayPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [todayPayments],
  );

  /** -------------------- Cash closure logic -------------------- */
  const closedPaymentIds = useMemo(() => {
    const set = new Set<string>();

    payments.forEach((p) => {
      if (p.cashClosure) set.add(p._id);
    });

    cashClosures.forEach((c) => {
      c.paymentIds?.forEach((id) => set.add(id));
      c.payments?.forEach((p) => p?._id && set.add(p._id));
    });

    return set;
  }, [payments, cashClosures]);

  const availablePayments = useMemo(() => {
    return payments.filter((p) => !closedPaymentIds.has(p._id));
  }, [payments, closedPaymentIds]);

  const handlePaymentSelection = (paymentId: string) => {
    setSelectedPayments((prev) =>
      prev.includes(paymentId) ? prev.filter((id) => id !== paymentId) : [...prev, paymentId],
    );
  };

  const closureTotals = useMemo(() => {
    const selected = availablePayments.filter((p) => selectedPayments.includes(p._id));
    return selected.reduce(
      (acc, p) => {
        const m = (p.paymentMethod || "other").toString();
        if (m === "cash") acc.totalCash += Number(p.amount || 0);
        else if (m === "card") acc.totalCard += Number(p.amount || 0);
        else if (m === "transfer") acc.totalTransfer += Number(p.amount || 0);
        else acc.totalOther += Number(p.amount || 0);
        acc.grandTotal += Number(p.amount || 0);
        return acc;
      },
      { totalCash: 0, totalCard: 0, totalTransfer: 0, totalOther: 0, grandTotal: 0 },
    );
  }, [availablePayments, selectedPayments]);

  // NEW: cash counted total (from denominations), computed in PENCE to avoid float issues
  const cashCountedTotal = useMemo(() => {
    const totalPence = UK_DENOMS.reduce((sum, d) => {
      const qty = Number(cashCounts[d.key] || 0);
      return sum + qty * d.pence;
    }, 0);
    return totalPence / 100;
  }, [cashCounts]);

  const cashExpectedTotal = useMemo(() => closureTotals.totalCash, [closureTotals.totalCash]);

  const cashDifference = useMemo(() => {
    // counted - expected
    return Number((cashCountedTotal - cashExpectedTotal).toFixed(2));
  }, [cashCountedTotal, cashExpectedTotal]);

  const unclosedAmount = useMemo(() => {
    return availablePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [availablePayments]);

  const closuresThisMonth = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return cashClosures.filter((c) => {
      const d = c.closureDate || c.createdAt;
      if (!d) return false;
      const dt = new Date(d);
      return dt.getMonth() === m && dt.getFullYear() === y;
    }).length;
  }, [cashClosures]);

  const resetCashCounts = () => {
    const init: Record<string, number> = {};
    UK_DENOMS.forEach((d) => (init[d.key] = 0));
    setCashCounts(init);
  };

  /** -------------------- Submit: Record Payment -------------------- */
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPayment(true);

    try {
      const payload = {
        billId: formData.billId,
        amount: Number.parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        paymentDetails: formData.paymentDetails,
        notes: formData.notes,
      };

      const data: any = await Api("POST", "payments", payload, router);

      if (data?.success) {
        showToast("Payment recorded successfully", "success");
        setShowRecordModal(false);
        setFormData({
          billId: "",
          amount: "",
          paymentMethod: "cash",
          paymentDetails: "",
          notes: "",
        });

        await Promise.all([fetchBills(), fetchPayments(), fetchCashClosures()]);
      } else {
        showToast(data?.message || "Error recording payment", "error");
      }
    } catch (error: any) {
      showToast(error?.message || "Error recording payment", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };

  /** -------------------- Submit: Create Cash Closure -------------------- */
  const handleSubmitClosure = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedPayments.length === 0) {
      showToast("Please select at least one payment", "error");
      return;
    }

    // Reglas simples:
    // - Si hay cash esperado > 0, exigimos que el conteo no sea 0
    if (cashExpectedTotal > 0 && cashCountedTotal <= 0) {
      showToast("Please enter the cash count breakdown (notes/coins).", "error");
      return;
    }

    setSubmittingClosure(true);

    try {
      if (!token) {
        showToast("Invalid session token", "error");
        return;
      }

      const payload = {
        paymentIds: selectedPayments,
        notes: closureNotes,

        // NEW fields
        cashBreakdown: cashCounts, // { "50": 1, "20": 0, ... }
        cashCountedTotal,
        cashExpectedTotal,
        cashDifference,
      };

      const res = await fetch(`${API_URL}/cashClosure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `jwt ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 404) {
        showToast("cash-closures endpoint not found (404)", "error");
        return;
      }

      if (!res.ok) {
        showToast("Error creating cash closure", "error");
        return;
      }

      const data: any = await safeJson(res);

      if (data?.success) {
        showToast("Cash closure created successfully", "success");
        setShowClosureModal(false);
        setSelectedPayments([]);
        setClosureNotes("");
        resetCashCounts();
        await Promise.all([fetchPayments(), fetchCashClosures()]);
      } else {
        showToast(data?.message || "Error creating cash closure", "error");
      }
    } catch (error: any) {
      showToast(error?.message || "Error creating cash closure", "error");
    } finally {
      setSubmittingClosure(false);
    }
  };

  function prettyBreakdownKeys(bd: any): Record<string, number> {
    if (!bd || typeof bd !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(bd)) {
      const prettyKey = String(k).replace(/_/g, ".");
      out[prettyKey] = Number(v || 0);
    }
    return out;
  }
  const handlePrintClosurePdf = () => {
    if (!selectedClosure?._id) {
      showToast("No closure selected", "error");
      return;
    }

    // OJO: ajusta el path si tu ruta es diferente
    // Ejemplos comunes:
    // 1) `${API_URL}/cash-closures/${selectedClosure._id}/pdf`
    // 2) `${API_URL}/cashClosure/${selectedClosure._id}/pdf`
    const url = `${API_URL}/cashClosure/${selectedClosure._id}/pdf`;

    window.open(url, "_blank", "noopener,noreferrer");
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

  const closureColumns = [
    {
      key: "date",
      label: "Date",
      render: (_: any, row: CashClosure) => {
        const d = row.closureDate || row.createdAt || "";
        return (
          <div className="flex items-center">
            <Calendar className="h-4 w-4 text-gray-400 mr-2" />
            {d ? new Date(d).toLocaleDateString() : "—"}
          </div>
        );
      },
    },
    {
      key: "payments",
      label: "Payments",
      render: (_: any, row: CashClosure) => {
        const count =
          (Array.isArray(row.paymentIds) ? row.paymentIds.length : 0) ||
          (Array.isArray(row.payments) ? row.payments.length : 0);
        return <span className="font-medium">{count} payments</span>;
      },
    },
    {
      key: "grandTotal",
      label: "Total",
      render: (_: any, row: CashClosure) => (
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          <span className="font-medium text-green-600">${Number(row.grandTotal || 0).toFixed(2)}</span>
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
            <span>Cash: ${Number(row.totalCash || 0).toFixed(2)}</span>
          </div>
          <div className="flex items-center">
            <CreditCard className="h-3 w-3 text-blue-600 mr-1" />
            <span>Card: ${Number(row.totalCard || 0).toFixed(2)}</span>
          </div>
          {Number(row.totalTransfer || 0) > 0 && (
            <div className="flex items-center">
              <Smartphone className="h-3 w-3 text-purple-600 mr-1" />
              <span>Transfer: ${Number(row.totalTransfer || 0).toFixed(2)}</span>
            </div>
          )}
          {Number(row.totalOther || 0) > 0 && (
            <div className="flex items-center">
              <FileText className="h-3 w-3 text-orange-600 mr-1" />
              <span>Other: ${Number(row.totalOther || 0).toFixed(2)}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (_: any, row: CashClosure) => {
        const v = (row.status || "closed").toString();
        const isClosed = v === "closed";
        return (
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${isClosed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
              }`}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: any) => (
        <button
          type="button"
          className="btn-outline text-sm py-1 px-3"
          onClick={() => {
            setSelectedClosure(row);
            setShowClosureDetailsModal(true);
          }}
        >
          View
        </button>
      ),
    },

  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Record Payments & Cash Closure</h1>
          <p className="text-gray-600 mt-2">Record payments and generate cash closure reports</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn-primary"
            disabled={guardStatus?.allow === false}
            onClick={() => {
              if (guardStatus?.allow === false) {
                setShowGuardModal(true);
                return;
              }
              setShowRecordModal(true);
            }}
          >
            Add payment
          </button>


          <button
            onClick={() => {
              setShowClosureModal(true);
              // opcional: reset para no arrastrar conteos viejos
              resetCashCounts();
            }}
            className="btn-primary flex items-center"
            disabled={availablePayments.length === 0}
            title={availablePayments.length === 0 ? "No available payments to close" : "Create a new cash closure"}
          >
            <Calculator className="h-5 w-5 mr-2" />
            New Cash Closure
          </button>
        </div>
      </div>

      {/* Summary */}
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
              <p className="text-sm font-medium text-gray-600">Unclosed Amount</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">${unclosedAmount.toFixed(2)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Closures (This Month)</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">{closuresThisMonth}</p>
            </div>
            <Calculator className="h-8 w-8 text-purple-600" />
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

      {/* Record Payment Modal */}
      <Modal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        title="Record Payment"
        size="large"
      >
        <form onSubmit={(e) => void handleSubmitPayment(e)} className="space-y-6">
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
                  <span className="text-blue-700">Balance:</span>
                  <span className="ml-2 font-medium">${Number(selectedBill.totals?.balance || 0).toFixed(2)}</span>
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
              placeholder="e.g., Cash received, Card ending in 1234..."
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
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button type="button" onClick={() => setShowRecordModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={submittingPayment} className="btn-primary">
              {submittingPayment ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Cash Closure Modal */}
      <Modal
        isOpen={showClosureModal}
        onClose={() => setShowClosureModal(false)}
        title="Create Cash Closure"
        size="xlarge"
      >
        <form onSubmit={(e) => void handleSubmitClosure(e)} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Select Payments to Include</h3>

            <div className="max-h-96 overflow-y-auto">
              <Table
                columns={[
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
                  ...paymentColumns,
                ]}
                data={availablePayments}
                loading={false}
                emptyMessage="No payments available for cash closure."
              />
            </div>
          </div>

          {/* NEW: CASH DENOMINATION BREAKDOWN */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Cash breakdown (UK denominations)</h3>
              <button
                type="button"
                onClick={resetCashCounts}
                className="btn-outline text-sm py-1 px-3"
              >
                Reset
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-1">
              Enter quantities for each note/coin. Total cash is calculated from this count.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Notes */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Banknote className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-gray-900">Notes</span>
                </div>

                <div className="space-y-3">
                  {UK_DENOMS.filter((d) => d.type === "note").map((d) => {
                    const qty = cashCounts[d.key] ?? 0;
                    const lineTotal = (qty * d.pence) / 100;
                    return (
                      <div key={d.key} className="flex items-center justify-between gap-3">
                        <div className="w-20 font-medium">{d.label}</div>

                        <input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={(e) =>
                            setCashCounts((prev) => ({
                              ...prev,
                              [d.key]: Math.max(0, Number(e.target.value || 0)),
                            }))
                          }
                          className="input w-24"
                          placeholder="0"
                        />

                        <div className="text-sm text-gray-700 w-28 text-right">
                          £{lineTotal.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coins */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-gray-900">Coins</span>
                </div>

                <div className="space-y-3">
                  {UK_DENOMS.filter((d) => d.type === "coin").map((d) => {
                    const qty = cashCounts[d.key] ?? 0;
                    const lineTotal = (qty * d.pence) / 100;
                    return (
                      <div key={d.key} className="flex items-center justify-between gap-3">
                        <div className="w-20 font-medium">{d.label}</div>

                        <input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={(e) =>
                            setCashCounts((prev) => ({
                              ...prev,
                              [d.key]: Math.max(0, Number(e.target.value || 0)),
                            }))
                          }
                          className="input w-24"
                          placeholder="0"
                        />

                        <div className="text-sm text-gray-700 w-28 text-right">
                          £{lineTotal.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Totals + difference */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Cash Expected (selected payments)</p>
                <p className="text-xl font-bold text-gray-900">£{cashExpectedTotal.toFixed(2)}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Cash Counted (denominations)</p>
                <p className="text-xl font-bold text-gray-900">£{cashCountedTotal.toFixed(2)}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Difference (counted - expected)</p>
                <p
                  className={`text-xl font-bold ${cashDifference === 0 ? "text-green-600" : cashDifference > 0 ? "text-blue-600" : "text-red-600"
                    }`}
                >
                  £{cashDifference.toFixed(2)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Selected payments</p>
                <p className="text-xl font-bold text-gray-900">{selectedPayments.length}</p>
              </div>
            </div>
          </div>

          {/* Summary (all methods) */}
          {selectedPayments.length > 0 && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Cash Closure Summary</h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Banknote className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600">Cash (Expected)</p>
                  <p className="text-xl font-bold text-green-600">£{closureTotals.totalCash.toFixed(2)}</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <CreditCard className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-600">Card</p>
                  <p className="text-xl font-bold text-blue-600">£{closureTotals.totalCard.toFixed(2)}</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Smartphone className="h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-600">Transfer</p>
                  <p className="text-xl font-bold text-purple-600">£{closureTotals.totalTransfer.toFixed(2)}</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <DollarSign className="h-6 w-6 text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-600">Other</p>
                  <p className="text-xl font-bold text-gray-600">£{closureTotals.totalOther.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-600">Grand Total (all selected payments)</p>
                <p className="text-2xl font-bold text-gray-900">£{closureTotals.grandTotal.toFixed(2)}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={closureNotes}
              onChange={(e) => setClosureNotes(e.target.value)}
              className="input"
              rows={3}
              placeholder="Additional notes for this cash closure..."
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button type="button" onClick={() => setShowClosureModal(false)} className="btn-outline">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingClosure || selectedPayments.length === 0}
              className="btn-primary"
            >
              {submittingClosure ? "Creating..." : "Create Cash Closure"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={showClosureDetailsModal}
        onClose={() => {
          setShowClosureDetailsModal(false);
          setSelectedClosure(null);
        }}
        title="Cash Closure Details"
        size="xlarge"
      >
        {selectedClosure ? (() => {
          const bdPretty = prettyBreakdownKeys(selectedClosure.cashBreakdown);
          const expected = Number(selectedClosure.cashExpectedTotal || selectedClosure.totalCash || 0);
          const counted = Number(selectedClosure.cashCountedTotal || 0);
          const diff = Number(selectedClosure.cashDifference ?? (counted - expected));

          // reutiliza tu UK_DENOMS del frontend
          const lines = UK_DENOMS.map((d: any) => {
            const qty = Number(bdPretty[d.key] || 0);
            const lineTotal = (qty * d.pence) / 100;
            return { ...d, qty, lineTotal };
          }).filter((x) => x.qty > 0);

          const notesLines = lines.filter((x) => x.type === "note");
          const coinsLines = lines.filter((x) => x.type === "coin");

          return (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-medium">
                      {new Date(selectedClosure.closureDate || selectedClosure.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Driver</p>
                    <p className="font-medium">{selectedClosure?.driver?.username || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium capitalize">{selectedClosure.status || "closed"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payments</p>
                    <p className="font-medium">
                      {(selectedClosure.paymentIds?.length || selectedClosure.payments?.length || 0)} payments
                    </p>
                  </div>
                </div>

                {selectedClosure.notes ? (
                  <div className="mt-3 text-sm text-gray-700">
                    <span className="font-medium">Notes:</span> {selectedClosure.notes}
                  </div>
                ) : null}
              </div>

              {/* Totals */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Cash (expected)</p>
                  <p className="text-xl font-bold">£{Number(selectedClosure.totalCash || 0).toFixed(2)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Card</p>
                  <p className="text-xl font-bold">£{Number(selectedClosure.totalCard || 0).toFixed(2)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Transfer</p>
                  <p className="text-xl font-bold">£{Number(selectedClosure.totalTransfer || 0).toFixed(2)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Other</p>
                  <p className="text-xl font-bold">£{Number(selectedClosure.totalOther || 0).toFixed(2)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Grand total</p>
                  <p className="text-xl font-bold">£{Number(selectedClosure.grandTotal || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Cash reconciliation */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Cash reconciliation</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Cash expected</p>
                    <p className="text-2xl font-bold">£{expected.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Cash counted</p>
                    <p className="text-2xl font-bold">£{counted.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Difference</p>
                    <p className={`text-2xl font-bold ${diff === 0 ? "text-green-600" : diff > 0 ? "text-blue-600" : "text-red-600"}`}>
                      £{diff.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Denominations */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Cash denominations</h3>

                {lines.length === 0 ? (
                  <p className="text-sm text-gray-600">No cash breakdown recorded for this closure.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Notes */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">Notes</h4>
                      <div className="space-y-2">
                        {notesLines.length === 0 ? (
                          <p className="text-sm text-gray-600">No notes.</p>
                        ) : (
                          notesLines.map((x) => (
                            <div key={x.key} className="flex items-center justify-between text-sm">
                              <span className="font-medium">{x.label}</span>
                              <span className="text-gray-700">x{x.qty}</span>
                              <span className="font-medium">£{x.lineTotal.toFixed(2)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Coins */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">Coins</h4>
                      <div className="space-y-2">
                        {coinsLines.length === 0 ? (
                          <p className="text-sm text-gray-600">No coins.</p>
                        ) : (
                          coinsLines.map((x) => (
                            <div key={x.key} className="flex items-center justify-between text-sm">
                              <span className="font-medium">{x.label}</span>
                              <span className="text-gray-700">x{x.qty}</span>
                              <span className="font-medium">£{x.lineTotal.toFixed(2)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {lines.length > 0 ? (
                  <div className="mt-4 pt-4 border-t text-right">
                    <span className="text-sm text-gray-600 mr-2">Counted total:</span>
                    <span className="text-lg font-bold">£{counted.toFixed(2)}</span>
                  </div>
                ) : null}
              </div>

              {/* Payments list (optional) */}
              {Array.isArray(selectedClosure.payments) && selectedClosure.payments.length > 0 ? (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Included payments</h3>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-gray-600">
                        <tr>
                          <th className="py-2">Invoice</th>
                          <th className="py-2">Client</th>
                          <th className="py-2">Method</th>
                          <th className="py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClosure.payments.map((p: any) => (
                          <tr key={p._id} className="border-t">
                            <td className="py-2">{p.invoice?.invoiceNumber || "—"}</td>
                            <td className="py-2">{p.invoice?.client?.name || "—"}</td>
                            <td className="py-2 capitalize">{p.paymentMethod || "—"}</td>
                            <td className="py-2 text-right">£{Number(p.amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={handlePrintClosurePdf}
                >
                  Print / Export PDF
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setShowClosureDetailsModal(false);
                    setSelectedClosure(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          );
        })() : null}
      </Modal>
      <Modal
        isOpen={showGuardModal}
        onClose={() => setShowGuardModal(false)}
        title="Pending cash closure"
      >
        <p className="text-sm text-gray-700">
          {guardStatus?.message || "You must complete yesterday’s cash closure before registering new payments."}
        </p>

        {guardStatus?.requiredClosureDate ? (
          <p className="text-sm text-gray-600 mt-2">
            Required closure date:{" "}
            <b>{new Date(guardStatus.requiredClosureDate).toLocaleDateString()}</b>
          </p>
        ) : null}

        <div className="flex justify-end gap-3 mt-4">
          <button className="btn-outline" onClick={() => setShowGuardModal(false)}>
            Close
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setShowGuardModal(false);
              setShowClosureModal(true); // abre el modal para cerrar caja
            }}
          >
            Go to cash closure
          </button>
        </div>
      </Modal>

    </div>
  );
}
