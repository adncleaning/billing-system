"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1/api";

type Bill = {
  _id: string;
  number: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
  currency?: string;
  notes?: string;
  issueDate?: string;
  dueDate?: string;

  client?: { name?: string; email?: string; phone?: string; address?: any };

  guides?: Array<{
    guideNumber: string;
    pieces: number;
    weightKg: number;
    value: number;
    description: string;
  }>;
  services?: Array<{
    name: string;
    measure: string;
    price: number;
    quantity: number;
    total: number;
  }>;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;

  totals?: {
    total?: number;
    paid?: number;
    balance?: number;
    guidesTotal?: number;
    servicesTotal?: number;
    itemsTotal?: number;
  };

  createdAt: string;
};

type Payment = {
  _id: string;
  amount: number;
  method: string;
  reference?: string;
  paidAt: string;
  createdAt: string;
};

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

function round2(n: any) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

export default function BillDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");

  const [bill, setBill] = useState<Bill | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // payment form
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  // ✅ setear el default del amount SOLO la primera vez que carga la bill
  const [amountInitialized, setAmountInitialized] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const data = await apiFetch(`/bills/${id}`);
      const b = data?.data?.bill || null;

      setBill(b);
      setPayments(data?.data?.payments || []);

      // ✅ default: amount = total con 2 decimales (solo una vez)
      if (b && !amountInitialized) {
        const defaultAmount = round2(b?.totals?.total);
        setAmount(defaultAmount);
        setAmountInitialized(true);
      }
    } catch (e: any) {
      setErr(e.message || "Error loading bill");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const badge = (s?: Bill["status"]) => {
    const base = "px-2 py-0.5 rounded text-[11px] font-semibold";
    if (s === "PAID") return `${base} bg-green-100 text-green-800`;
    if (s === "PARTIAL") return `${base} bg-yellow-100 text-yellow-800`;
    if (s === "CANCELLED") return `${base} bg-red-100 text-red-800`;
    return `${base} bg-gray-100 text-gray-800`;
  };

  const canPay = useMemo(() => {
    const bal = Number(bill?.totals?.balance || 0);
    return bal > 0 && bill?.status !== "CANCELLED";
  }, [bill]);

  const addPayment = async () => {
    if (!bill) return;
    if (!amount || amount <= 0) return setErr("Enter a valid amount");

    try {
      setSaving(true);
      setErr(null);

      await apiFetch(`/bills/${bill._id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: round2(amount), method, reference }),
      });

      // ✅ después de pagar, recarga y vuelve a setear el default (2 decimales)
      setMethod("Cash");
      setReference("");
      setAmountInitialized(false);
      await load();
    } catch (e: any) {
      setErr(e.message || "Error saving payment");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !bill) {
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600">
            <Link href="/admin/bills" className="underline text-blue-600">
              Bills
            </Link>{" "}
            / Detail
          </div>
          <h1 className="text-2xl font-semibold">
            Bill {bill?.number || bill?._id?.slice(-6)}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className={badge(bill?.status)}>{bill?.status || "—"}</span>
        </div>
      </div>

      {err && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded text-sm">
          {err}
        </div>
      )}

      {/* Summary */}
      <div className="bg-white rounded shadow p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border rounded p-3">
          <div className="text-xs text-gray-600">Total</div>
          <div className="text-lg font-semibold">
            {Number(bill?.totals?.total || 0).toFixed(2)}
          </div>
        </div>
        <div className="border rounded p-3">
          <div className="text-xs text-gray-600">Paid</div>
          <div className="text-lg font-semibold">
            {Number(bill?.totals?.paid || 0).toFixed(2)}
          </div>
        </div>
        <div className="border rounded p-3">
          <div className="text-xs text-gray-600">Balance</div>
          <div className="text-lg font-semibold">
            {Number(bill?.totals?.balance || 0).toFixed(2)}
          </div>
        </div>
        <div className="border rounded p-3">
          <div className="text-xs text-gray-600">Client</div>
          <div className="text-sm font-semibold">{bill?.client?.name || "—"}</div>
          <div className="text-xs text-gray-600">{bill?.client?.email || ""}</div>
        </div>
      </div>

      {/* Payment form */}
      <div className="bg-white rounded shadow p-4">
        <div className="font-semibold mb-2">Register Payment</div>
        {!canPay ? (
          <div className="text-sm text-gray-600">
            This bill has no pending balance (or is cancelled).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <div>
              <label className="text-xs text-gray-600">Amount</label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded px-2 py-1 text-sm"
                value={Number(amount || 0).toFixed(2)}
                onChange={(e) => setAmount(round2(e.target.value))}
                onBlur={() => setAmount((prev) => round2(prev))}
              />
              <div className="text-[11px] text-gray-500 mt-1">
                Default: total {Number(bill?.totals?.total || 0).toFixed(2)}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600">Method</label>
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option>Cash</option>
                <option>Transfer</option>
                <option>Card</option>
                <option>Other</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-gray-600">Reference</label>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="md:col-span-4 flex justify-end">
              <button
                onClick={addPayment}
                disabled={saving}
                className="px-4 py-2 rounded bg-green-600 text-white text-sm disabled:bg-green-300"
              >
                {saving ? "Saving..." : "Add Payment"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payments list */}
      <div className="bg-white rounded shadow p-4">
        <div className="font-semibold mb-2">Payments</div>
        {!payments.length ? (
          <div className="text-sm text-gray-600">No payments yet.</div>
        ) : (
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-2 text-left">Date</th>
                  <th className="border px-2 py-2 text-right">Amount</th>
                  <th className="border px-2 py-2 text-left">Method</th>
                  <th className="border px-2 py-2 text-left">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td className="border px-2 py-2">
                      {new Date(p.paidAt || p.createdAt).toLocaleString()}
                    </td>
                    <td className="border px-2 py-2 text-right">
                      {Number(p.amount || 0).toFixed(2)}
                    </td>
                    <td className="border px-2 py-2">{p.method}</td>
                    <td className="border px-2 py-2">{p.reference || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guides / Services / Items breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded shadow p-4">
          <div className="font-semibold mb-2">Guides ({bill?.guides?.length || 0})</div>
          <div className="overflow-auto border rounded max-h-[360px]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-2 text-left">#</th>
                  <th className="border px-2 py-2 text-right">Value</th>
                  <th className="border px-2 py-2 text-left">Desc</th>
                </tr>
              </thead>
              <tbody>
                {(bill?.guides || []).map((g, idx) => (
                  <tr key={`${g.guideNumber}-${idx}`}>
                    <td className="border px-2 py-2">{g.guideNumber}</td>
                    <td className="border px-2 py-2 text-right">
                      {Number(g.value || 0).toFixed(2)}
                    </td>
                    <td className="border px-2 py-2">{g.description}</td>
                  </tr>
                ))}
                {!bill?.guides?.length && (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-gray-500">
                      No guides
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          <div className="font-semibold mb-2">Services ({bill?.services?.length || 0})</div>
          <div className="overflow-auto border rounded max-h-[360px]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-2 text-left">Name</th>
                  <th className="border px-2 py-2 text-center">Qty</th>
                  <th className="border px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(bill?.services || []).map((s, idx) => (
                  <tr key={`${s.name}-${idx}`}>
                    <td className="border px-2 py-2">{s.name}</td>
                    <td className="border px-2 py-2 text-center">{s.quantity}</td>
                    <td className="border px-2 py-2 text-right">
                      {Number(s.total || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {!bill?.services?.length && (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-gray-500">
                      No services
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          <div className="font-semibold mb-2">Items ({bill?.items?.length || 0})</div>
          <div className="overflow-auto border rounded max-h-[360px]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-2 text-left">Desc</th>
                  <th className="border px-2 py-2 text-center">Qty</th>
                  <th className="border px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(bill?.items || []).map((it, idx) => (
                  <tr key={`${it.description}-${idx}`}>
                    <td className="border px-2 py-2">{it.description}</td>
                    <td className="border px-2 py-2 text-center">{it.quantity}</td>
                    <td className="border px-2 py-2 text-right">
                      {Number(it.total || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {!bill?.items?.length && (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-gray-500">
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
