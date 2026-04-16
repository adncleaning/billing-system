"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  Landmark,
  FileText,
  Receipt,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1/api";

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
  address?: any;
  profile?: ClientProfile;
};

type Bill = {
  _id: string;
  number: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
  currency?: string;
  notes?: string;
  issueDate?: string;
  dueDate?: string;

  client?: BillClient;
  clientDisplayName?: string;
  clientDisplayPhone?: string;

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

type PaymentDraft = {
  id: string;
  amount: string;
  method: string;
  reference: string;
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
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function money(n: any) {
  return round2(n).toFixed(2);
}

function nearZero(n: any, epsilon = 0.01) {
  const val = Number(n || 0);
  return Math.abs(val) < epsilon ? 0 : val;
}

function getProfileFullName(profile?: ClientProfile) {
  if (!profile) return "";
  if (String(profile.entityType || "").toUpperCase() === "COMPANY") {
    return String(profile.companyName || "").trim();
  }
  return `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
}

function getClientName(client?: BillClient, bill?: Bill | null) {
  if (bill?.clientDisplayName) return bill.clientDisplayName;
  if (client?.name) return client.name;
  const profileName = getProfileFullName(client?.profile);
  if (profileName) return profileName;
  return "—";
}

function getClientEmail(client?: BillClient) {
  return client?.email || client?.profile?.email || "";
}

function getClientPhone(client?: BillClient, bill?: Bill | null) {
  if (bill?.clientDisplayPhone) return bill.clientDisplayPhone;
  return client?.phone || client?.mobile || client?.profile?.phone || client?.profile?.mobile || "";
}

function paymentMethodIcon(method: string) {
  const normalized = String(method || "").toLowerCase();
  if (normalized === "cash") return <Banknote className="h-4 w-4 text-green-600" />;
  if (normalized === "card") return <CreditCard className="h-4 w-4 text-blue-600" />;
  if (normalized === "transfer") return <Landmark className="h-4 w-4 text-purple-600" />;
  return <Receipt className="h-4 w-4 text-gray-600" />;
}

function createEmptyPaymentDraft(): PaymentDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    amount: "",
    method: "Cash",
    reference: "",
  };
}

export default function BillDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");

  const [bill, setBill] = useState<Bill | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [paymentRows, setPaymentRows] = useState<PaymentDraft[]>([createEmptyPaymentDraft()]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);

      const data = await apiFetch(`/bills/${id}`);
      const b = data?.data?.bill || null;

      setBill(b);
      setPayments(data?.data?.payments || []);

      const balance = nearZero(b?.totals?.balance || 0);

      setPaymentRows([
        {
          ...createEmptyPaymentDraft(),
          amount: balance > 0 ? money(balance) : "",
          method: "Cash",
          reference: "",
        },
      ]);
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

  const balance = useMemo(() => nearZero(bill?.totals?.balance || 0), [bill]);

  const canPay = useMemo(() => {
    return balance > 0 && bill?.status !== "CANCELLED";
  }, [balance, bill]);

  const paymentDraftTotal = useMemo(() => {
    return round2(
      paymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    );
  }, [paymentRows]);

  const remainingAfterDraft = useMemo(() => {
    return round2(balance - paymentDraftTotal);
  }, [balance, paymentDraftTotal]);

  const isDraftValid = useMemo(() => {
    if (!canPay) return false;
    if (!paymentRows.length) return false;

    const hasAnyPositive = paymentRows.some((row) => Number(row.amount || 0) > 0);
    if (!hasAnyPositive) return false;

    const allRowsValid = paymentRows.every((row) => {
      const amount = Number(row.amount || 0);
      return amount > 0 && !!row.method;
    });

    if (!allRowsValid) return false;
    if (paymentDraftTotal <= 0) return false;
    if (paymentDraftTotal - balance > 0.009) return false;

    return true;
  }, [canPay, paymentRows, paymentDraftTotal, balance]);

  const addPaymentRow = () => {
    setPaymentRows((prev) => [...prev, createEmptyPaymentDraft()]);
  };

  const removePaymentRow = (rowId: string) => {
    setPaymentRows((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const updatePaymentRow = (
    rowId: string,
    field: keyof PaymentDraft,
    value: string
  ) => {
    setPaymentRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const distributeRemainingToNewRow = () => {
    const remainder = nearZero(remainingAfterDraft);
    setPaymentRows((prev) => [
      ...prev,
      {
        ...createEmptyPaymentDraft(),
        amount: remainder > 0 ? money(remainder) : "",
        method: "Card",
        reference: "",
      },
    ]);
  };

  const addPayment = async () => {
    if (!bill) return;

    if (!isDraftValid) {
      setErr("Please add valid payment rows. The total cannot exceed the bill balance.");
      return;
    }

    try {
      setSaving(true);
      setErr(null);

      const rowsToSave = paymentRows
        .map((row) => ({
          amount: round2(row.amount),
          method: row.method,
          reference: row.reference,
        }))
        .filter((row) => row.amount > 0);

      for (const row of rowsToSave) {
        await apiFetch(`/bills/${bill._id}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        });
      }

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
    <div className="p-6 space-y-5 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600">
            <Link href="/admin/bills" className="underline text-blue-600">
              Bills
            </Link>{" "}
            / Detail
          </div>
          <h1 className="text-2xl font-semibold mt-1">
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Total</div>
          <div className="text-xl font-semibold mt-1">£{money(bill?.totals?.total || 0)}</div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Paid</div>
          <div className="text-xl font-semibold mt-1">£{money(bill?.totals?.paid || 0)}</div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Balance</div>
          <div className="text-xl font-semibold mt-1 text-red-600">£{money(balance)}</div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Client</div>
          <div className="text-sm font-semibold mt-1">
            {getClientName(bill?.client, bill)}
          </div>
          <div className="text-xs text-gray-600 mt-1">{getClientEmail(bill?.client)}</div>
          <div className="text-xs text-gray-500 mt-1">{getClientPhone(bill?.client, bill)}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-lg">Register Payment</div>
            <div className="text-sm text-gray-500">
              Add one or multiple payment methods for this bill.
            </div>
          </div>

          {canPay && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addPaymentRow}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </button>

              {remainingAfterDraft > 0.009 && (
                <button
                  type="button"
                  onClick={distributeRemainingToNewRow}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 text-sm text-blue-700 hover:bg-blue-50"
                >
                  <Receipt className="h-4 w-4" />
                  Add Remaining
                </button>
              )}
            </div>
          )}
        </div>

        {!canPay ? (
          <div className="text-sm text-gray-600">
            This bill has no pending balance, or it is cancelled.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <div className="col-span-12 md:col-span-3">Amount</div>
                <div className="col-span-12 md:col-span-3">Method</div>
                <div className="col-span-12 md:col-span-5">Reference</div>
                <div className="col-span-12 md:col-span-1">Action</div>
              </div>

              <div className="divide-y divide-gray-200">
                {paymentRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-12 gap-3 px-4 py-4 items-end"
                  >
                    <div className="col-span-12 md:col-span-3">
                      <label className="text-xs text-gray-500 block mb-1">
                        Amount {index === 0 ? "(required)" : ""}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={row.amount}
                        onChange={(e) => updatePaymentRow(row.id, "amount", e.target.value)}
                        onBlur={() =>
                          updatePaymentRow(
                            row.id,
                            "amount",
                            row.amount ? money(row.amount) : ""
                          )
                        }
                        placeholder="0.00"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-3">
                      <label className="text-xs text-gray-500 block mb-1">Method</label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={row.method}
                        onChange={(e) => updatePaymentRow(row.id, "method", e.target.value)}
                      >
                        <option>Cash</option>
                        <option>Transfer</option>
                        <option>Card</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div className="col-span-12 md:col-span-5">
                      <label className="text-xs text-gray-500 block mb-1">Reference</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={row.reference}
                        onChange={(e) => updatePaymentRow(row.id, "reference", e.target.value)}
                        placeholder="Optional"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-1 flex md:justify-end">
                      <button
                        type="button"
                        onClick={() => removePaymentRow(row.id)}
                        disabled={paymentRows.length === 1}
                        className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Bill Balance</div>
                <div className="text-lg font-semibold mt-1">£{money(balance)}</div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Payment Total</div>
                <div className="text-lg font-semibold mt-1 text-blue-700">
                  £{money(paymentDraftTotal)}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  Remaining After Save
                </div>
                <div
                  className={`text-lg font-semibold mt-1 ${
                    remainingAfterDraft < -0.009
                      ? "text-red-600"
                      : remainingAfterDraft === 0
                      ? "text-green-600"
                      : "text-orange-600"
                  }`}
                >
                  £{money(remainingAfterDraft)}
                </div>
              </div>
            </div>

            {paymentDraftTotal - balance > 0.009 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                The sum of all payment methods cannot exceed the current balance.
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={addPayment}
                disabled={saving || !isDraftValid}
                className="px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium disabled:bg-green-300"
              >
                {saving ? "Saving payments..." : "Save Payments"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="font-semibold mb-3 text-lg">Payments</div>
        {!payments.length ? (
          <div className="text-sm text-gray-600">No payments yet.</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-3 py-3 text-left">Date</th>
                  <th className="border-b px-3 py-3 text-right">Amount</th>
                  <th className="border-b px-3 py-3 text-left">Method</th>
                  <th className="border-b px-3 py-3 text-left">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="border-b px-3 py-3">
                      {new Date(p.paidAt || p.createdAt).toLocaleString()}
                    </td>
                    <td className="border-b px-3 py-3 text-right font-medium">
                      £{money(p.amount || 0)}
                    </td>
                    <td className="border-b px-3 py-3">
                      <div className="flex items-center gap-2">
                        {paymentMethodIcon(p.method)}
                        <span>{p.method}</span>
                      </div>
                    </td>
                    <td className="border-b px-3 py-3">{p.reference || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="font-semibold mb-3">Guides ({bill?.guides?.length || 0})</div>
          <div className="overflow-auto border rounded-xl max-h-[360px]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-2 py-2 text-left">#</th>
                  <th className="border-b px-2 py-2 text-right">Value</th>
                  <th className="border-b px-2 py-2 text-left">Desc</th>
                </tr>
              </thead>
              <tbody>
                {(bill?.guides || []).map((g, idx) => (
                  <tr key={`${g.guideNumber}-${idx}`}>
                    <td className="border-b px-2 py-2">{g.guideNumber}</td>
                    <td className="border-b px-2 py-2 text-right">£{money(g.value || 0)}</td>
                    <td className="border-b px-2 py-2">{g.description}</td>
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="font-semibold mb-3">Services ({bill?.services?.length || 0})</div>
          <div className="overflow-auto border rounded-xl max-h-[360px]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-2 py-2 text-left">Name</th>
                  <th className="border-b px-2 py-2 text-center">Qty</th>
                  <th className="border-b px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(bill?.services || []).map((s, idx) => (
                  <tr key={`${s.name}-${idx}`}>
                    <td className="border-b px-2 py-2">{s.name}</td>
                    <td className="border-b px-2 py-2 text-center">{s.quantity}</td>
                    <td className="border-b px-2 py-2 text-right">£{money(s.total || 0)}</td>
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="font-semibold mb-3">Items ({bill?.items?.length || 0})</div>
          <div className="overflow-auto border rounded-xl max-h-[360px]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-2 py-2 text-left">Desc</th>
                  <th className="border-b px-2 py-2 text-center">Qty</th>
                  <th className="border-b px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(bill?.items || []).map((it, idx) => (
                  <tr key={`${it.description}-${idx}`}>
                    <td className="border-b px-2 py-2">{it.description}</td>
                    <td className="border-b px-2 py-2 text-center">{it.quantity}</td>
                    <td className="border-b px-2 py-2 text-right">£{money(it.total || 0)}</td>
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