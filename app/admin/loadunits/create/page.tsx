"use client";

import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1/api";

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
  description: string;
  destinationCountry: string;
  serviceType: string;
  agency: string;
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

// ---------- mapeo de guía cruda -> GuideLite ----------
function mapGuideToLite(g: any): GuideLite {
  const kg = Number(g.weightToPay || g.measureValue || 0) || 0;
  const pieces =
    (Array.isArray(g.packages) && g.packages.length > 0
      ? g.packages.length
      : 1) || 1;

  return {
    _id: g._id,
    number: g.number || String(g._id).slice(-6),
    recipientName: g.recipient?.name || "",
    // si más adelante agregas destinationCountry en el modelo, esto ya lo recoge
    destinationCountry: g.destinationCountry || "",
    weightKg: kg,
    pieces,
    description:
      g.packages?.[0]?.description ||
      g.observations ||
      "",
    createdAt: g.createdAt,
  };
}

// guías sin loadunit (nuevo endpoint)
async function fetchUnassignedGuides(): Promise<GuideLite[]> {
  const data = await apiFetch(`/loadunits/guides/unassigned`);
  const rawGuides = (data && (data.guides as any[])) || [];
  return rawGuides.map(mapGuideToLite);
}

async function createLoadunitApi(payload: any): Promise<Loadunit> {
  const data = await apiFetch(`/loadunits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.data as Loadunit;
}

// --------- componente página ---------
const LoadunitCreatePage = () => {
  const [guides, setGuides] = useState<GuideLite[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    number: "",
    destinationCountry: "",
    serviceType: "Aéreo",
    agency: "",
    description: "",
  });
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Loadunit | null>(null);

  const loadGuides = async () => {
    try {
      setLoadingGuides(true);
      setError(null);
      const g = await fetchUnassignedGuides();
      setGuides(g);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error cargando guías");
    } finally {
      setLoadingGuides(false);
    }
  };

  useEffect(() => {
    loadGuides();
  }, []);

  const toggleGuide = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!form.number || !selectedIds.length) {
      setError(
        "Debes ingresar número de loadunit y seleccionar al menos una guía."
      );
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const payload = {
        number: form.number,
        destinationCountry: form.destinationCountry,
        serviceType: form.serviceType,
        agency: form.agency,
        description: form.description,
        guideIds: selectedIds,
      };

      const lu = await createLoadunitApi(payload);
      setCreated(lu);
      setSelectedIds([]);
      await loadGuides();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error creando loadunit");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Crear Loadunit</h1>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Formulario */}
      <div className="bg-white shadow rounded-lg p-4 space-y-3 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Número de Loadunit
            </label>
            <input
              className="w-full border px-2 py-1 rounded"
              value={form.number}
              onChange={(e) =>
                setForm({ ...form, number: e.target.value })
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
            Descripción (ej: Caja 5)
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

        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-600">
            Guías seleccionadas:{" "}
            <span className="font-semibold">{selectedIds.length}</span>
          </div>
          <button
            className="px-3 py-1 text-xs rounded bg-green-600 text-white disabled:bg-green-300"
            disabled={creating}
            onClick={handleCreate}
          >
            {creating ? "Creando..." : "Crear Loadunit"}
          </button>
        </div>
      </div>

      {/* Guías sin loadunit */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            Guías sin Loadunit asignado
          </h2>
          {loadingGuides && (
            <span className="text-xs text-gray-500">Cargando...</span>
          )}
        </div>

        <div className="overflow-auto border rounded max-h-[500px]">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-1 text-center">Sel.</th>
                <th className="border px-2 py-1 text-left">Número</th>
                <th className="border px-2 py-1 text-left">Beneficiario</th>
                <th className="border px-2 py-1 text-left">País Destino</th>
                <th className="border px-2 py-1 text-center">Piezas</th>
                <th className="border px-2 py-1 text-center">Peso Kg</th>
                <th className="border px-2 py-1 text-left">Descripción</th>
                <th className="border px-2 py-1 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(guides ?? []).map((g) => {
                const checked = selectedIds.includes(g._id);
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
                    <td className="border px-2 py-1">{g.destinationCountry}</td>
                    <td className="border px-2 py-1 text-center">
                      {g.pieces}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      {g.weightKg.toFixed(2)}
                    </td>
                    <td className="border px-2 py-1 truncate max-w-[200px]">
                      {g.description}
                    </td>
                    <td className="border px-2 py-1">
                      {new Date(g.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}

              {(!guides || !guides.length) && !loadingGuides && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center px-2 py-4 text-gray-500"
                  >
                    No hay guías pendientes de loadunit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {created && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded text-xs">
          Loadunit <strong>{created.number}</strong> creado correctamente con{" "}
          {created.guides.length} guía(s).
        </div>
      )}
    </div>
  );
};

export default LoadunitCreatePage;
