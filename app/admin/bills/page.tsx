"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1/api";

type Bill = {
  _id: string;
  number: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
  totals?: { total?: number; paid?: number; balance?: number };
  client?: { name?: string; email?: string };
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

export default function BillsPage() {
  const [items, setItems] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badge = (s: Bill["status"]) => {
    const base = "px-2 py-0.5 rounded text-[11px] font-semibold";
    if (s === "PAID") return `${base} bg-green-100 text-green-800`;
    if (s === "PARTIAL") return `${base} bg-yellow-100 text-yellow-800`;
    if (s === "CANCELLED") return `${base} bg-red-100 text-red-800`;
    return `${base} bg-gray-100 text-gray-800`;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bills</h1>
        <Link
          href="/admin/bills/create"
          className="px-3 py-2 rounded bg-green-600 text-white text-sm"
        >
          + New Bill
        </Link>
      </div>

      <div className="bg-white rounded shadow p-3 flex gap-2 items-end">
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
          onClick={load}
          className="px-3 py-2 rounded bg-blue-600 text-white text-sm"
        >
          {loading ? "Loading..." : "Filter"}
        </button>
      </div>

      <div className="bg-white rounded shadow overflow-auto">
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
                <td className="border px-2 py-2">
                  {b.number || b._id.slice(-6)}
                </td>
                <td className="border px-2 py-2">{b.client?.name || "—"}</td>
                <td className="border px-2 py-2 text-center">
                  <span className={badge(b.status)}>{b.status}</span>
                </td>
                <td className="border px-2 py-2 text-right">
                  {(b.totals?.total || 0).toFixed(2)}
                </td>
                <td className="border px-2 py-2 text-right">
                  {(b.totals?.paid || 0).toFixed(2)}
                </td>
                <td className="border px-2 py-2 text-right">
                  {(b.totals?.balance || 0).toFixed(2)}
                </td>
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
    </div>
  );
}
