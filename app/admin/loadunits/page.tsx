"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1/api";

type StatusType =
  | "CREATED"
  | "CONSOLIDATED"
  | "IN_TRANSIT"
  | "CLOSED"
  | "CANCELLED"
  | "";

interface LoadunitGuide {
  guide: string;
  guideNumber: string;
  pieces: number;
  weightKg: number;
  weightLb: number;
  tariffWeight: number;
  volumeM3: number;
  volumeCf: number;
  value: number;
  description: string;
}

interface LoadunitTotals {
  pieces: number;
  weightKg: number;
  weightLb: number;
  pVol: number;
  tariffWeight: number;
  volumeM3: number;
  volumeCf: number;
  value: number;
}

interface Loadunit {
  _id: string;
  number: string;
  company: string;
  originCountry: string;
  destinationCountry: string;
  serviceType: string;
  agency: string;
  description: string;
  status: string;
  guides: LoadunitGuide[];
  totals: LoadunitTotals;
  createdAt: string;
}

// --------- helpers API locales ---------
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
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

async function fetchLoadunits(filters: Record<string, any>): Promise<Loadunit[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      params.append(k, String(v));
    }
  });

  const data = await apiFetch(`/loadunits?${params.toString()}`);
  return data.data as Loadunit[];
}

async function fetchLoadunit(id: string): Promise<Loadunit> {
  const data = await apiFetch(`/loadunits/${id}`);
  return data.data as Loadunit;
}

async function downloadLoadunitPdf(id: string) {
  const token =
    (typeof window !== "undefined" && localStorage.getItem("token")) || "";

  const res = await fetch(`${API_URL}/loadunits/${id}/pdf`, {
    method: "GET",
    headers: token ? { Authorization: `jwt ${token}` } : {},
  });

  if (!res.ok) throw new Error("Error al generar PDF de loadunit");

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `loadunit_${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// --------- componente página ---------
const LoadunitsListPage = () => {
  const [items, setItems] = useState<Loadunit[]>([]);
  const [selected, setSelected] = useState<Loadunit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<{
    q: string;
    from: string;
    to: string;
    status: StatusType | "";
    serviceType: string;
  }>({
    q: "",
    from: "",
    to: "",
    status: "",
    serviceType: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLoadunits(filters);
      setItems(data);
    } catch (e: any) {
      setError(e.message || "Error cargando loadunits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const handleSelect = async (id: string) => {
    try {
      setError(null);
      const lu = await fetchLoadunit(id);
      setSelected(lu);
    } catch (e: any) {
      setError(e.message || "Error cargando detalle");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Título + botón nuevo */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lista de Loadunits</h1>
        <Link
          href="/admin/loadunits/create"
          className="px-4 py-2 rounded bg-green-600 text-white text-sm shadow hover:bg-green-700"
        >
          Nuevo Loadunit
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Búsqueda</label>
            <input
              className="w-full border px-2 py-1 rounded"
              placeholder="Número / descripción"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              className="w-full border px-2 py-1 rounded"
              value={filters.from}
              onChange={(e) =>
                setFilters({ ...filters, from: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              className="w-full border px-2 py-1 rounded"
              value={filters.to}
              onChange={(e) =>
                setFilters({ ...filters, to: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Estatus</label>
            <select
              className="w-full border px-2 py-1 rounded"
              value={filters.status}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value as StatusType | "",
                })
              }
            >
              <option value="">Cualquiera</option>
              <option value="CREATED">CREATED</option>
              <option value="CONSOLIDATED">CONSOLIDATED</option>
              <option value="IN_TRANSIT">IN_TRANSIT</option>
              <option value="CLOSED">CLOSED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 text-xs">
          <button
            className="px-3 py-1 rounded border"
            onClick={() =>
              setFilters({
                q: "",
                from: "",
                to: "",
                status: "",
                serviceType: "",
              })
            }
          >
            Limpiar
          </button>
          <button
            className="px-3 py-1 rounded bg-sky-600 text-white"
            onClick={loadData}
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Listado + detalle */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LISTA */}
        <div className="xl:col-span-2 bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Resultados</h2>
            {loading && (
              <span className="text-xs text-gray-500">Cargando...</span>
            )}
          </div>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-1 text-left">Número</th>
                  <th className="border px-2 py-1 text-left">Empresa</th>
                  <th className="border px-2 py-1 text-left">Fecha</th>
                  <th className="border px-2 py-1 text-left">Estatus</th>
                  <th className="border px-2 py-1 text-left">País Destino</th>
                  <th className="border px-2 py-1 text-left">Descripción</th>
                  <th className="border px-2 py-1 text-right">Peso</th>
                  <th className="border px-2 py-1 text-right">PVol</th>
                  <th className="border px-2 py-1 text-center">PDF</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lu) => (
                  <tr
                    key={lu._id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selected?._id === lu._id ? "bg-sky-50" : ""
                    }`}
                    onClick={() => handleSelect(lu._id)}
                  >
                    <td className="border px-2 py-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-600 text-white text-xs font-semibold">
                        {lu.number}
                      </span>
                    </td>
                    <td className="border px-2 py-1">{lu.company}</td>
                    <td className="border px-2 py-1">
                      {new Date(lu.createdAt).toLocaleString()}
                    </td>
                    <td className="border px-2 py-1">{lu.status}</td>
                    <td className="border px-2 py-1">
                      {lu.destinationCountry}
                    </td>
                    <td className="border px-2 py-1 truncate max-w-[180px]">
                      {lu.description}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {lu.totals?.weightKg?.toFixed(2)}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {lu.totals?.pVol?.toFixed(2)}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        className="text-[10px] px-2 py-1 rounded bg-gray-800 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadLoadunitPdf(lu._id).catch((err) =>
                            setError(err.message || "Error generando PDF")
                          );
                        }}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}

                {!items.length && !loading && (
                  <tr>
                    <td
                      colSpan={9}
                      className="text-center px-2 py-4 text-gray-500"
                    >
                      No hay loadunits.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DETALLE */}
        <div className="bg-white shadow rounded-lg p-4 text-xs space-y-2">
          <h2 className="text-sm font-semibold mb-1">Detalle de Loadunit</h2>
          {!selected && (
            <div className="text-gray-500 text-xs">
              Selecciona un loadunit de la lista para ver sus detalles.
            </div>
          )}

          {selected && (
            <>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="text-[11px] text-gray-500">Número</div>
                  <div className="font-semibold text-sm">
                    {selected.number}
                  </div>
                </div>
                <button
                  className="px-2 py-1 text-[10px] rounded bg-gray-800 text-white"
                  onClick={() =>
                    downloadLoadunitPdf(selected._id).catch((err) =>
                      setError(err.message || "Error generando PDF")
                    )
                  }
                >
                  PDF Consolidado
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-gray-500">Empresa</div>
                  <div className="font-semibold">{selected.company}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">
                    País destino
                  </div>
                  <div className="font-semibold">
                    {selected.destinationCountry}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">
                    Tipo de envío
                  </div>
                  <div className="font-semibold">
                    {selected.serviceType}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Estatus</div>
                  <div className="font-semibold">{selected.status}</div>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-gray-500">Descripción</div>
                <div className="text-xs">{selected.description}</div>
              </div>

              <div className="border rounded p-2">
                <h3 className="font-semibold mb-1 text-[11px]">
                  Totales en Loadunit
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[11px] text-gray-500">Piezas</div>
                    <div className="font-semibold">
                      {selected.totals?.pieces || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">Peso (Kg)</div>
                    <div className="font-semibold">
                      {selected.totals?.weightKg?.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">PVol</div>
                    <div className="font-semibold">
                      {selected.totals?.pVol?.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">
                      P.Tarifado
                    </div>
                    <div className="font-semibold">
                      {selected.totals?.tariffWeight?.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">
                      Volumen Mt3
                    </div>
                    <div className="font-semibold">
                      {selected.totals?.volumeM3?.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">Valor ($)</div>
                    <div className="font-semibold">
                      {selected.totals?.value?.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded p-2 max-h-64 overflow-auto">
                <h3 className="font-semibold text-[11px] mb-1">
                  Guías en este Loadunit
                </h3>
                <table className="min-w-full text-[11px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-1 py-1 text-left">Número</th>
                      <th className="border px-1 py-1 text-center">Pzs</th>
                      <th className="border px-1 py-1 text-center">
                        Peso Kg
                      </th>
                      <th className="border px-1 py-1 text-right">Valor $</th>
                      <th className="border px-1 py-1 text-left">
                        Descripción
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.guides?.map((g) => (
                      <tr key={g.guide}>
                        <td className="border px-1 py-1">
                          <span className="inline-flex px-2 py-0.5 rounded bg-green-600 text-white text-[10px] font-semibold">
                            {g.guideNumber}
                          </span>
                        </td>
                        <td className="border px-1 py-1 text-center">
                          {g.pieces}
                        </td>
                        <td className="border px-1 py-1 text-center">
                          {g.weightKg.toFixed(2)}
                        </td>
                        <td className="border px-1 py-1 text-right">
                          {g.value.toFixed(2)}
                        </td>
                        <td className="border px-1 py-1 truncate max-w-[150px]">
                          {g.description}
                        </td>
                      </tr>
                    ))}

                    {!selected.guides?.length && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center px-2 py-3 text-gray-500"
                        >
                          No hay guías asociadas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadunitsListPage;
