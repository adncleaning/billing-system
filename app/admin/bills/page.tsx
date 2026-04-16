"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  FileText,
  DollarSign,
  Calendar,
  Filter,
  Calculator,
  AlertTriangle,
  Check,
  CreditCard,
  Banknote,
  Smartphone,
  Eye,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1/api";

/** -------------------- Helpers -------------------- */
async function apiFetch(path: string, options: RequestInit = {}) {
  const token =
    (typeof window !== "undefined" && localStorage.getItem("token")) || "";

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) headers.Authorization = `jwt ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let msg = "Error en la petición";
    try {
      const err = await res.json();
      msg = err?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function round2(n: any) {
  const x = Number(n || 0);
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function money(n: any) {
  return round2(n).toFixed(2);
}

function nearZero(n: any, epsilon = 0.01) {
  const val = Number(n || 0);
  return Math.abs(val) < epsilon ? 0 : val;
}

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

function diffStatus(diff: number) {
  const abs = Math.abs(diff);
  if (abs === 0) return { status: "OK" as const, cls: "bg-green-100 text-green-800", label: "OK" };
  if (abs <= 1) return { status: "MINOR" as const, cls: "bg-yellow-100 text-yellow-800", label: "Minor" };
  return { status: "MAJOR" as const, cls: "bg-red-100 text-red-800", label: "Major" };
}

function prettyBreakdownKeys(bd: any): Record<string, number> {
  if (!bd || typeof bd !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(bd)) {
    const prettyKey = String(k).replace(/_/g, ".");
    out[prettyKey] = Number(v || 0);
  }
  return out;
}

function paymentMethodIcon(method: string) {
  const normalized = String(method || "").toLowerCase();
  if (normalized === "cash") return <Banknote className="h-4 w-4 text-green-600" />;
  if (normalized === "card") return <CreditCard className="h-4 w-4 text-blue-600" />;
  if (normalized === "transfer") return <Smartphone className="h-4 w-4 text-purple-600" />;
  return <DollarSign className="h-4 w-4 text-gray-600" />;
}

/** -------------------- UK denominations -------------------- */
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
type ClientProfile = {
  entityType?: "PERSON" | "COMPANY" | string;
  firstName?: string;
  lastName?: string;
  companyName?: string | null;
  email?: string;
  phone?: string;
  mobile?: string;
};

type BillClient = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  profile?: ClientProfile;
};

type Bill = {
  _id: string;
  number: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
  totals?: { total?: number; paid?: number; balance?: number };
  client?: BillClient;
  clientDisplayName?: string;
  clientDisplayPhone?: string;
  createdAt: string;
};

type PaymentMethod = "cash" | "card" | "transfer" | "check" | "other" | string;

type PaymentSource = {
  _id?: string;
  number?: string;
  invoiceNumber?: string;
  client?: {
    name?: string;
    profile?: ClientProfile;
  };
};

type Payment = {
  _id: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  method?: string;
  paymentDetails?: string;
  reference?: string;
  paymentDate?: string;
  paidAt?: string;
  createdAt?: string;
  cashClosure?: string | null;
  bill?: PaymentSource | null;
  invoice?: PaymentSource | null;
};

type CashClosure = {
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
};

/** -------------------- UI helpers -------------------- */
function getProfileFullName(profile?: ClientProfile) {
  if (!profile) return "";
  if (String(profile.entityType || "").toUpperCase() === "COMPANY") {
    return String(profile.companyName || "").trim();
  }
  return `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
}

function getBillClientName(bill: Bill) {
  if (bill.clientDisplayName) return bill.clientDisplayName;
  if (bill.client?.name) return bill.client.name;
  const profileName = getProfileFullName(bill.client?.profile);
  return profileName || "—";
}

function getPaymentMethodValue(payment: Payment) {
  return String(payment.paymentMethod || payment.method || "other").toLowerCase();
}

function getPaymentDateValue(payment: Payment) {
  return payment.paymentDate || payment.paidAt || payment.createdAt || "";
}

function getPaymentSource(payment: Payment) {
  return payment.bill || payment.invoice || null;
}

function getPaymentSourceNumber(payment: Payment) {
  const source = getPaymentSource(payment);
  if (!source) return "—";
  return source.number || source.invoiceNumber || (source._id ? String(source._id).slice(-6) : "—");
}

function getPaymentSourceClientName(payment: Payment) {
  const source = getPaymentSource(payment);
  if (!source?.client) return "—";
  if (source.client.name) return source.client.name;
  const profileName = getProfileFullName(source.client.profile);
  return profileName || "—";
}

function normalizePayment(raw: any): Payment {
  return {
    _id: String(raw?._id || ""),
    amount: Number(raw?.amount || 0),
    paymentMethod: raw?.paymentMethod || raw?.method || "other",
    method: raw?.method || raw?.paymentMethod || "other",
    paymentDetails: raw?.paymentDetails || "",
    reference: raw?.reference || raw?.paymentDetails || "",
    paymentDate: raw?.paymentDate || raw?.paidAt || raw?.createdAt || "",
    paidAt: raw?.paidAt || raw?.paymentDate || raw?.createdAt || "",
    createdAt: raw?.createdAt || "",
    cashClosure: raw?.cashClosure || null,
    bill: raw?.bill || null,
    invoice: raw?.invoice || null,
  };
}

export default function BillsPage() {
  const { user, token } = useAuth();

  const [items, setItems] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashClosures, setCashClosures] = useState<CashClosure[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingClosures, setLoadingClosures] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showClosureDetailsModal, setShowClosureDetailsModal] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState<CashClosure | null>(null);

  const [submittingClosure, setSubmittingClosure] = useState(false);
  const [closureNotes, setClosureNotes] = useState("");
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [closureDateChoice, setClosureDateChoice] = useState<"today" | "yesterday">("today");

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterOnlyDiff, setFilterOnlyDiff] = useState(false);

  const [guardStatus, setGuardStatus] = useState<{
    allow: boolean;
    message?: string;
    requiredClosureDate?: string | null;
  } | null>(null);

  const [cashCounts, setCashCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    UK_DENOMS.forEach((d) => (init[d.key] = 0));
    return init;
  });

  const loadBills = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      if (status) qs.set("status", status);

      const data = await apiFetch(`/bills?${qs.toString()}`);
      setItems(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    if (!user?.id) return;
    setLoadingPayments(true);
    try {
      const data = await apiFetch(`/payments/driver/${user.id}`);
      if (data?.success) {
        setPayments((data.payments || []).map(normalizePayment));
      } else {
        setPayments([]);
      }
    } catch {
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchCashClosures = async () => {
    if (!token || !user?.id) return;
    setLoadingClosures(true);

    try {
      const res = await fetch(`${API_URL}/cashClosure/driver/${user.id}`, {
        headers: { Authorization: `jwt ${token}` },
      });

      if (res.status === 404) {
        setCashClosures([]);
        return;
      }

      if (!res.ok) {
        setCashClosures([]);
        return;
      }

      const data: any = await safeJson(res);

      if (data?.success) {
        const normalizedClosures = (data.closures || []).map((closure: any) => ({
          ...closure,
          payments: Array.isArray(closure?.payments)
            ? closure.payments.map(normalizePayment)
            : [],
        }));

        setCashClosures(normalizedClosures);
      } else {
        setCashClosures([]);
      }
    } catch {
      setCashClosures([]);
    } finally {
      setLoadingClosures(false);
    }
  };

  const fetchGuard = async () => {
    try {
      const data = await apiFetch(`/cashClosure/guard/status`);
      setGuardStatus({ allow: !!data?.allow || !!data?.success });
    } catch (err: any) {
      if (err?.response?.status === 423) {
        setGuardStatus({
          allow: false,
          message: err.response.data?.message,
          requiredClosureDate: err.response.data?.requiredClosureDate,
        });
      } else {
        setGuardStatus({ allow: true });
      }
    }
  };

  useEffect(() => {
    loadBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchPayments();
    fetchCashClosures();
    fetchGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, token]);

  const badge = (s: Bill["status"]) => {
    const base = "px-2 py-0.5 rounded text-[11px] font-semibold";
    if (s === "PAID") return `${base} bg-green-100 text-green-800`;
    if (s === "PARTIAL") return `${base} bg-yellow-100 text-yellow-800`;
    if (s === "CANCELLED") return `${base} bg-red-100 text-red-800`;
    return `${base} bg-gray-100 text-gray-800`;
  };

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

  const paymentSelectionTotal = useMemo(() => {
    return round2(
      availablePayments
        .filter((p) => selectedPayments.includes(p._id))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    );
  }, [availablePayments, selectedPayments]);

  const closureTotals = useMemo(() => {
    const selected = availablePayments.filter((p) => selectedPayments.includes(p._id));

    return selected.reduce(
      (acc, p) => {
        const m = getPaymentMethodValue(p);
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

  const cashExpectedTotal = useMemo(() => closureTotals.totalCash, [closureTotals.totalCash]);

  const cashCountedTotal = useMemo(() => {
    const totalPence = UK_DENOMS.reduce((sum, d) => {
      const qty = Number(cashCounts[d.key] || 0);
      return sum + qty * d.pence;
    }, 0);
    return totalPence / 100;
  }, [cashCounts]);

  const cashDifference = useMemo(() => {
    return Number((cashCountedTotal - cashExpectedTotal).toFixed(2));
  }, [cashCountedTotal, cashExpectedTotal]);

  const diffMeta = useMemo(() => diffStatus(cashDifference), [cashDifference]);

  const todayPayments = useMemo(() => {
    const today = new Date().toDateString();
    return payments.filter((p) => new Date(getPaymentDateValue(p)).toDateString() === today);
  }, [payments]);

  const todayTotal = useMemo(() => {
    return todayPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [todayPayments]);

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
      const diff = Number(c.cashDifference || 0);
      return sameMonth && Math.abs(diff) > 0;
    }).length;
  }, [cashClosures]);

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
      list = list.filter((c) => Math.abs(Number(c.cashDifference || 0)) > 0);
    }

    return list;
  }, [cashClosures, filterFrom, filterTo, filterOnlyDiff]);

  const handlePaymentSelection = (paymentId: string) => {
    setSelectedPayments((prev) =>
      prev.includes(paymentId) ? prev.filter((id) => id !== paymentId) : [...prev, paymentId]
    );
  };

  const resetCashCounts = () => {
    const init: Record<string, number> = {};
    UK_DENOMS.forEach((d) => (init[d.key] = 0));
    setCashCounts(init);
  };

  const handleSubmitClosure = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedPayments.length === 0) {
      alert("Please select at least one payment");
      return;
    }

    if (cashExpectedTotal > 0 && cashCountedTotal <= 0) {
      alert("Please enter the cash count breakdown.");
      return;
    }

    if (cashDifference !== 0 && String(closureNotes || "").trim().length < 3) {
      alert("Please add a note explaining the cash difference.");
      return;
    }

    setSubmittingClosure(true);

    try {
      if (!token) {
        alert("Invalid session token");
        return;
      }

      const closureDate = getClosureDateFromChoice(closureDateChoice);

      const payload = {
        paymentIds: selectedPayments,
        notes: closureNotes,
        closureDate,
        cashBreakdown: cashCounts,
        cashCountedTotal,
        cashExpectedTotal,
        cashDifference,
      };

      const res = await fetch(`${API_URL}/cashClosure`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `jwt ${token}` },
        body: JSON.stringify(payload),
      });

      const data: any = await safeJson(res);

      if (!res.ok) {
        alert(data?.message || "Error creating cash closure");
        return;
      }

      if (data?.success) {
        setShowClosureModal(false);
        setSelectedPayments([]);
        setClosureNotes("");
        setClosureDateChoice("today");
        resetCashCounts();
        await Promise.all([fetchPayments(), fetchCashClosures()]);
      } else {
        alert(data?.message || "Error creating cash closure");
      }
    } finally {
      setSubmittingClosure(false);
    }
  };

  const handlePrintClosurePdf = () => {
    if (!selectedClosure?._id) return;
    const url = `${API_URL}/cashClosure/${selectedClosure._id}/pdf`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="p-6 space-y-5 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bills</h1>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/bills/create"
            className="px-3 py-2 rounded bg-green-600 text-white text-sm"
          >
            + New Bill
          </Link>

          <button
            type="button"
            onClick={() => {
              if (guardStatus?.allow === false) {
                alert(
                  guardStatus?.message ||
                    "You must complete the pending cash closure before continuing."
                );
                return;
              }
              resetCashCounts();
              setSelectedPayments([]);
              setClosureNotes("");
              setClosureDateChoice("today");
              setShowClosureModal(true);
            }}
            className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:bg-blue-300"
            disabled={availablePayments.length === 0}
          >
            + New Cash Closure
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-gray-600">Pending Bills</div>
          <div className="text-2xl font-bold text-orange-600 mt-2">
            {items.filter((b) => nearZero(b?.totals?.balance || 0) > 0).length}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-gray-600">Today's Collections</div>
          <div className="text-2xl font-bold text-green-600 mt-2">{todayPayments.length}</div>
          <div className="text-xs text-gray-500 mt-1">£{money(todayTotal)}</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-gray-600">Unclosed Amount</div>
          <div className="text-2xl font-bold text-blue-600 mt-2">£{money(unclosedAmount)}</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-gray-600">Closures (This Month)</div>
          <div className="text-2xl font-bold text-purple-600 mt-2">{closuresThisMonth}</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-gray-600">Closures w/ Diff</div>
          <div className="text-2xl font-bold text-red-600 mt-2">{closuresWithDiffThisMonth}</div>
          <div className="text-xs text-gray-500 mt-1">Semáforo automático</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 flex gap-2 items-end border">
        <div className="flex-1">
          <label className="text-xs text-gray-600">Search</label>
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Bill #, notes..."
          />
        </div>

        <div>
          <label className="text-xs text-gray-600">Status</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="PENDING">PENDING</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="PAID">PAID</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <button
          onClick={loadBills}
          className="px-3 py-2 rounded bg-blue-600 text-white text-sm"
        >
          {loading ? "Loading..." : "Filter"}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-auto border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-2 py-2 text-left">Number</th>
              <th className="border px-2 py-2 text-left">Client</th>
              <th className="border px-2 py-2 text-center">Status</th>
              <th className="border px-2 py-2 text-right">Total</th>
              <th className="border px-2 py-2 text-right">Paid</th>
              <th className="border px-2 py-2 text-right">Balance</th>
              <th className="border px-2 py-2 text-left">Created</th>
              <th className="border px-2 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {!items?.length && !loading && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-gray-500">
                  No bills found
                </td>
              </tr>
            )}

            {(items || []).map((b) => (
              <tr key={b._id}>
                <td className="border px-2 py-2">{b.number || b._id.slice(-6)}</td>
                <td className="border px-2 py-2">{getBillClientName(b)}</td>
                <td className="border px-2 py-2 text-center">
                  <span className={badge(b.status)}>{b.status}</span>
                </td>
                <td className="border px-2 py-2 text-right">£{money(b.totals?.total || 0)}</td>
                <td className="border px-2 py-2 text-right">£{money(b.totals?.paid || 0)}</td>
                <td className="border px-2 py-2 text-right">£{money(nearZero(b.totals?.balance || 0))}</td>
                <td className="border px-2 py-2">
                  {new Date(b.createdAt).toLocaleString()}
                </td>
                <td className="border px-2 py-2 text-center">
                  <Link
                    className="text-blue-600 underline"
                    href={`/admin/bills/${b._id}`}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recent Payments</h2>
            <span className="text-sm text-gray-500">{payments.length} payment(s) recorded</span>
          </div>
        </div>

        {!payments.length && !loadingPayments ? (
          <div className="text-sm text-gray-500 py-4">No payments recorded yet.</div>
        ) : (
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-2 text-left">Bill</th>
                  <th className="border px-2 py-2 text-right">Amount</th>
                  <th className="border px-2 py-2 text-left">Method</th>
                  <th className="border px-2 py-2 text-left">Date</th>
                  <th className="border px-2 py-2 text-left">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 10).map((p) => (
                  <tr key={p._id}>
                    <td className="border px-2 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{getPaymentSourceNumber(p)}</div>
                          <div className="text-xs text-gray-500">
                            {getPaymentSourceClientName(p)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="border px-2 py-2 text-right font-medium text-green-600">
                      £{money(p.amount || 0)}
                    </td>
                    <td className="border px-2 py-2">
                      <div className="flex items-center gap-2">
                        {paymentMethodIcon(getPaymentMethodValue(p))}
                        <span className="capitalize">{getPaymentMethodValue(p)}</span>
                      </div>
                    </td>
                    <td className="border px-2 py-2">
                      {getPaymentDateValue(p)
                        ? new Date(getPaymentDateValue(p)).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="border px-2 py-2">
                      {p.reference || p.paymentDetails || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cash Closure History</h2>
            <span className="text-sm text-gray-500">{cashClosures.length} closure(s) created</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white">
              <Filter className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                className="text-sm outline-none"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                className="text-sm outline-none"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
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
              className="px-3 py-2 rounded border text-sm"
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

        {!filteredClosures.length && !loadingClosures ? (
          <div className="text-sm text-gray-500 py-4">No cash closures created yet.</div>
        ) : (
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-2 text-left">Date</th>
                  <th className="border px-2 py-2 text-left">Payments</th>
                  <th className="border px-2 py-2 text-left">Cash Recon</th>
                  <th className="border px-2 py-2 text-right">Total</th>
                  <th className="border px-2 py-2 text-center">Status</th>
                  <th className="border px-2 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredClosures.map((row) => {
                  const expected = Number(row.cashExpectedTotal ?? row.totalCash ?? 0);
                  const counted = Number(row.cashCountedTotal ?? 0);
                  const diff = Number(row.cashDifference ?? counted - expected);
                  const meta = diffStatus(diff);

                  return (
                    <tr key={row._id}>
                      <td className="border px-2 py-2">
                        {row.closureDate
                          ? new Date(row.closureDate).toLocaleDateString()
                          : row.createdAt
                          ? new Date(row.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="border px-2 py-2">
                        {(Array.isArray(row.paymentIds) ? row.paymentIds.length : 0) ||
                          (Array.isArray(row.payments) ? row.payments.length : 0)}{" "}
                        payments
                      </td>
                      <td className="border px-2 py-2">
                        <div className="text-xs space-y-1">
                          <div>Exp: £{money(expected)}</div>
                          <div>Cnt: £{money(counted)}</div>
                          <div
                            className={
                              diff === 0
                                ? "text-green-700 font-semibold"
                                : diff > 0
                                ? "text-blue-700 font-semibold"
                                : "text-red-700 font-semibold"
                            }
                          >
                            Diff: £{money(diff)}
                          </div>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </td>
                      <td className="border px-2 py-2 text-right font-medium text-green-600">
                        £{money(row.grandTotal || 0)}
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            row.status === "closed"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {String(row.status || "closed")}
                        </span>
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-blue-600 underline"
                          onClick={() => {
                            setSelectedClosure(row);
                            setShowClosureDetailsModal(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showClosureModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Create Cash Closure</h2>
                <p className="text-sm text-gray-500">
                  Reusing the same closure logic from driver payments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowClosureModal(false)}
                className="px-3 py-2 rounded border text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitClosure} className="p-5 space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Closure date</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Select the date you are closing.
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
                    Selected:{" "}
                    <b>{getClosureDateFromChoice(closureDateChoice).toLocaleDateString()}</b>
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select Payments to Include</h3>

                <div className="max-h-96 overflow-y-auto border rounded">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-2 py-2 text-center">Select</th>
                        <th className="border px-2 py-2 text-left">Bill</th>
                        <th className="border px-2 py-2 text-right">Amount</th>
                        <th className="border px-2 py-2 text-left">Method</th>
                        <th className="border px-2 py-2 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!availablePayments.length && (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-gray-500">
                            No payments available for cash closure.
                          </td>
                        </tr>
                      )}

                      {availablePayments.map((p) => (
                        <tr key={p._id}>
                          <td className="border px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedPayments.includes(p._id)}
                              onChange={() => handlePaymentSelection(p._id)}
                            />
                          </td>
                          <td className="border px-2 py-2">
                            <div className="font-medium">{getPaymentSourceNumber(p)}</div>
                            <div className="text-xs text-gray-500">
                              {getPaymentSourceClientName(p)}
                            </div>
                          </td>
                          <td className="border px-2 py-2 text-right font-medium text-green-600">
                            £{money(p.amount || 0)}
                          </td>
                          <td className="border px-2 py-2">
                            <div className="flex items-center gap-2">
                              {paymentMethodIcon(getPaymentMethodValue(p))}
                              <span className="capitalize">{getPaymentMethodValue(p)}</span>
                            </div>
                          </td>
                          <td className="border px-2 py-2">
                            {getPaymentDateValue(p)
                              ? new Date(getPaymentDateValue(p)).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Cash breakdown (UK denominations)</h3>
                  <button
                    type="button"
                    onClick={resetCashCounts}
                    className="px-3 py-1 rounded border text-sm"
                  >
                    Reset
                  </button>
                </div>

                <p className="text-sm text-gray-600 mt-1">
                  Enter quantities for each note/coin. Total cash is calculated from this count.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                              className="border rounded px-2 py-1 text-sm w-24"
                            />

                            <div className="text-sm text-gray-700 w-28 text-right">
                              £{lineTotal.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

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
                              className="border rounded px-2 py-1 text-sm w-24"
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

                <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Cash Expected</p>
                    <p className="text-xl font-bold text-gray-900">£{money(cashExpectedTotal)}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Cash Counted</p>
                    <p className="text-xl font-bold text-gray-900">£{money(cashCountedTotal)}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Difference</p>
                    <p
                      className={`text-xl font-bold ${
                        cashDifference === 0
                          ? "text-green-600"
                          : cashDifference > 0
                          ? "text-blue-600"
                          : "text-red-600"
                      }`}
                    >
                      £{money(cashDifference)}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Semáforo</p>
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${diffMeta.cls}`}
                    >
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
                      Difference detected. You must add a note explaining why cash counted doesn’t
                      match expected cash.
                    </div>
                  </div>
                ) : null}
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
                      <p className="text-xl font-bold text-green-600">£{money(closureTotals.totalCash)}</p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <CreditCard className="h-6 w-6 text-blue-600" />
                      </div>
                      <p className="text-sm text-gray-600">Card</p>
                      <p className="text-xl font-bold text-blue-600">£{money(closureTotals.totalCard)}</p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Smartphone className="h-6 w-6 text-purple-600" />
                      </div>
                      <p className="text-sm text-gray-600">Transfer</p>
                      <p className="text-xl font-bold text-purple-600">£{money(closureTotals.totalTransfer)}</p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <DollarSign className="h-6 w-6 text-gray-600" />
                      </div>
                      <p className="text-sm text-gray-600">Other</p>
                      <p className="text-xl font-bold text-gray-600">£{money(closureTotals.totalOther)}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                    <p className="text-sm text-gray-600">Grand Total</p>
                    <p className="text-2xl font-bold text-gray-900">£{money(closureTotals.grandTotal)}</p>
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
                  className="w-full border rounded px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Closure notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowClosureModal(false)}
                  className="px-4 py-2 rounded border text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClosure}
                  className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:bg-blue-300"
                >
                  {submittingClosure ? "Creating..." : "Create Cash Closure"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClosureDetailsModal && selectedClosure && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Cash Closure Details</h2>
              <button
                type="button"
                onClick={() => setShowClosureDetailsModal(false)}
                className="px-3 py-2 rounded border text-sm"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Closure Date</p>
                  <p className="font-semibold">
                    {selectedClosure.closureDate
                      ? new Date(selectedClosure.closureDate).toLocaleDateString()
                      : selectedClosure.createdAt
                      ? new Date(selectedClosure.createdAt).toLocaleDateString()
                      : "—"}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Grand Total</p>
                  <p className="font-semibold">£{money(selectedClosure.grandTotal)}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Cash Difference</p>
                  <p className="font-semibold">£{money(selectedClosure.cashDifference || 0)}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-semibold capitalize">{selectedClosure.status || "closed"}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Payments in this closure</h3>

                <div className="overflow-auto border rounded">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-2 py-2 text-left">Bill</th>
                        <th className="border px-2 py-2 text-right">Amount</th>
                        <th className="border px-2 py-2 text-left">Method</th>
                        <th className="border px-2 py-2 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!selectedClosure.payments?.length && (
                        <tr>
                          <td colSpan={4} className="text-center py-6 text-gray-500">
                            No payments in this closure.
                          </td>
                        </tr>
                      )}

                      {(selectedClosure.payments || []).map((p) => (
                        <tr key={p._id}>
                          <td className="border px-2 py-2">
                            <div className="font-medium">{getPaymentSourceNumber(p)}</div>
                            <div className="text-xs text-gray-500">
                              {getPaymentSourceClientName(p)}
                            </div>
                          </td>
                          <td className="border px-2 py-2 text-right font-medium text-green-600">
                            £{money(p.amount || 0)}
                          </td>
                          <td className="border px-2 py-2">
                            <div className="flex items-center gap-2">
                              {paymentMethodIcon(getPaymentMethodValue(p))}
                              <span className="capitalize">{getPaymentMethodValue(p)}</span>
                            </div>
                          </td>
                          <td className="border px-2 py-2">
                            {getPaymentDateValue(p)
                              ? new Date(getPaymentDateValue(p)).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Cash breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(prettyBreakdownKeys(selectedClosure.cashBreakdown || {})).map(
                    ([key, value]) => (
                      <div key={key} className="border rounded-lg p-3 bg-gray-50">
                        <p className="text-sm text-gray-600">{key}</p>
                        <p className="font-semibold">{Number(value || 0)}</p>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowClosureDetailsModal(false)}
                  className="px-4 py-2 rounded border text-sm"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrintClosurePdf}
                  className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
                >
                  Print PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}