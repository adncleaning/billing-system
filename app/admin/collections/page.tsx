"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  FileText,
  Receipt,
  CreditCard,
} from "lucide-react";

/** -------------------- Types -------------------- */
type ClientLite = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
};

type CollectionStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "EN_ROUTE"
  | "COLLECTED"
  | "AT_WAREHOUSE"
  | "GUIDE_CREATED"
  | "BILLED"
  | "PAID"
  | "COMPLETED"
  | "CANCELLED";

type Collection = {
  _id: string;
  client: { _id: string; name: string; phone?: string; email?: string };
  address: string;
  postcode: string;
  pickupAt: string; // ISO
  status: CollectionStatus;

  // flags (opcional)
  billId?: string;
  guideId?: string;
  paymentId?: string;

  notes?: string;
  createdAt?: string;
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
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
  return `${["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()]}-${parts[0]}/${parts[1]}/${parts[2]}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "2-digit" });
}

function badgeClass(s: CollectionStatus) {
  const base = "px-2 py-0.5 rounded text-[11px] font-semibold";
  if (s === "COMPLETED" || s === "PAID") return `${base} bg-green-100 text-green-800`;
  if (s === "CANCELLED") return `${base} bg-red-100 text-red-800`;
  if (s === "EN_ROUTE") return `${base} bg-blue-100 text-blue-800`;
  if (s === "COLLECTED" || s === "AT_WAREHOUSE") return `${base} bg-indigo-100 text-indigo-800`;
  if (s === "BILLED" || s === "GUIDE_CREATED") return `${base} bg-yellow-100 text-yellow-800`;
  return `${base} bg-gray-100 text-gray-800`;
}

function chip(ok: boolean, label: string, Icon: any) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold " +
        (ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-gray-50 text-gray-600 border border-gray-200")
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/** -------------------- Page -------------------- */
export default function CollectionsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { showToast } = useToast();

  /** calendar */
  const [anchor, setAnchor] = useState(() => new Date());
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  /** data */
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);

  /** add modal */
  const [openAdd, setOpenAdd] = useState(false);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientQ, setClientQ] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);

  const [form, setForm] = useState({
    clientId: "",
    address: "",
    postcode: "",
    pickupDate: new Date().toISOString().slice(0, 10),
    pickupTime: "09:00",
    notes: "",
  });

  /** summary modal */
  const [openSummary, setOpenSummary] = useState(false);
  const [selected, setSelected] = useState<Collection | null>(null);

  /** -------------------- API -------------------- */
  async function loadCollections() {
    setLoading(true);
    try {
      // ✅ rango semana
      const from = new Date(weekStart);
      const to = addDays(weekStart, 7);
      const qs = new URLSearchParams();
      qs.set("from", from.toISOString());
      qs.set("to", to.toISOString());

      // Endpoint sugerido: GET /collections?from&to
      const data: any = await Api("GET", `collections?${qs.toString()}`, null, router);
      setItems(data?.data || data?.collections || []);
    } catch (e: any) {
      showToast(e?.message || "Error loading collections", "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadClients(q: string) {
    setLoadingClients(true);
    try {
      const data: any = await Api("GET", `clients?q=${encodeURIComponent(q)}`, null, router);
      setClients(data?.clients || data?.data || []);
    } catch (e: any) {
      showToast(e?.message || "Error loading clients", "error");
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }

  async function createCollection() {
    if (!form.clientId) return showToast("Select a client", "error");
    if (!form.address.trim()) return showToast("Address required", "error");
    if (!form.postcode.trim()) return showToast("Postcode required", "error");

    try {
      const pickupAt = new Date(`${form.pickupDate}T${form.pickupTime}:00`).toISOString();

      const payload = {
        clientId: form.clientId,
        address: form.address.trim(),
        postcode: form.postcode.trim(),
        pickupAt,
        notes: form.notes?.trim() || "",
      };

      // Endpoint sugerido: POST /collections
      const data: any = await Api("POST", "collections", payload, router);
      if (data?.success === false) throw new Error(data?.message || "Error creating collection");

      showToast("Collection created", "success");
      setOpenAdd(false);
      setForm((p) => ({
        ...p,
        clientId: "",
        address: "",
        postcode: "",
        pickupTime: "09:00",
        notes: "",
      }));
      await loadCollections();
    } catch (e: any) {
      showToast(e?.message || "Error creating collection", "error");
    }
  }

  /** -------------------- Effects -------------------- */
  useEffect(() => {
    if (token) loadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, weekStart.getTime()]);

  useEffect(() => {
    if (!openAdd) return;
    const t = setTimeout(() => loadClients(clientQ), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientQ, openAdd]);

  /** -------------------- Derived: items by day sorted by time -------------------- */
  const byDay = useMemo(() => {
    const map = new Map<string, Collection[]>();
    for (const d of days) map.set(d.toISOString().slice(0, 10), []);

    for (const c of items) {
      const key = new Date(c.pickupAt).toISOString().slice(0, 10);
      if (map.has(key)) map.get(key)!.push(c);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());
      map.set(k, arr);
    }
    return map;
  }, [items, days]);

  /** -------------------- UI handlers -------------------- */
  function openSummaryFor(c: Collection) {
    setSelected(c);
    setOpenSummary(true);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recolecciones</h1>
          <p className="text-gray-600 mt-2">Agenda y seguimiento de recolecciones (UK)</p>
        </div>

        <button onClick={() => setOpenAdd(true)} className="btn-primary flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          Agregar recolección
        </button>
      </div>

      {/* Calendar header like Booking */}
      <div className="card p-0 overflow-hidden">
        <div className="bg-[#0F2A73] text-white px-4 py-3 flex items-center justify-between">
          <button
            className="px-3 py-2 rounded bg-white/10 hover:bg-white/20"
            onClick={() => setAnchor(addDays(anchor, -7))}
            aria-label="Prev week"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            WK -{" "}
            {Math.ceil(
              (Number(weekStart) - Number(new Date(weekStart.getFullYear(), 0, 1))) /
                (7 * 24 * 3600 * 1000)
            )}{" "}
            ({weekStart.toISOString().slice(0, 10)} - {addDays(weekStart, 6).toISOString().slice(0, 10)})
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm"
              onClick={() => setAnchor(new Date())}
            >
              Today
            </button>
            <button
              className="px-3 py-2 rounded bg-white/10 hover:bg-white/20"
              onClick={() => setAnchor(addDays(anchor, 7))}
              aria-label="Next week"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Week grid */}
        <div className="grid grid-cols-7 border-t">
          {days.map((d) => (
            <div key={d.toISOString()} className="border-r last:border-r-0">
              <div className="border-b bg-gray-50 px-2 py-2 text-xs font-semibold">
                {fmtDayLabel(d)}
              </div>

              <div className="min-h-[180px] p-2 space-y-2">
                {loading ? (
                  <div className="text-xs text-gray-500">Loading...</div>
                ) : (
                  <>
                    {(byDay.get(d.toISOString().slice(0, 10)) || []).map((c) => (
                      <button
                        key={c._id}
                        onClick={() => openSummaryFor(c)}
                        className="w-full text-left rounded-lg p-3 bg-blue-600 text-white hover:opacity-95 transition"
                      >
                        <div className="text-[11px] opacity-95">
                          {fmtTime(c.pickupAt)} • {c.postcode}
                        </div>
                        <div className="text-sm font-semibold truncate">{c.client?.name || "—"}</div>
                        <div className="text-[12px] opacity-95 line-clamp-2">{c.address}</div>
                        <div className="mt-2">
                          <span className={badgeClass(c.status)}>{c.status}</span>
                        </div>
                      </button>
                    ))}

                    {!((byDay.get(d.toISOString().slice(0, 10)) || []).length) && (
                      <div className="text-xs text-gray-400">No recolecciones</div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Modal (second image style) */}
      <Modal
        isOpen={openSummary}
        onClose={() => setOpenSummary(false)}
        title="Resumen de recolección"
        size="xlarge"
      >
        {!selected ? null : (
          <div className="space-y-6">
            <div className="bg-[#1b1a3a] text-white rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  Recolección - <span className="text-green-400">{selected.status}</span>
                </div>
                <button
                  onClick={() => setOpenSummary(false)}
                  className="px-3 py-2 rounded bg-white/10 hover:bg-white/20"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="opacity-70">Cliente</div>
                  <div className="font-semibold">{selected.client?.name || "—"}</div>
                </div>
                <div>
                  <div className="opacity-70">Fecha</div>
                  <div className="font-semibold">{fmtDateShort(selected.pickupAt)}</div>
                </div>
                <div>
                  <div className="opacity-70">Hora</div>
                  <div className="font-semibold">{fmtTime(selected.pickupAt)}</div>
                </div>

                <div className="md:col-span-2">
                  <div className="opacity-70">Dirección</div>
                  <div className="font-semibold">{selected.address}</div>
                </div>
                <div>
                  <div className="opacity-70">Postcode</div>
                  <div className="font-semibold">{selected.postcode}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {chip(!!selected.billId, "Bill", Receipt)}
                {chip(!!selected.guideId, "Guía", FileText)}
                {chip(!!selected.paymentId, "Pago", CreditCard)}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="btn-outline"
                onClick={() => {
                  setOpenSummary(false);
                }}
              >
                Cancelar
              </button>

              <button
                className="btn-primary"
                onClick={() => {
                  const id = selected._id;
                  setOpenSummary(false);
                  router.push(`/admin/collections/${id}`);
                }}
              >
                Ver detalle
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Modal */}
      <Modal isOpen={openAdd} onClose={() => setOpenAdd(false)} title="Agregar recolección" size="xlarge">
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cliente *</label>
              <input
                className="input"
                placeholder="Buscar cliente..."
                value={clientQ}
                onChange={(e) => setClientQ(e.target.value)}
              />
              <div className="border rounded-lg mt-2 max-h-56 overflow-auto">
                {loadingClients ? (
                  <div className="p-3 text-sm text-gray-500">Loading clients...</div>
                ) : (
                  (clients || []).map((c) => {
                    const active = form.clientId === c._id;
                    return (
                      <button
                        type="button"
                        key={c._id}
                        className={
                          "w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 " +
                          (active ? "bg-sky-50" : "")
                        }
                        onClick={() => setForm((p) => ({ ...p, clientId: c._id }))}
                      >
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.phone || c.email || "—"}</div>
                      </button>
                    );
                  })
                )}
                {!loadingClients && !clients?.length && (
                  <div className="p-3 text-sm text-gray-500">No clients</div>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dirección *</label>
              <div className="relative">
                <MapPin className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                <input
                  className="input pl-9"
                  placeholder="32 Roupell Street..."
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">Postcode *</label>
              <input
                className="input"
                placeholder="SE1 8TB"
                value={form.postcode}
                onChange={(e) => setForm((p) => ({ ...p, postcode: e.target.value }))}
              />
            </div>
          </div>

          {/* Pickup datetime */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha *</label>
              <input
                type="date"
                className="input"
                value={form.pickupDate}
                onChange={(e) => setForm((p) => ({ ...p, pickupDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hora *</label>
              <div className="relative">
                <Clock className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="time"
                  className="input pl-9"
                  value={form.pickupTime}
                  onChange={(e) => setForm((p) => ({ ...p, pickupTime: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
              <input
                className="input"
                placeholder="Opcional..."
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button className="btn-outline" onClick={() => setOpenAdd(false)} type="button">
              Cancelar
            </button>
            <button className="btn-primary" onClick={createCollection} type="button">
              Crear recolección
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
