"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1/api";

/* ================== TYPES ================== */

interface GuideLite {
  _id: string;
  number: string;
  recipientName: string;
  destinationCountry: string;
  weightKg: number;
  pieces: number;
  description: string;
  createdAt: string;
}

interface LoadunitLite {
  _id: string;
  number: string;
  company: string;
  originCountry: string;
  destinationCountry: string;
  serviceType: string;
  agency: string;
  pieces: number;
  weightKg: number;
  value: number;
  createdAt: string;
}

/* ================== API HELPERS ================== */

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

// Guías sin Consolidado ni Loadunit
async function fetchUnassignedGuides(): Promise<GuideLite[]> {
  const data = await apiFetch(`/guides/unassigned-for-consolidated`);
  return (data.data || []) as GuideLite[];
}

// Loadunits libres (no usados en ningún Consolidado)
async function fetchUnassignedLoadunits(): Promise<LoadunitLite[]> {
  const data = await apiFetch(`/loadunits/unassigned-for-consolidated`);
  return (data.data || []) as LoadunitLite[];
}

// Crear Consolidado
async function createConsolidatedApi(payload: any) {
  const data = await apiFetch(`/consolidated`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.data;
}

/* ================== PAGE COMPONENT ================== */

const ConsolidatedCreatePage = () => {
  const router = useRouter();
  const { token } = useAuth();

  const [guides, setGuides] = useState<GuideLite[]>([]);
  const [loadunits, setLoadunits] = useState<LoadunitLite[]>([]);

  const [selectedGuideIds, setSelectedGuideIds] = useState<string[]>([]);
  const [selectedLoadunitIds, setSelectedLoadunitIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    number: "",
    company: "Vía logistics UK",
    originCountry: "Inglaterra",
    destinationCountry: "",
    serviceType: "Aéreo",
    agency: "",
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdNumber, setCreatedNumber] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [g, lus] = await Promise.all([
        fetchUnassignedGuides(),
        fetchUnassignedLoadunits(),
      ]);

      setGuides(g);
      setLoadunits(lus);
      setSelectedGuideIds([]);
      setSelectedLoadunitIds([]);
    } catch (e: any) {
      setError(e.message || "Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleGuide = (id: string) => {
    setSelectedGuideIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleLoadunit = (id: string) => {
    setSelectedLoadunitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (
      !form.number ||
      (!selectedGuideIds.length && !selectedLoadunitIds.length)
    ) {
      setError(
        "Debes ingresar número de consolidado y seleccionar al menos una guía o un loadunit."
      );
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const payload = {
        number: form.number,
        company: form.company,
        originCountry: form.originCountry,
        destinationCountry: form.destinationCountry,
        serviceType: form.serviceType,
        agency: form.agency,
        description: form.description,
        guideIds: selectedGuideIds,
        loadunitIds: selectedLoadunitIds,
      };

      const consolidated = await createConsolidatedApi(payload);

      setCreatedNumber(consolidated.number);
      setSelectedGuideIds([]);
      setSelectedLoadunitIds([]);
      await loadData();
    } catch (e: any) {
      setError(e.message || "Error creando consolidado");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Crear Consolidado</h1>
        <button
          className="px-3 py-1 text-xs rounded border border-slate-300"
          onClick={() => router.push("/admin/consolidated")}
        >
          Volver al listado
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* FORM */}
      <div className="bg-white shadow rounded-lg p-4 space-y-3 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Número de Consolidado
            </label>
            <input
              className="w-full border px-2 py-1 rounded"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Empresa
            </label>
            <input
              className="w-full border px-2 py-1 rounded"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              País origen
            </label>
            <input
              className="w-full border px-2 py-1 rounded"
              value={form.originCountry}
              onChange={(e) =>
                setForm({ ...form, originCountry: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              País destino
            </label>
            <input
              className="w-full border px-2 py-1 rounded"
              value={form.destinationCountry}
              onChange={(e) =>
                setForm({ ...form, destinationCountry: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Tipo de envío
            </label>
            <input
              className="w-full border px-2 py-1 rounded"
              value={form.serviceType}
              onChange={(e) =>
                setForm({ ...form, serviceType: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Agencia
            </label>
            <input
              className="w-full border px-2 py-1 rounded"
              value={form.agency}
              onChange={(e) =>
                setForm({ ...form, agency: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Descripción del consolidado
          </label>
          <textarea
            className="w-full border px-2 py-1 rounded"
            rows={2}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />
        </div>

        <div className="flex justify-between items-center text-xs">
          <div className="space-x-4">
            <span>
              Guías seleccionadas:{" "}
              <strong>{selectedGuideIds.length}</strong>
            </span>
            <span>
              Loadunits seleccionados:{" "}
              <strong>{selectedLoadunitIds.length}</strong>
            </span>
          </div>

          <button
            className="px-3 py-1 text-xs rounded bg-green-600 text-white disabled:bg-green-300"
            disabled={creating}
            onClick={handleCreate}
          >
            {creating ? "Creando..." : "Crear Consolidado"}
          </button>
        </div>
      </div>

      {/* GUIAS DISPONIBLES */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            Guías disponibles (sin Consolidado ni Loadunit)
          </h2>
          {loading && (
            <span className="text-xs text-gray-500">Cargando...</span>
          )}
        </div>

        <div className="overflow-auto border rounded max-h-[350px]">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-1 text-center">Sel.</th>
                <th className="border px-2 py-1 text-left">Número</th>
                <th className="border px-2 py-1 text-left">Beneficiario</th>
                <th className="border px-2 py-1 text-left">
                  País / Dirección
                </th>
                <th className="border px-2 py-1 text-center">Piezas</th>
                <th className="border px-2 py-1 text-center">Peso Kg</th>
                <th className="border px-2 py-1 text-left">Descripción</th>
                <th className="border px-2 py-1 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(guides ?? []).map((g) => {
                const checked = selectedGuideIds.includes(g._id);
                return (
                  <tr key={g._id} className={checked ? "bg-sky-50" : ""}>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGuide(g._id)}
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <span className="inline-flex px-2 py-0.5 rounded bg-green-600 text-white text-[10px] font-semibold">
                        {g.number}
                      </span>
                    </td>
                    <td className="border px-2 py-1">{g.recipientName}</td>
                    <td className="border px-2 py-1">
                      {g.destinationCountry}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      {g.pieces}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      {g.weightKg.toFixed(2)}
                    </td>
                    <td className="border px-2 py-1 truncate max-w-[220px]">
                      {g.description}
                    </td>
                    <td className="border px-2 py-1">
                      {new Date(g.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}

              {(!guides || !guides.length) && !loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center px-2 py-4 text-gray-500"
                  >
                    No hay guías disponibles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOADUNITS DISPONIBLES */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            Loadunits disponibles (sin Consolidado)
          </h2>
        </div>

        <div className="overflow-auto border rounded max-h-[350px]">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-1 text-center">Sel.</th>
                <th className="border px-2 py-1 text-left">Número</th>
                <th className="border px-2 py-1 text-left">Agencia</th>
                <th className="border px-2 py-1 text-left">Origen</th>
                <th className="border px-2 py-1 text-left">Destino</th>
                <th className="border px-2 py-1 text-left">Tipo envío</th>
                <th className="border px-2 py-1 text-center">Piezas</th>
                <th className="border px-2 py-1 text-center">Peso Kg</th>
                <th className="border px-2 py-1 text-center">Valor</th>
                <th className="border px-2 py-1 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(loadunits ?? []).map((lu) => {
                const checked = selectedLoadunitIds.includes(lu._id);
                return (
                  <tr key={lu._id} className={checked ? "bg-sky-50" : ""}>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLoadunit(lu._id)}
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <span className="inline-flex px-2 py-0.5 rounded bg-slate-700 text-white text-[10px] font-semibold">
                        {lu.number}
                      </span>
                    </td>
                    <td className="border px-2 py-1">{lu.agency}</td>
                    <td className="border px-2 py-1">{lu.originCountry}</td>
                    <td className="border px-2 py-1">{lu.destinationCountry}</td>
                    <td className="border px-2 py-1">{lu.serviceType}</td>
                    <td className="border px-2 py-1 text-center">
                      {lu.pieces}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      {lu.weightKg.toFixed(2)}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      {lu.value.toFixed(2)}
                    </td>
                    <td className="border px-2 py-1">
                      {new Date(lu.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}

              {(!loadunits || !loadunits.length) && !loading && (
                <tr>
                  <td
                    colSpan={10}
                    className="text-center px-2 py-4 text-gray-500"
                  >
                    No hay loadunits disponibles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createdNumber && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded text-xs">
          Consolidado <strong>{createdNumber}</strong> creado correctamente.
        </div>
      )}
    </div>
  );
};

export default ConsolidatedCreatePage;
