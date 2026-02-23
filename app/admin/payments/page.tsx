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
  AlertTriangle,
  Filter,
} from "lucide-react";

/** -------------------- Backend base -------------------- */
const RAW_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.co.uk/v1/api/";
const API_URL = RAW_API_URL.replace(/\/+$/, "");

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** -------------------- UK denominations (pence) -------------------- */
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
  totals?: { total?: number; paid?: number; balance?: number };
  client?: { name?: string; phone?: string };
  createdAt?: string;
}

type PaymentMethod = "cash" | "card" | "transfer" | "check" | "other" | string;

interface Payment {
  _id: string;
  bill?: { _id?: string; number?: string; client?: { name?: string } };
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

  cashBreakdown?: Record<string, number>;
  cashCountedTotal?: number;
  cashExpectedTotal?: number;
  cashDifference?: number;

  reconciliationStatus?: "OK" | "MINOR" | "MAJOR";
  differenceAbs?: number;

  driver?: { _id?: string; username?: string; name?: string };
}

export default function DriverPaymentsPage() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

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

  // Closure date (NEW): hoy o ayer
  const [closureDateChoice, setClosureDateChoice] = useState<"today" | "yesterday">("today");

  // Cash breakdown counts
  const [cashCounts, setCashCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    UK_DENOMS.forEach((d) => (init[d.key] = 0));
    return init;
  });

  // Details modal
  const [showClosureDetailsModal, setShowClosureDetailsModal] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState<CashClosure | null>(null);

  // Guard
  const [guardStatus, setGuardStatus] = useState<{
    allow: boolean;
    message?: string;
    requiredClosureDate?: string | null;
  } | null>(null);
  const [showGuardModal, setShowGuardModal] = useState(false);

  // Expenses
  type Expense = {
    _id: string;
    driver?: { _id: string; username?: string; name?: string } | string;
    createdBy?: { _id: string; username?: string; name?: string } | string;
    expenseDate?: string;
    category: string;
    amount: number;
    paymentMethod?: "cash" | "card" | "transfer" | "other";
    notes?: string;
    createdAt?: string;
  };

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesTotal, setExpensesTotal] = useState<number>(0);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: "",
    amount: "",
    paymentMethod: "cash" as "cash" | "card" | "transfer" | "other",
    notes: "",
  });

  // Details modal expenses
  const [closureExpenses, setClosureExpenses] = useState<Expense[]>([]);
  const [closureExpensesTotal, setClosureExpensesTotal] = useState<number>(0);

  // History filters (NEW)
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterOnlyDiff, setFilterOnlyDiff] = useState<boolean>(false);

  /** -------------------- Helpers -------------------- */
  function toYMD(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function getClosureDateFromChoice(choice: "today" | "yesterday") {
    const now = new Date();
    if (choice === "yesterday") {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return startOfDay(y);
    }
    return startOfDay(now);
  }

  function toMoney(n: any) {
    const v = Number(n || 0);
    return Number.isFinite(v) ? v : 0;
  }

  function diffStatus(diff: number) {
    const abs = Math.abs(diff);
    if (abs === 0) return { status: "OK" as const, cls: "bg-green-100 text-green-800", label: "OK" };
    if (abs <= 1) return { status: "MINOR" as const, cls: "bg-yellow-100 text-yellow-800", label: "Minor" };
    return { status: "MAJOR" as const, cls: "bg-red-100 text-red-800", label: "Major" };
  }

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

  function prettyBreakdownKeys(bd: any): Record<string, number> {
    if (!bd || typeof bd !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(bd)) {
      const prettyKey = String(k).replace(/_/g, ".");
      out[prettyKey] = Number(v || 0);
    }
    return out;
  }

  /** -------------------- API fetch -------------------- */
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

  const fetchExpensesToday = async () => {
    try {
      if (!user?.id) return;
      const date = toYMD(new Date());
      const data: any = await Api("GET", `expenses/driver/${user.id}?date=${date}`, null, router);
      if (data?.success) {
        setExpenses(data.expenses || []);
        setExpensesTotal(Number(data.total || 0));
      } else {
        setExpenses([]);
        setExpensesTotal(0);
      }
    } catch {
      showToast("Error loading expenses", "error");
      setExpenses([]);
      setExpensesTotal(0);
    }
  };

  const fetchExpensesByDate = async (dateObj: Date) => {
    try {
      if (!user?.id) return;
      const date = toYMD(dateObj);
      const data: any = await Api("GET", `expenses/driver/${user.id}?date=${date}`, null, router);
      if (data?.success) {
        setClosureExpenses(data.expenses || []);
        setClosureExpensesTotal(Number(data.total || 0));
      } else {
        setClosureExpenses([]);
        setClosureExpensesTotal(0);
      }
    } catch {
      setClosureExpenses([]);
      setClosureExpensesTotal(0);
    }
  };

  const fetchCashClosures = async () => {
    try {
      if (!token || !user?.id) return;

      // (NEW) filtro por fechas/diffs en frontend: traemos todo (como hoy),
      // luego filtramos en UI. Si luego quieres, lo hacemos por query params en backend.
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
      await Promise.all([fetchBills(), fetchPayments(), fetchCashClosures(), fetchExpensesToday()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  useEffect(() => {
    const loadGuard = async () => {
      try {
        await Api("GET", `cashClosure/guard/status`, null, router);
        setGuardStatus({ allow: true });
      } catch (err: any) {
        if (err?.response?.status === 423) {
          setGuardStatus({
            allow: false,
            message: err.response.data?.message,
            requiredClosureDate: err.response.data?.requiredClosureDate,
          });
          setShowGuardModal(true);
        } else {
          setGuardStatus({ allow: true });
        }
      }
    };
    loadGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** -------------------- Derived helpers -------------------- */
  const selectedBill = useMemo(
    () => bills.find((b) => b._id === formData.billId),
    [bills, formData.billId]
  );

  const todayPayments = useMemo(() => {
    const today = new Date().toDateString();
    return payments.filter((p) => new Date(p.paymentDate).toDateString() === today);
  }, [payments]);

  const todayTotal = useMemo(
    () => todayPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [todayPayments]
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
      prev.includes(paymentId) ? prev.filter((id) => id !== paymentId) : [...prev, paymentId]
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
      { totalCash: 0, totalCard: 0, totalTransfer: 0, totalOther: 0, grandTotal: 0 }
    );
  }, [availablePayments, selectedPayments]);

  // Cash counted total from denoms
  const cashCountedTotal = useMemo(() => {
    const totalPence = UK_DENOMS.reduce((sum, d) => {
      const qty = Number(cashCounts[d.key] || 0);
      return sum + qty * d.pence;
    }, 0);
    return totalPence / 100;
  }, [cashCounts]);

  const cashExpectedTotal = useMemo(() => closureTotals.totalCash, [closureTotals.totalCash]);

  const cashDifference = useMemo(() => {
    return Number((cashCountedTotal - cashExpectedTotal).toFixed(2));
  }, [cashCountedTotal, cashExpectedTotal]);

  const diffMeta = useMemo(() => diffStatus(cashDifference), [cashDifference]);

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

  const closuresWithDiffThisMonth = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return cashClosures.filter((c) => {
      const d = c.closureDate || c.createdAt;
      if (!d) return false;
      const dt = new Date(d);
      const sameMonth = dt.getMonth() === m && dt.getFullYear() === y;
      const diff = toMoney(c.cashDifference);
      return sameMonth && Math.abs(diff) > 0;
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
        setFormData({ billId: "", amount: "", paymentMethod: "cash", paymentDetails: "", notes: "" });
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

    // Si hay cash esperado, exige conteo
    if (cashExpectedTotal > 0 && cashCountedTotal <= 0) {
      showToast("Please enter the cash count breakdown (notes/coins).", "error");
      return;
    }

    // (NEW) si hay diferencia, exige notes para justificar
    if (cashDifference !== 0 && String(closureNotes || "").trim().length < 3) {
      showToast("Please add a note explaining the cash difference.", "error");
      return;
    }

    setSubmittingClosure(true);

    try {
      if (!token) {
        showToast("Invalid session token", "error");
        return;
      }

      const closureDate = getClosureDateFromChoice(closureDateChoice);

      const payload = {
        paymentIds: selectedPayments,
        notes: closureNotes,

        closureDate, // ✅ NUEVO: permite cerrar “ayer” si aplica

        cashBreakdown: cashCounts,
        cashCountedTotal,
        cashExpectedTotal, // igual se recalcula en backend, pero lo enviamos para consistencia
        cashDifference, // igual se recalcula en backend
      };

      const res = await fetch(`${API_URL}/cashClosure`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `jwt ${token}` },
        body: JSON.stringify(payload),
      });

      if (res.status === 404) {
        showToast("cashClosure endpoint not found (404)", "error");
        return;
      }

      const data: any = await safeJson(res);

      if (!res.ok) {
        showToast(data?.message || "Error creating cash closure", "error");
        return;
      }

      if (data?.success) {
        showToast("Cash closure created successfully", "success");
        setShowClosureModal(false);
        setSelectedPayments([]);
        setClosureNotes("");
        setClosureDateChoice("today");
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

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user?.id) return;

      const payload = {
        driverId: user.id,
        expenseDate: toYMD(new Date()),
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        paymentMethod: expenseForm.paymentMethod,
        notes: expenseForm.notes,
      };

      const data: any = await Api("POST", "expenses", payload, router);

      if (!data?.success) {
        showToast("Error creating expense", "error");
        return;
      }

      showToast("Expense created", "success");
      setShowExpenseModal(false);
      setExpenseForm({ category: "", amount: "", paymentMethod: "cash", notes: "" });

      await fetchExpensesToday();
    } catch {
      showToast("Error creating expense", "error");
    }
  };

  const handlePrintClosurePdf = () => {
    if (!selectedClosure?._id) {
      showToast("No closure selected", "error");
      return;
    }
    const url = `${API_URL}/cashClosure/${selectedClosure._id}/pdf`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /** -------------------- History filters (NEW) -------------------- */
  const filteredClosures = useMemo(() => {
    let list = [...cashClosures];

    if (filterFrom) {
      const from = new Date(filterFrom);
      list = list.filter((c) => {
        const d = new Date(c.closureDate || c.createdAt || "");
        return d >= startOfDay(from);
      });
    }

    if (filterTo) {
      const to = new Date(filterTo);
      const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
      list = list.filter((c) => {
        const d = new Date(c.closureDate || c.createdAt || "");
        return d < end;
      });
    }

    if (filterOnlyDiff) {
      list = list.filter((c) => Math.abs(toMoney(c.cashDifference)) > 0);
    }

    return list;
  }, [cashClosures, filterFrom, filterTo, filterOnlyDiff]);

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
            <span className="font-medium text-red-600">£{balance.toFixed(2)}</span>
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
              setFormData((p) => ({ ...p, billId: row._id, amount: balance.toString() }));
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
            <span className="font-medium">{row.bill?.number || row.bill?._id?.slice(-6) || "—"}</span>
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
          <span className="font-medium text-green-600">£{Number(value || 0).toFixed(2)}</span>
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

  // (NEW) closure columns include reconciliation info + badge
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
      key: "recon",
      label: "Cash Recon",
      render: (_: any, row: CashClosure) => {
        const expected = toMoney(row.cashExpectedTotal ?? row.totalCash);
        const counted = toMoney(row.cashCountedTotal);
        const diff = toMoney(row.cashDifference ?? (counted - expected));
        const meta = diffStatus(diff);

        return (
          <div className="text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-600">Exp:</span>
              <span className="font-medium">£{expected.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-600">Cnt:</span>
              <span className="font-medium">£{counted.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-600">Diff:</span>
              <span className={`font-semibold ${diff === 0 ? "text-green-700" : diff > 0 ? "text-blue-700" : "text-red-700"}`}>
                £{diff.toFixed(2)}
              </span>
            </div>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
              {meta.label}
            </span>
          </div>
        );
      },
    },
    {
      key: "grandTotal",
      label: "Total",
      render: (_: any, row: CashClosure) => (
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          <span className="font-medium text-green-600">£{Number(row.grandTotal || 0).toFixed(2)}</span>
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
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              isClosed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
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
      render: (_: any, row: CashClosure) => (
        <button
          type="button"
          className="btn-outline text-sm py-1 px-3"
          onClick={async () => {
            setSelectedClosure(row);
            await fetchExpensesByDate(new Date(row.closureDate || row.createdAt || new Date()));
            setShowClosureDetailsModal(true);
          }}
        >
          View
        </button>
      ),
    },
  ];

  const expenseColumns = [
    {
      key: "date",
      label: "Date",
      render: (_: any, row: Expense) => {
        const d = row.expenseDate || row.createdAt || "";
        return (
          <div className="flex items-center">
            <Calendar className="h-4 w-4 text-gray-400 mr-2" />
            {d ? new Date(d).toLocaleDateString() : "—"}
          </div>
        );
      },
    },
    {
      key: "category",
      label: "Category",
      render: (_: any, row: Expense) => (
        <div className="flex items-center">
          <FileText className="h-4 w-4 text-gray-400 mr-2" />
          <span className="font-medium">{row.category || "—"}</span>
        </div>
      ),
    },
    {
      key: "method",
      label: "Method",
      render: (_: any, row: Expense) => {
        const m = (row.paymentMethod || "cash").toString();
        const Icon = m === "card" ? CreditCard : m === "cash" ? Banknote : FileText;
        return (
          <div className="flex items-center">
            <Icon className="h-4 w-4 text-gray-400 mr-2" />
            <span className="capitalize">{m}</span>
          </div>
        );
      },
    },
    {
      key: "notes",
      label: "Notes",
      render: (_: any, row: Expense) => <span className="text-gray-600">{row.notes || "—"}</span>,
    },
    {
      key: "amount",
      label: "Amount",
      render: (_: any, row: Expense) => (
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          <span className="font-medium text-green-600">£{Number(row.amount || 0).toFixed(2)}</span>
        </div>
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
              resetCashCounts();
            }}
            className="btn-primary flex items-center"
            disabled={availablePayments.length === 0}
            title={availablePayments.length === 0 ? "No available payments to close" : "Create a new cash closure"}
          >
            <Calculator className="h-5 w-5 mr-2" />
            New Cash Closure
          </button>

          <button className="btn-outline" onClick={() => setShowExpenseModal(true)}>
            Add expense
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
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
              <p className="text-xs text-gray-500 mt-1">£{todayTotal.toFixed(2)}</p>
            </div>
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unclosed Amount</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">£{unclosedAmount.toFixed(2)}</p>
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

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Closures w/ Diff</p>
              <p className="text-2xl font-bold text-red-600 mt-2">{closuresWithDiffThisMonth}</p>
              <p className="text-xs text-gray-500 mt-1">Semáforo automático</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
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

        <Table columns={billColumns} data={bills} loading={loading} emptyMessage="No pending bills found." />
      </div>

      {/* Recent Payments */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Payments</h2>
          <span className="text-sm text-gray-500">{payments.length} payment(s) recorded</span>
        </div>

        <Table columns={paymentColumns} data={payments.slice(0, 10)} loading={loading} emptyMessage="No payments recorded yet." />
      </div>

      {/* Cash Closures History */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cash Closure History</h2>
            <span className="text-sm text-gray-500">{cashClosures.length} closure(s) created</span>
          </div>

          {/* NEW FILTER BAR */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white">
              <Filter className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                className="text-sm outline-none"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                title="From"
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                className="text-sm outline-none"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                title="To"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={filterOnlyDiff}
                onChange={(e) => setFilterOnlyDiff(e.target.checked)}
              />
              Only differences
            </label>

            <button
              className="btn-outline"
              onClick={() => {
                setFilterFrom("");
                setFilterTo("");
                setFilterOnlyDiff(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <Table columns={closureColumns} data={filteredClosures} loading={loading} emptyMessage="No cash closures created yet." />
      </div>

      {/* Expenses */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Expense Tracking</h2>
            <p className="text-sm text-gray-500">
              Today total: <b>£{expensesTotal.toFixed(2)}</b>
            </p>
          </div>

          <button className="btn-outline" onClick={() => setShowExpenseModal(true)}>
            Add expense
          </button>
        </div>

        <Table columns={expenseColumns} data={expenses} loading={loading} emptyMessage="No expenses recorded today." />
      </div>

      {/* Record Payment Modal */}
      <Modal isOpen={showRecordModal} onClose={() => setShowRecordModal(false)} title="Record Payment" size="large">
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
                    {(b.number || b._id.slice(-6))} - {b.client?.name || "—"} - £{balance.toFixed(2)}
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
                  <span className="ml-2 font-medium">£{Number(selectedBill.totals?.balance || 0).toFixed(2)}</span>
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
      <Modal isOpen={showClosureModal} onClose={() => setShowClosureModal(false)} title="Create Cash Closure" size="xlarge">
        <form onSubmit={(e) => void handleSubmitClosure(e)} className="space-y-6">
          {/* NEW: closure date choice */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Closure date</h3>
            <p className="text-sm text-gray-600 mb-3">
              Select the date you are closing. Use “Yesterday” if the system requires a pending closure.
            </p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={closureDateChoice === "today"}
                  onChange={() => setClosureDateChoice("today")}
                />
                Today
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={closureDateChoice === "yesterday"}
                  onChange={() => setClosureDateChoice("yesterday")}
                />
                Yesterday
              </label>
              <span className="text-xs text-gray-500">
                Selected: <b>{getClosureDateFromChoice(closureDateChoice).toLocaleDateString()}</b>
              </span>
            </div>
          </div>

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

          {/* CASH DENOMINATION BREAKDOWN */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Cash breakdown (UK denominations)</h3>
              <button type="button" onClick={resetCashCounts} className="btn-outline text-sm py-1 px-3">
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

                        <div className="text-sm text-gray-700 w-28 text-right">£{lineTotal.toFixed(2)}</div>
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

                        <div className="text-sm text-gray-700 w-28 text-right">£{lineTotal.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Totals + diff + semaphore */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Cash Expected</p>
                <p className="text-xl font-bold text-gray-900">£{cashExpectedTotal.toFixed(2)}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Cash Counted</p>
                <p className="text-xl font-bold text-gray-900">£{cashCountedTotal.toFixed(2)}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Difference</p>
                <p
                  className={`text-xl font-bold ${
                    cashDifference === 0 ? "text-green-600" : cashDifference > 0 ? "text-blue-600" : "text-red-600"
                  }`}
                >
                  £{cashDifference.toFixed(2)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Semáforo</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${diffMeta.cls}`}>
                  {diffMeta.label}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Selected payments</p>
                <p className="text-xl font-bold text-gray-900">{selectedPayments.length}</p>
              </div>
            </div>

            {cashDifference !== 0 ? (
              <div className="mt-4 p-3 rounded-lg border border-yellow-200 bg-yellow-50 text-sm text-yellow-900 flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  Difference detected. You must add a note explaining why cash counted doesn’t match expected cash.
                </div>
              </div>
            ) : null}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes {cashDifference !== 0 ? "*" : ""}
            </label>
            <textarea
              value={closureNotes}
              onChange={(e) => setClosureNotes(e.target.value)}
              className="input"
              rows={3}
              placeholder={cashDifference !== 0 ? "Explain the cash difference..." : "Additional notes..."}
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button type="button" onClick={() => setShowClosureModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={submittingClosure || selectedPayments.length === 0} className="btn-primary">
              {submittingClosure ? "Creating..." : "Create Cash Closure"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Closure Details Modal */}
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
          const expected = toMoney(selectedClosure.cashExpectedTotal ?? selectedClosure.totalCash);
          const counted = toMoney(selectedClosure.cashCountedTotal);
          const diff = toMoney(selectedClosure.cashDifference ?? (counted - expected));
          const meta = diffStatus(diff);

          const lines = UK_DENOMS.map((d) => {
            const qty = Number(bdPretty[d.key] || 0);
            const lineTotal = (qty * d.pence) / 100;
            return { ...d, qty, lineTotal };
          }).filter((x) => x.qty > 0);

          const notesLines = lines.filter((x) => x.type === "note");
          const coinsLines = lines.filter((x) => x.type === "coin");

          const netAfterExpenses = toMoney(selectedClosure.grandTotal) - toMoney(closureExpensesTotal);

          return (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-medium">
                      {new Date(selectedClosure.closureDate || selectedClosure.createdAt || new Date()).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Driver</p>
                    <p className="font-medium">{selectedClosure?.driver?.username || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Semáforo</p>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
                      {meta.label}
                    </span>
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

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Cash (expected)</p>
                  <p className="text-xl font-bold">£{toMoney(selectedClosure.totalCash).toFixed(2)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Card</p>
                  <p className="text-xl font-bold">£{toMoney(selectedClosure.totalCard).toFixed(2)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Transfer</p>
                  <p className="text-xl font-bold">£{toMoney(selectedClosure.totalTransfer).toFixed(2)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Other</p>
                  <p className="text-xl font-bold">£{toMoney(selectedClosure.totalOther).toFixed(2)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Grand total</p>
                  <p className="text-xl font-bold">£{toMoney(selectedClosure.grandTotal).toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Cash reconciliation</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Absolute</p>
                    <p className="text-2xl font-bold">£{Math.abs(diff).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Expenses summary (NEW) */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Expenses (same day)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Expenses total</p>
                    <p className="text-2xl font-bold">£{toMoney(closureExpensesTotal).toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Net after expenses</p>
                    <p className="text-2xl font-bold">£{toMoney(netAfterExpenses).toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Payments total</p>
                    <p className="text-2xl font-bold">£{toMoney(selectedClosure.grandTotal).toFixed(2)}</p>
                  </div>
                </div>

                {closureExpenses.length === 0 ? (
                  <p className="text-sm text-gray-600 mt-3">No expenses found for this day.</p>
                ) : (
                  <div className="mt-3 max-h-56 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="text-left text-gray-600 bg-gray-50">
                        <tr>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3">Notes</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closureExpenses.map((x) => (
                          <tr key={x._id} className="border-t">
                            <td className="py-2 px-3">{x.category}</td>
                            <td className="py-2 px-3 capitalize">{x.paymentMethod || "cash"}</td>
                            <td className="py-2 px-3">{x.notes || "—"}</td>
                            <td className="py-2 px-3 text-right">£{toMoney(x.amount).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Denominations */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Cash denominations</h3>

                {lines.length === 0 ? (
                  <p className="text-sm text-gray-600">No cash breakdown recorded for this closure.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-outline" onClick={handlePrintClosurePdf}>
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

      {/* Guard modal */}
      <Modal isOpen={showGuardModal} onClose={() => setShowGuardModal(false)} title="Pending cash closure">
        <p className="text-sm text-gray-700">
          {guardStatus?.message || "You must complete yesterday’s cash closure before registering new payments."}
        </p>

        {guardStatus?.requiredClosureDate ? (
          <p className="text-sm text-gray-600 mt-2">
            Required closure date: <b>{new Date(guardStatus.requiredClosureDate).toLocaleDateString()}</b>
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
              setShowClosureModal(true);
              setClosureDateChoice("yesterday"); // ✅ sugerimos cerrar ayer si está bloqueado
              resetCashCounts();
            }}
          >
            Go to cash closure
          </button>
        </div>
      </Modal>

      {/* Expense modal */}
      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Add Expense" size="large">
        <form onSubmit={(e) => void handleSubmitExpense(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
            <input
              className="input"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}
              placeholder="Fuel, Parking, Supplies..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment method</label>
              <select
                className="input"
                value={expenseForm.paymentMethod}
                onChange={(e) => setExpenseForm((p) => ({ ...p, paymentMethod: e.target.value as any }))}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              className="input"
              rows={3}
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setShowExpenseModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save expense
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}