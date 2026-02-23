"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Api, useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import Modal from "@/components/Modal";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Search,
  Route,
  Loader2,
  ExternalLink,
} from "lucide-react";

/** ✅ Mapa (Leaflet) - ya NO se usa en el calendario, pero lo dejo por si luego quieres mini preview */
// const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false });

/** -------------------- Types -------------------- */
type ClientLite = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
};

type CollectionStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "EN_ROUTE"
  | "COLLECTED"
  | "AT_WAREHOUSE"
  | "COMPLETED"
  | "CANCELLED";

type Collection = {
  _id: string;
  client: ClientLite;
  address: string;
  postcode: string;
  pickupAt: string;
  status: CollectionStatus;
  notes?: string;
};

type TimeSlot = "morning" | "afternoon" | "evening";

type Waypoint = {
  address: string;
  lat: number;
  lng: number;
  code?: string; // postcode
  timeSlot?: TimeSlot;
};

type OptimizeResult = {
  total?: {
    distance_km?: number;
    duration_human?: string;
    fuel_cost?: number;
  };
  normalizedStops?: Array<
    Waypoint & {
      isHQ?: boolean;
      timeSlot?: string; // backend puede enviar "office"
    }
  >;
  order?: number[];
  stopsOnlyOrder?: number[]; // si lo agregaste en backend
  geometry?: { type: "LineString"; coordinates: [number, number][] };
  roundTrip?: boolean;
  segmentBoundaries?: any[];
};

/** -------------------- Helpers Visuales -------------------- */
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtDayLabel(d: Date) {
  const parts = d.toISOString().slice(0, 10).split("-");
  return `${["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()]}-${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function pickTimeSlot(iso: string): TimeSlot {
  const h = new Date(iso).getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const UK_POSTCODE_RE = /([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;
function extractPostcode(text = "") {
  const m = String(text).toUpperCase().match(UK_POSTCODE_RE);
  if (!m) return "";
  return m[1].replace(/\s+/g, ""); // "SE22 8JJ" -> "SE228JJ"
}

export default function CollectionsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { showToast } = useToast();

  // Estados de Calendario
  const [anchor, setAnchor] = useState(() => new Date());
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Estados de Datos
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Estados del Formulario
  const [openAdd, setOpenAdd] = useState(false);
  const [senderSearch, setSenderSearch] = useState("");
  const [senderClientId, setSenderClientId] = useState("");

  const [form, setForm] = useState({
    address: "",
    postcode: "",
    pickupDate: new Date().toISOString().slice(0, 10),
    pickupTime: "09:00",
    notes: "",
  });

  const [openSummary, setOpenSummary] = useState(false);
  const [selected, setSelected] = useState<Collection | null>(null);

  /** ✅ Selección múltiple por día */
  const [selectedByDay, setSelectedByDay] = useState<Record<string, string[]>>({});

  /** ✅ Resultado de ruta por día */
  const [routeByDay, setRouteByDay] = useState<Record<string, OptimizeResult | null>>({});
  const [routeLoadingByDay, setRouteLoadingByDay] = useState<Record<string, boolean>>({});

  /** ✅ Cache de geocode en memoria */
  const geocodeCacheRef = useRef<Map<string, { lat: number; lng: number; formatted?: string }>>(new Map());

  /** 1. Carga inicial de datos */
  useEffect(() => {
    if (token) {
      loadCollections();
      loadClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, weekStart.getTime()]);

  async function loadCollections() {
    setLoading(true);
    try {
      const from = new Date(weekStart).toISOString();
      const to = addDays(weekStart, 7).toISOString();
      const data: any = await Api("GET", `collections?from=${from}&to=${to}`, null, router);
      setItems(data?.data || data?.collections || []);
    } catch (e: any) {
      showToast("Error loading collections", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    try {
      const data: any = await Api("GET", "clients", null, router);
      if (data?.success) setClients(data.clients || []);
    } catch {
      showToast("Error loading clients", "error");
    } finally {
      setLoadingClients(false);
    }
  }

  /** 2. Lógica de selección y auto-llenado automático */
  const handleClientChange = (id: string) => {
    setSenderClientId(id);
    const client = clients.find((c) => c._id === id);

    if (client && client.address) {
      const { street, city, state, zipCode } = client.address;

      const addressParts = [street, city, state].filter((p) => p && p.trim() !== "");
      const fullAddress = addressParts.join(", ");

      setForm((prev) => ({
        ...prev,
        address: fullAddress,
        postcode: zipCode || "",
      }));
    } else {
      setForm((prev) => ({ ...prev, address: "", postcode: "" }));
    }
  };

  /** 3. Lógica de búsqueda */
  const filteredClients = useMemo(() => {
    const t = senderSearch.toLowerCase().trim();
    if (!t) return clients;
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(t) ||
        c.phone?.toLowerCase().includes(t) ||
        c.email?.toLowerCase().includes(t)
    );
  }, [clients, senderSearch]);

  const selectedClientDetail = useMemo(() => {
    return clients.find((c) => c._id === senderClientId) || null;
  }, [clients, senderClientId]);

  /** 4. Guardado */
  async function createCollection() {
    if (!senderClientId) return showToast("Seleccione un cliente", "error");
    if (!form.address.trim()) return showToast("Dirección requerida", "error");

    try {
      const pickupAt = new Date(`${form.pickupDate}T${form.pickupTime}:00`).toISOString();
      const payload = {
        clientId: senderClientId,
        address: form.address.trim(),
        postcode: form.postcode.trim(),
        pickupAt,
        notes: form.notes?.trim() || "",
      };

      await Api("POST", "collections", payload, router);
      showToast("Recolección agendada con éxito", "success");
      setOpenAdd(false);
      setSenderClientId("");
      setSenderSearch("");
      loadCollections();
    } catch (e: any) {
      showToast(e?.message || "Error al crear", "error");
    }
  }

  // Agrupación para el calendario
  const byDay = useMemo(() => {
    const map = new Map<string, Collection[]>();
    days.forEach((d) => map.set(d.toISOString().slice(0, 10), []));
    items.forEach((c) => {
      const key = new Date(c.pickupAt).toISOString().slice(0, 10);
      if (map.has(key)) map.get(key)!.push(c);
    });
    return map;
  }, [items, days]);

  /** ✅ Toggle selection por día */
  function toggleSelection(dayKey: string, collectionId: string) {
    setSelectedByDay((prev) => {
      const current = new Set(prev[dayKey] || []);
      if (current.has(collectionId)) current.delete(collectionId);
      else current.add(collectionId);
      return { ...prev, [dayKey]: Array.from(current) };
    });
  }

  function clearDaySelection(dayKey: string) {
    setSelectedByDay((prev) => ({ ...prev, [dayKey]: [] }));
  }

  /** ✅ Geocode helper (ahora apuntando a routes/geocode) */
  async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; formatted?: string }> {
    const key = query.trim().toLowerCase();
    const cached = geocodeCacheRef.current.get(key);
    if (cached) return cached;

    // ✅ Ajusta aquí si tu endpoint final es otro:
    // - "geocode?q=...":   Api("GET", `geocode?q=...&country=gb`, ...)
    // - "routes/geocode":  Api("GET", `routes/geocode?q=...&country=gb`, ...)
    const res: any = await Api("GET", `routes/geocode?q=${encodeURIComponent(query)}&country=gb`, null, router);

    const list = res?.data?.data || res?.data || res?.results || [];
    if (!Array.isArray(list) || !list.length) throw new Error("No geocode results");

    const first = list[0];
    const lat = Number(first.lat ?? first.latitude);
    const lng = Number(first.lon ?? first.lng ?? first.longitude);
    const formatted = first.display_name ?? first.formatted_address ?? query;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Invalid geocode coords");

    const value = { lat, lng, formatted };
    geocodeCacheRef.current.set(key, value);
    return value;
  }

  /** ✅ Guarda ruta en sessionStorage para el viewer */
  function persistRoute(dayKey: string, data: OptimizeResult) {
    try {
      sessionStorage.setItem(
        `route:${dayKey}`,
        JSON.stringify({
          dayKey,
          createdAt: Date.now(),
          route: data,
        })
      );
    } catch {
      // ignore storage errors
    }
  }

  /** ✅ Generar ruta para un día */
  async function generateRouteForDay(dayKey: string) {
    const ids = selectedByDay[dayKey] || [];
    if (ids.length < 2) return showToast("Selecciona al menos 2 recolecciones", "error");

    const dayCollections = (byDay.get(dayKey) || []).filter((c) => ids.includes(c._id));
    if (dayCollections.length < 2) return showToast("No se encontraron 2+ recolecciones seleccionadas", "error");

    setRouteLoadingByDay((p) => ({ ...p, [dayKey]: true }));
    setRouteByDay((p) => ({ ...p, [dayKey]: null }));

    try {
      // 1) Geocode de todas las direcciones (con cache)
      const waypoints: Waypoint[] = [];
      for (const c of dayCollections) {
        const q = `${c.address} ${c.postcode}`.trim();
        const coords = await geocodeAddress(q);
        waypoints.push({
          address: coords.formatted || c.address,
          lat: coords.lat,
          lng: coords.lng,
          code: (c.postcode || extractPostcode(coords.formatted || c.address) || "").toUpperCase(),
          timeSlot: pickTimeSlot(c.pickupAt),
        });
      }

      // 2) Payload para tu backend de optimize
      const payload = {
        preference: "balanced",
        consumptionL_per_100km: 7.0,
        fuelPricePerLitre: 1.7,
        dayStartHour: 8,
        hqPostcode: "SE16SP", // si quieres configurable, lo pasas de settings
        waypoints,
      };

      const res: any = await Api("POST", "routes/optimize", payload, router);

      // 3) Normaliza respuesta
      const data: OptimizeResult =
        (res?.data?.status ? res.data.data : res?.data?.data) ||
        (res?.data?.geometry ? res.data : null) ||
        null;

      if (!data) throw new Error(res?.data?.message || "No se pudo optimizar");

      setRouteByDay((p) => ({ ...p, [dayKey]: data }));

      // ✅ Guardar para el viewer
      persistRoute(dayKey, data);

      showToast("Ruta generada", "success");
    } catch (e: any) {
      showToast(e?.message || "Error generando ruta", "error");
    } finally {
      setRouteLoadingByDay((p) => ({ ...p, [dayKey]: false }));
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recolecciones</h1>
          <p className="text-gray-600 mt-2">Agenda y seguimiento de recolecciones</p>
        </div>
        <button onClick={() => setOpenAdd(true)} className="btn-primary flex items-center">
          <Plus className="h-5 w-5 mr-2" /> Agregar recolección
        </button>
      </div>

      {/* Calendario */}
      <div className="card p-0 overflow-hidden">
        <div className="bg-[#0F2A73] text-white px-4 py-3 flex items-center justify-between">
          <button
            className="px-3 py-2 rounded bg-white/10 hover:bg-white/20"
            onClick={() => setAnchor(addDays(anchor, -7))}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {weekStart.toLocaleDateString()} - {addDays(weekStart, 6).toLocaleDateString()}
          </div>
          <button
            className="px-3 py-2 rounded bg-white/10 hover:bg-white/20"
            onClick={() => setAnchor(addDays(anchor, 7))}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-t">
          {days.map((d) => {
            const dayKey = d.toISOString().slice(0, 10);
            const dayItems = byDay.get(dayKey) || [];
            const selectedIds = new Set(selectedByDay[dayKey] || []);
            const route = routeByDay[dayKey] || null;
            const routeLoading = !!routeLoadingByDay[dayKey];

            return (
              <div key={d.toISOString()} className="border-r last:border-r-0 min-h-[200px]">
                <div className="border-b bg-gray-50 px-2 py-2 text-xs font-semibold text-center">
                  {fmtDayLabel(d)}
                </div>

                {/* Acciones del día */}
                <div className="px-2 pt-2 flex items-center justify-between gap-2">
                  <button
                    onClick={() => generateRouteForDay(dayKey)}
                    disabled={(selectedByDay[dayKey]?.length || 0) < 2 || routeLoading}
                    className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                      (selectedByDay[dayKey]?.length || 0) < 2 || routeLoading
                        ? "bg-gray-200 text-gray-500"
                        : "bg-emerald-600 text-white hover:opacity-90"
                    }`}
                    title="Generar ruta con seleccionadas"
                  >
                    {routeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Route className="h-3 w-3" />}
                    Ruta
                  </button>

                  <button
                    onClick={() => clearDaySelection(dayKey)}
                    className="text-xs px-2 py-1 rounded border hover:bg-white"
                    title="Limpiar selección"
                  >
                    Limpiar
                  </button>
                </div>

                <div className="p-2 space-y-2">
                  {dayItems.map((c) => (
                    <div key={c._id} className="rounded-lg border bg-white p-2">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedIds.has(c._id)}
                          onChange={() => toggleSelection(dayKey, c._id)}
                        />

                        <button
                          onClick={() => {
                            setSelected(c);
                            setOpenSummary(true);
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="text-xs font-bold text-blue-900">{fmtTime(c.pickupAt)}</div>
                          <div className="text-xs font-semibold truncate">{c.client?.name}</div>
                          <div className="text-[11px] text-gray-600 truncate">{c.postcode}</div>
                        </button>
                      </div>
                    </div>
                  ))}

                  {loading && <div className="text-xs text-gray-500">Cargando...</div>}
                  {!loading && dayItems.length === 0 && <div className="text-xs text-gray-400">Sin recolecciones</div>}

                  {/* ✅ Ruta del día (solo resumen + botón a la página completa) */}
                  {route && (
                    <div className="mt-2 rounded-lg border overflow-hidden">
                      <div className="p-2 bg-gray-50">
                        <div className="text-xs font-semibold text-gray-800">Ruta del día</div>
                        <div className="text-[11px] text-gray-600">
                          {route?.total?.distance_km != null ? `${route.total.distance_km.toFixed(1)} km` : ""}
                          {route?.total?.duration_human ? ` • ${route.total.duration_human}` : ""}
                          {route?.total?.fuel_cost != null ? ` • £${route.total.fuel_cost.toFixed(2)}` : ""}
                        </div>

                        <button
                          className="mt-2 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:opacity-90 inline-flex items-center gap-1"
                          onClick={() => router.push(`/admin/routes/view?day=${dayKey}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver ruta completa
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Agregar */}
      <Modal isOpen={openAdd} onClose={() => setOpenAdd(false)} title="Nueva Recolección" size="large">
        <div className="space-y-6">
          {/* SECCIÓN CLIENTE */}
          <div className="card p-4 border border-gray-200 shadow-none bg-gray-50/30">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Cliente / Remitente *</h2>
            </div>

            <div className="relative mb-3">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={senderSearch}
                onChange={(e) => setSenderSearch(e.target.value)}
                className="input pl-9"
                placeholder="Buscar por nombre, email o teléfono..."
              />
            </div>

            <select
              className="input mb-4"
              value={senderClientId}
              onChange={(e) => handleClientChange(e.target.value)}
              disabled={loadingClients}
            >
              <option value="">Seleccione un cliente...</option>
              {filteredClients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>

            {selectedClientDetail && (
              <div className="p-3 bg-white rounded-lg text-sm text-gray-700 border border-gray-200 shadow-sm">
                <div className="font-bold text-blue-900">{selectedClientDetail.name}</div>
                <div>{selectedClientDetail.phone}</div>
                <div className="text-gray-500 italic">{selectedClientDetail.email}</div>
              </div>
            )}
          </div>

          {/* DETALLES DE RECOLECCIÓN */}
          <div className="space-y-4">
            <div>
              <label className="label">Dirección de Recogida (Editable) *</label>
              <div className="relative">
                <MapPin className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                <textarea
                  className="input pl-9 min-h-[90px] pt-2"
                  placeholder="Calle, Ciudad, Estado..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>

            <div className="w-full md:w-1/3">
              <label className="label">Postcode (Editable) *</label>
              <input
                className="input"
                placeholder="Ej. SE1 2AB"
                value={form.postcode}
                onChange={(e) => setForm({ ...form, postcode: e.target.value })}
              />
            </div>
          </div>

          {/* FECHA, HORA Y NOTAS */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                className="input"
                value={form.pickupDate}
                onChange={(e) => setForm({ ...form, pickupDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Hora Aproximada</label>
              <div className="relative">
                <Clock className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="time"
                  className="input pl-9"
                  value={form.pickupTime}
                  onChange={(e) => setForm({ ...form, pickupTime: e.target.value })}
                />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="label">Notas / Instrucciones</label>
              <input
                className="input"
                placeholder="Opcional"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button className="btn-outline" onClick={() => setOpenAdd(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={createCollection}>
              Agendar Recolección
            </button>
          </div>
        </div>
      </Modal>

      {/* Summary Modal */}
      <Modal isOpen={openSummary} onClose={() => setOpenSummary(false)} title="Detalle de Recolección" size="large">
        {selected && (
          <div className="space-y-4">
            <div className="bg-[#0F2A73] text-white p-6 rounded-2xl shadow-lg">
              <h3 className="text-2xl font-bold mb-2">{selected.client?.name}</h3>
              <div className="space-y-2 opacity-90">
                <p className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 mt-1 shrink-0" /> {selected.address}, {selected.postcode}
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="h-5 w-5 shrink-0" /> {new Date(selected.pickupAt).toLocaleDateString()} -{" "}
                  {fmtTime(selected.pickupAt)}
                </p>
              </div>
            </div>
            <button className="btn-primary w-full py-3" onClick={() => router.push(`/admin/collections/${selected._id}`)}>
              Ver Detalles Completos
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
