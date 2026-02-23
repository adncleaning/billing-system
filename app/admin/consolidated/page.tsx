"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1/api";

interface ConsolidatedTotals {
  pieces: number;
  weightKg: number;
  weightLb: number;
  pVol: number;
  tariffWeight: number;
  volumeM3: number;
  volumeCf: number;
  value: number;
}

interface Consolidated {
  _id: string;
  number: string;
  company: string;
  originCountry: string;
  destinationCountry: string;
  serviceType: string;
  agency: string;
  description: string;
  status: string;
  totals: ConsolidatedTotals;
  createdAt: string;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token =
    (typeof window !== "undefined" && localStorage.getItem("token")) || "";

  const headers: Record<string, string> = {};

  if (options.headers instanceof Headers) {
    options.headers.forEach((v, k) => (headers[k] = v));
  } else if (Array.isArray(options.headers)) {
    for (const [k, v] of options.headers) headers[k] = v;
  } else if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  if (token) headers.Authorization = `jwt ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let msg = "Error en la petición";
    try {
      const err = await res.json();
      msg = err?.message || msg;
    } catch { }
    throw new Error(msg);
  }
  return res.json();
}

async function fetchConsolidated(params: {
  page?: number;
  q?: string;
}): Promise<{ items: Consolidated[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.q) searchParams.set("q", params.q);

  const query = searchParams.toString();
  const data = await apiFetch(`/consolidated${query ? `?${query}` : ""}`);

  return {
    items: data.data as Consolidated[],
    total: data.pagination?.total || 0,
  };
}

const ConsolidatedListPage = () => {
  const router = useRouter();
  const { token } = useAuth();

  const [items, setItems] = useState<Consolidated[]>([]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (newPage = 1) => {
    try {
      setLoading(true);
      setError(null);
      const { items, total } = await fetchConsolidated({ page: newPage, q });
      setItems(items);
      setPage(newPage);
      // si quieres usar "total" para paginación, guárdalo en estado
    } catch (e: any) {
      setError(e.message || "Error cargando consolidados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSearch = () => {
    load(1);
  };

  const openPdf = async (id: string) => {
    try {
      const token =
        (typeof window !== "undefined" && localStorage.getItem("token")) || "";
      const url = `${API_URL}/consolidated/${id}/pdf`;

      const res = await fetch(url, {
        method: "GET",
        headers: token ? { Authorization: `jwt ${token}` } : {},
      });

      if (!res.ok) throw new Error("Error generando PDF");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (e) {
      console.error(e);
      alert("No se pudo abrir el PDF del consolidado");
    }
  };
  const downloadExcel = async (id: string) => {
    try {
      const token =
        (typeof window !== "undefined" && localStorage.getItem("token")) || "";
      const url = `${API_URL}/consolidated/${id}/excel`;

      const res = await fetch(url, {
        method: "GET",
        headers: token ? { Authorization: `jwt ${token}` } : {},
      });

      if (!res.ok) throw new Error("Error generando Excel");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `consolidated_${id}.xlsx`;
      a.click();

      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error(e);
      alert("No se pudo descargar el Excel del consolidado");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Consolidados</h1>
        <button
          className="px-3 py-1 text-xs rounded bg-green-600 text-white"
          onClick={() => router.push("/admin/consolidated/create")}
        >
          Crear Consolidado
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">
              Búsqueda (número / descripción)
            </label>
            <div className="flex gap-2">
              <input
                className="w-full border px-2 py-1 rounded"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                onClick={handleSearch}
                className="px-3 py-1 text-xs rounded bg-slate-700 text-white"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Listado de Consolidados</h2>
          {loading && (
            <span className="text-xs text-gray-500">Cargando...</span>
          )}
        </div>

        <div className="overflow-auto border rounded max-h-[600px]">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-1 text-left">Número</th>
                <th className="border px-2 py-1 text-left">Agencia</th>
                <th className="border px-2 py-1 text-left">Origen</th>
                <th className="border px-2 py-1 text-left">Destino</th>
                <th className="border px-2 py-1 text-left">Tipo envío</th>
                <th className="border px-2 py-1 text-center">Piezas</th>
                <th className="border px-2 py-1 text-center">Peso Kg</th>
                <th className="border px-2 py-1 text-center">Valor</th>
                <th className="border px-2 py-1 text-left">Estado</th>
                <th className="border px-2 py-1 text-left">Fecha</th>
                <th className="border px-2 py-1 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((c) => (
                <tr key={c._id}>
                  <td className="border px-2 py-1">
                    <span className="inline-flex px-2 py-0.5 rounded bg-green-600 text-white text-[10px] font-semibold">
                      {c.number}
                    </span>
                  </td>
                  <td className="border px-2 py-1">{c.agency}</td>
                  <td className="border px-2 py-1">{c.originCountry}</td>
                  <td className="border px-2 py-1">{c.destinationCountry}</td>
                  <td className="border px-2 py-1">{c.serviceType}</td>
                  <td className="border px-2 py-1 text-center">
                    {c.totals?.pieces || 0}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {(c.totals?.weightKg || 0).toFixed(2)}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {(c.totals?.value || 0).toFixed(2)}
                  </td>
                  <td className="border px-2 py-1">{c.status}</td>
                  <td className="border px-2 py-1">
                    {new Date(c.createdAt).toLocaleString()}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    <button
                      className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 hover:bg-slate-100 mr-1"
                      onClick={() => openPdf(c._id)}
                    >
                      PDF
                    </button>
                    <button
                      className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 hover:bg-slate-100 mr-1"
                      onClick={() => downloadExcel(c._id)}
                    >
                      Excel
                    </button>
                    {/* Si luego quieres editar: */}
                    {/* <button
                      className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 hover:bg-slate-100"
                      onClick={() => router.push(`/admin/consolidated/${c._id}`)}
                    >
                      Ver
                    </button> */}
                  </td>
                </tr>
              ))}

              {(!items || !items.length) && !loading && (
                <tr>
                  <td
                    colSpan={11}
                    className="text-center px-2 py-4 text-gray-500"
                  >
                    No hay consolidados registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ConsolidatedListPage;
