"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1/api";

/** -------------------- Types -------------------- */
type ClientLite = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
};

type ServiceCatalogItem = {
  _id: string;
  name: string;
  price: number;
  description?: string;
  measure?: string; // Unit
  modifiable?: boolean;
  onTotal?: boolean; // "Sobre Total"
};

type BillServiceLine = {
  _id?: string; // si viene del catálogo
  tempId: string; // local
  name: string;
  description?: string;
  measure: string;
  price: number;
  quantity: number;
  modifiable: boolean;
  onTotal: boolean;
};

type GuideLite = {
  _id: string;
  number: string;
  recipientName?: string;
  destination?: string; // address o país/dirección
  weightKg?: number;
  pieces?: number;
  description?: string;
  amount?: number; // backend ideal
  guideTotal?: number; // compat
  createdAt?: string;
};

type BillItemLine = {
  tempId: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

/** -------------------- LOCAL Services Catalog (NO ENDPOINT) -------------------- */
const LOCAL_SERVICES: ServiceCatalogItem[] = [
  {
    _id: "svc_small_box",
    name: "Caja pequeña",
    price: 2.5,
    description: "Caja Pequeña",
    measure: "Unit",
    modifiable: true,
    onTotal: false,
  },
  {
    _id: "svc_medium_box",
    name: "Caja Mediana",
    price: 3.5,
    description: "Caja Mediana",
    measure: "Unit",
    modifiable: true,
    onTotal: false,
  },
  {
    _id: "svc_large_box",
    name: "Caja Grande",
    price: 4.0,
    description: "Caja Grande",
    measure: "Unit",
    modifiable: true,
    onTotal: false,
  },
];

/** -------------------- Helpers -------------------- */
function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
}

async function apiFetch(path: string, options: RequestInit = {}, router?: any) {
  const token = getToken();

  const headers: Record<string, string> = {};
  if (options.headers instanceof Headers) {
    options.headers.forEach((v, k) => (headers[k] = v));
  } else if (Array.isArray(options.headers)) {
    for (const [k, v] of options.headers) headers[k] = String(v);
  } else if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  if (token) headers.Authorization = `jwt ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401 && router) {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch {}
      router.push("/");
    }

    let msg = "Error en la petición";
    try {
      const err = await res.json();
      msg = err?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}

function uid(prefix = "tmp") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function money(n: number) {
  return Number(n || 0).toFixed(2);
}

function getGuideAmount(g: GuideLite) {
  return Number((g.amount ?? g.guideTotal) || 0);
}

/** -------------------- Simple Modal -------------------- */
function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button
            className="px-3 py-1 rounded hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer ? <div className="px-4 py-3 border-t">{footer}</div> : null}
      </div>
    </div>
  );
}

/** -------------------- Page -------------------- */
export default function BillsCreatePage() {
  const router = useRouter();

  /** Client selector */
  const [clientQ, setClientQ] = useState("");
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientLite | null>(null);

  /** Bill header */
  const [billNumber, setBillNumber] = useState("");
  const [issueDate, setIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");

  /** Included lines */
  const [services, setServices] = useState<BillServiceLine[]>([]);
  const [guides, setGuides] = useState<GuideLite[]>([]);
  const [items, setItems] = useState<BillItemLine[]>([]);

  /** Modals */
  const [openServicesModal, setOpenServicesModal] = useState(false);
  const [openGuidesModal, setOpenGuidesModal] = useState(false);
  const [openItemModal, setOpenItemModal] = useState(false);

  /** Catalog services (LOCAL) */
  const [catalogQ, setCatalogQ] = useState("");
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>(LOCAL_SERVICES);

  /** Create new service inside modal */
  const [newCatalogService, setNewCatalogService] = useState({
    name: "",
    price: 0,
    description: "",
    measure: "Unit",
    modifiable: true,
    onTotal: false,
  });

  /** Guides modal data */
  const [unbilledGuides, setUnbilledGuides] = useState<GuideLite[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [selectedGuideIds, setSelectedGuideIds] = useState<string[]>([]);

  /** Manual Service (parte libre) */
  const [manualService, setManualService] = useState({
    name: "",
    description: "",
    measure: "Unit",
    price: 0,
    quantity: 1,
    modifiable: true,
    onTotal: false,
  });

  /** Manual Item modal */
  const [newItem, setNewItem] = useState({
    description: "",
    quantity: 1,
    unitPrice: 0,
  });

  /** UX */
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  /** -------------------- Totals -------------------- */
  const guidesSubtotal = useMemo(() => {
    return guides.reduce((acc, g) => acc + getGuideAmount(g), 0);
  }, [guides]);

  const servicesSubtotal = useMemo(() => {
    return services.reduce(
      (acc, s) => acc + Number(s.price) * Number(s.quantity),
      0
    );
  }, [services]);

  const itemsSubtotal = useMemo(() => {
    return items.reduce(
      (acc, it) => acc + Number(it.unitPrice) * Number(it.quantity),
      0
    );
  }, [items]);

  const grandTotal = useMemo(
    () => guidesSubtotal + servicesSubtotal + itemsSubtotal,
    [guidesSubtotal, servicesSubtotal, itemsSubtotal]
  );

  /** -------------------- API calls -------------------- */
  async function fetchClients(q: string) {
    setLoadingClients(true);
    try {
      const data = await apiFetch(`/clients?q=${encodeURIComponent(q)}`, {}, router);
      setClients(data?.data || data?.clients || []);
    } catch (e: any) {
      setError(e?.message || "Error cargando clientes");
    } finally {
      setLoadingClients(false);
    }
  }

  async function fetchUnbilledGuides(clientId: string) {
    setLoadingGuides(true);
    try {
      const data = await apiFetch(
        `/bills/unbilled-guides/list?clientId=${encodeURIComponent(clientId)}`,
        {},
        router
      );
      setUnbilledGuides(data?.data || data?.guides || []);
    } catch (e: any) {
      setError(e?.message || "Error cargando guías");
      setUnbilledGuides([]);
    } finally {
      setLoadingGuides(false);
    }
  }

  /** -------------------- Effects -------------------- */
  useEffect(() => {
    fetchClients("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchClients(clientQ), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientQ]);

  // ✅ si cambia el cliente, limpia selección + listas (evita mezclar guías de otros clientes)
  useEffect(() => {
    setSelectedGuideIds([]);
    setUnbilledGuides([]);
    setGuides([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient?._id]);

  useEffect(() => {
    if (!openGuidesModal) return;
    if (!selectedClient?._id) return;
    fetchUnbilledGuides(selectedClient._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGuidesModal, selectedClient?._id]);

  /** -------------------- Handlers -------------------- */
  function addCatalogService(svc: ServiceCatalogItem) {
    setServices((prev) => {
      const exists = prev.find((x) => x._id && x._id === svc._id);
      if (exists) {
        return prev.map((x) =>
          x._id === svc._id ? { ...x, quantity: x.quantity + 1 } : x
        );
      }
      return [
        ...prev,
        {
          _id: svc._id,
          tempId: uid("svc"),
          name: svc.name,
          description: svc.description || "",
          measure: svc.measure || "Unit",
          price: Number(svc.price || 0),
          quantity: 1,
          modifiable: svc.modifiable ?? true,
          onTotal: svc.onTotal ?? false,
        },
      ];
    });
  }

  function addNewServiceToCatalogAndBill() {
    setError(null);
    if (!newCatalogService.name.trim()) {
      setError("El nuevo servicio requiere nombre.");
      return;
    }

    const created: ServiceCatalogItem = {
      _id: uid("svc_local"),
      name: newCatalogService.name.trim(),
      price: Number(newCatalogService.price || 0),
      description: newCatalogService.description?.trim() || "",
      measure: newCatalogService.measure || "Unit",
      modifiable: !!newCatalogService.modifiable,
      onTotal: !!newCatalogService.onTotal,
    };

    setCatalog((prev) => [created, ...prev]);
    addCatalogService(created);

    setNewCatalogService({
      name: "",
      price: 0,
      description: "",
      measure: "Unit",
      modifiable: true,
      onTotal: false,
    });
  }

  function removeService(tempId: string) {
    setServices((prev) => prev.filter((x) => x.tempId !== tempId));
  }

  function changeServiceQty(tempId: string, qty: number) {
    setServices((prev) =>
      prev.map((x) =>
        x.tempId === tempId ? { ...x, quantity: Math.max(1, qty || 1) } : x
      )
    );
  }

  function addManualService() {
    if (!manualService.name.trim()) {
      setError("El servicio manual requiere un nombre.");
      return;
    }
    setServices((prev) => [
      ...prev,
      {
        tempId: uid("svc_manual"),
        name: manualService.name.trim(),
        description: manualService.description?.trim() || "",
        measure: manualService.measure || "Unit",
        price: Number(manualService.price || 0),
        quantity: Math.max(1, Number(manualService.quantity || 1)),
        modifiable: !!manualService.modifiable,
        onTotal: !!manualService.onTotal,
      },
    ]);
    setManualService({
      name: "",
      description: "",
      measure: "Unit",
      price: 0,
      quantity: 1,
      modifiable: true,
      onTotal: false,
    });
  }

  function toggleGuide(id: string) {
    setSelectedGuideIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function includeSelectedGuides() {
    const selected = unbilledGuides.filter((g) => selectedGuideIds.includes(g._id));
    setGuides((prev) => {
      const map = new Map(prev.map((p) => [p._id, p]));
      selected.forEach((g) => map.set(g._id, g));
      return Array.from(map.values());
    });
    setSelectedGuideIds([]);
    setOpenGuidesModal(false);
  }

  function removeGuide(id: string) {
    setGuides((prev) => prev.filter((g) => g._id !== id));
  }

  function addItemLine() {
    if (!newItem.description.trim()) {
      setError("El item manual requiere descripción.");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        tempId: uid("item"),
        description: newItem.description.trim(),
        quantity: Math.max(1, Number(newItem.quantity || 1)),
        unitPrice: Number(newItem.unitPrice || 0),
      },
    ]);
    setNewItem({ description: "", quantity: 1, unitPrice: 0 });
    setOpenItemModal(false);
  }

  function removeItem(tempId: string) {
    setItems((prev) => prev.filter((x) => x.tempId !== tempId));
  }

  async function createBill() {
    setError(null);

    if (!selectedClient?._id) {
      setError("Selecciona un cliente.");
      return;
    }

    if (!guides.length && !services.length && !items.length) {
      setError("Incluye al menos una guía, servicio o item.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        number: billNumber || null,
        clientId: selectedClient._id,
        issueDate,
        dueDate,
        notes,
        services: services.map((s) => ({
          serviceId: s._id || null,
          name: s.name,
          description: s.description,
          measure: s.measure,
          price: s.price,
          quantity: s.quantity,
          modifiable: s.modifiable,
          onTotal: s.onTotal,
        })),
        guideIds: guides.map((g) => g._id),
        items: items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      };

      const data = await apiFetch(
        `/bills`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        router
      );

      const createdId = data?.data?._id || data?.bill?._id;
      if (createdId) router.push(`/admin/bills/${createdId}`);
      else router.push(`/admin/bills`);
    } catch (e: any) {
      setError(e.message || "Error creando bill");
    } finally {
      setCreating(false);
    }
  }

  /** -------------------- Render -------------------- */
  const filteredCatalog = useMemo(() => {
    const q = catalogQ.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((s) =>
      [s.name, s.description, s.measure].some((v) =>
        (v || "").toLowerCase().includes(q)
      )
    );
  }, [catalog, catalogQ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Create Bill</h1>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* 1) CLIENT FIRST */}
      <div className="bg-white shadow rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Client</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-600">Search client</label>
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="Name, email, phone..."
              value={clientQ}
              onChange={(e) => setClientQ(e.target.value)}
            />

            <div className="border rounded max-h-64 overflow-auto">
              {loadingClients ? (
                <div className="p-3 text-sm text-gray-500">Loading...</div>
              ) : (
                <ul>
                  {(clients || []).map((c) => {
                    const active = selectedClient?._id === c._id;
                    return (
                      <li
                        key={c._id}
                        className={`px-3 py-2 cursor-pointer border-b last:border-b-0 ${
                          active ? "bg-sky-50" : "hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedClient(c)}
                      >
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-gray-600">
                          {(c.email || "—")} • {(c.phone || "—")}
                        </div>
                      </li>
                    );
                  })}
                  {!clients?.length && (
                    <li className="p-3 text-sm text-gray-500">No clients</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="border rounded p-4">
            <div className="text-sm text-gray-500 mb-1">Selected</div>
            {selectedClient ? (
              <>
                <div className="text-lg font-semibold">{selectedClient.name}</div>
                <div className="text-sm text-gray-700">
                  {(selectedClient.email || "—")} • {(selectedClient.phone || "—")}
                </div>
                <div className="mt-2 text-xs text-gray-500">{selectedClient._id}</div>
              </>
            ) : (
              <div className="text-sm text-gray-500">Select a client</div>
            )}
          </div>
        </div>
      </div>

      {/* 2) BILL INFO */}
      <div className="bg-white shadow rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Bill Number (optional)
              </label>
              <input
                className="w-full border px-3 py-2 rounded"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Issue Date</label>
              <input
                type="date"
                className="w-full border px-3 py-2 rounded"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Due Date</label>
              <input
                type="date"
                className="w-full border px-3 py-2 rounded"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-start lg:justify-end">
            <button
              className="px-4 py-2 rounded bg-sky-600 text-white text-sm"
              onClick={() => setOpenServicesModal(true)}
            >
              Include Service
            </button>
            <button
              className="px-4 py-2 rounded bg-indigo-600 text-white text-sm"
              onClick={() => setOpenItemModal(true)}
            >
              Include Item
            </button>
            <button
              className="px-4 py-2 rounded bg-blue-700 text-white text-sm disabled:bg-blue-300"
              disabled={!selectedClient}
              onClick={() => {
                setError(null);
                setOpenGuidesModal(true);
              }}
            >
              Include Guides
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Notes</label>
          <textarea
            className="w-full border px-3 py-2 rounded"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* 3) SERVICES */}
      <div className="bg-white shadow rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Services</h2>
          <div className="text-sm text-gray-600">
            Subtotal: <span className="font-semibold">{money(servicesSubtotal)}</span>
          </div>
        </div>

        <div className="overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-2 text-left">Name</th>
                <th className="border px-2 py-2 text-left">Description</th>
                <th className="border px-2 py-2 text-center">Measure</th>
                <th className="border px-2 py-2 text-right">Price</th>
                <th className="border px-2 py-2 text-center">Qty</th>
                <th className="border px-2 py-2 text-right">Total</th>
                <th className="border px-2 py-2 text-center">Modifiable</th>
                <th className="border px-2 py-2 text-center">Sobre Total</th>
                <th className="border px-2 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.tempId}>
                  <td className="border px-2 py-2 font-medium">{s.name}</td>
                  <td className="border px-2 py-2 max-w-[260px] truncate">
                    {s.description || "—"}
                  </td>
                  <td className="border px-2 py-2 text-center">{s.measure}</td>
                  <td className="border px-2 py-2 text-right">{money(s.price)}</td>
                  <td className="border px-2 py-2 text-center">
                    <input
                      type="number"
                      min={1}
                      className="w-16 border rounded px-2 py-1 text-xs text-center"
                      value={s.quantity}
                      onChange={(e) => changeServiceQty(s.tempId, Number(e.target.value))}
                    />
                  </td>
                  <td className="border px-2 py-2 text-right">
                    {money(s.price * s.quantity)}
                  </td>
                  <td className="border px-2 py-2 text-center">{s.modifiable ? "✔" : "—"}</td>
                  <td className="border px-2 py-2 text-center">{s.onTotal ? "✔" : "—"}</td>
                  <td className="border px-2 py-2 text-center">
                    <button
                      className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                      onClick={() => removeService(s.tempId)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {!services.length && (
                <tr>
                  <td colSpan={9} className="text-center px-3 py-6 text-gray-500">
                    No services included.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PARTE LIBRE */}
        <div className="border rounded p-4">
          <div className="font-semibold text-sm mb-3">Add service manually</div>

          <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 text-sm">
            <div className="lg:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Name</label>
              <input
                className="w-full border px-3 py-2 rounded"
                value={manualService.name}
                onChange={(e) => setManualService((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Description</label>
              <input
                className="w-full border px-3 py-2 rounded"
                value={manualService.description}
                onChange={(e) => setManualService((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Measure</label>
              <input
                className="w-full border px-3 py-2 rounded"
                value={manualService.measure}
                onChange={(e) => setManualService((p) => ({ ...p, measure: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Price</label>
              <input
                type="number"
                className="w-full border px-3 py-2 rounded"
                value={manualService.price}
                onChange={(e) => setManualService((p) => ({ ...p, price: Number(e.target.value) }))}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Qty</label>
              <input
                type="number"
                min={1}
                className="w-full border px-3 py-2 rounded"
                value={manualService.quantity}
                onChange={(e) => setManualService((p) => ({ ...p, quantity: Number(e.target.value) }))}
              />
            </div>

            <div className="flex items-end gap-4">
              <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={manualService.modifiable}
                  onChange={(e) => setManualService((p) => ({ ...p, modifiable: e.target.checked }))}
                />
                Modifiable
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={manualService.onTotal}
                  onChange={(e) => setManualService((p) => ({ ...p, onTotal: e.target.checked }))}
                />
                Sobre Total
              </label>

              <button
                className="ml-auto px-4 py-2 rounded bg-gray-900 text-white text-sm"
                onClick={addManualService}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4) ITEMS */}
      <div className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Items</h2>
          <div className="text-sm text-gray-600">
            Subtotal: <span className="font-semibold">{money(itemsSubtotal)}</span>
          </div>
        </div>

        <div className="overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-2 text-left">Description</th>
                <th className="border px-2 py-2 text-center">Qty</th>
                <th className="border px-2 py-2 text-right">Unit Price</th>
                <th className="border px-2 py-2 text-right">Total</th>
                <th className="border px-2 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.tempId}>
                  <td className="border px-2 py-2">{it.description}</td>
                  <td className="border px-2 py-2 text-center">{it.quantity}</td>
                  <td className="border px-2 py-2 text-right">{money(it.unitPrice)}</td>
                  <td className="border px-2 py-2 text-right">
                    {money(it.unitPrice * it.quantity)}
                  </td>
                  <td className="border px-2 py-2 text-center">
                    <button
                      className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                      onClick={() => removeItem(it.tempId)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {!items.length && (
                <tr>
                  <td colSpan={5} className="text-center px-3 py-6 text-gray-500">
                    No items included.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5) GUIDES */}
      <div className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Guides</h2>
          <div className="text-sm text-gray-600">
            Subtotal: <span className="font-semibold">{money(guidesSubtotal)}</span>
          </div>
        </div>

        <div className="overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-2 text-left">Number</th>
                <th className="border px-2 py-2 text-left">Beneficiary</th>
                <th className="border px-2 py-2 text-left">Destination</th>
                <th className="border px-2 py-2 text-center">Pieces</th>
                <th className="border px-2 py-2 text-center">Weight Kg</th>
                <th className="border px-2 py-2 text-right">Amount</th>
                <th className="border px-2 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {guides.map((g) => (
                <tr key={g._id}>
                  <td className="border px-2 py-2">
                    <span className="inline-flex px-2 py-0.5 rounded bg-green-600 text-white text-[10px] font-semibold">
                      {g.number}
                    </span>
                  </td>
                  <td className="border px-2 py-2">{g.recipientName || "—"}</td>
                  <td className="border px-2 py-2 max-w-[340px] truncate">
                    {g.destination || "—"}
                  </td>
                  <td className="border px-2 py-2 text-center">{g.pieces ?? "—"}</td>
                  <td className="border px-2 py-2 text-center">
                    {typeof g.weightKg === "number" ? money(g.weightKg) : "—"}
                  </td>
                  <td className="border px-2 py-2 text-right">
                    {money(getGuideAmount(g))}
                  </td>
                  <td className="border px-2 py-2 text-center">
                    <button
                      className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                      onClick={() => removeGuide(g._id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {!guides.length && (
                <tr>
                  <td colSpan={7} className="text-center px-3 py-6 text-gray-500">
                    No guides included.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6) SUMMARY + CREATE */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div className="border rounded p-3">
            <div className="text-gray-500">Guides</div>
            <div className="text-2xl font-semibold">{money(guidesSubtotal)}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-gray-500">Services</div>
            <div className="text-2xl font-semibold">{money(servicesSubtotal)}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-gray-500">Items</div>
            <div className="text-2xl font-semibold">{money(itemsSubtotal)}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-gray-500">Total</div>
            <div className="text-2xl font-semibold">{money(grandTotal)}</div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            className="px-6 py-2 rounded bg-green-600 text-white font-semibold disabled:bg-green-300"
            disabled={creating}
            onClick={createBill}
          >
            {creating ? "Creating..." : "Create Bill"}
          </button>
        </div>
      </div>

      {/* -------------------- MODALS -------------------- */}

      {/* Include Services Modal (LOCAL) */}
      <Modal
        open={openServicesModal}
        title="Select Services"
        onClose={() => setOpenServicesModal(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              className="px-4 py-2 rounded border"
              onClick={() => setOpenServicesModal(false)}
            >
              Close
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-3 mb-3">
          <input
            className="flex-1 border px-3 py-2 rounded"
            placeholder="Search service..."
            value={catalogQ}
            onChange={(e) => setCatalogQ(e.target.value)}
          />
          <button
            className="px-4 py-2 rounded border"
            onClick={() => setCatalog(LOCAL_SERVICES)}
            title="Reset to default local services"
          >
            Reset
          </button>
        </div>

        <div className="overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-2 text-left">Nombre</th>
                <th className="border px-2 py-2 text-right">Precio</th>
                <th className="border px-2 py-2 text-left">Description</th>
                <th className="border px-2 py-2 text-center">Medida</th>
                <th className="border px-2 py-2 text-center">Modificable</th>
                <th className="border px-2 py-2 text-center">Sobre Total</th>
                <th className="border px-2 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredCatalog.map((svc) => (
                <tr key={svc._id}>
                  <td className="border px-2 py-2 font-medium">{svc.name}</td>
                  <td className="border px-2 py-2 text-right">{money(svc.price)}</td>
                  <td className="border px-2 py-2">{svc.description || "—"}</td>
                  <td className="border px-2 py-2 text-center">{svc.measure || "Unit"}</td>
                  <td className="border px-2 py-2 text-center">
                    {svc.modifiable ? "✔" : "—"}
                  </td>
                  <td className="border px-2 py-2 text-center">
                    {svc.onTotal ? "✔" : "—"}
                  </td>
                  <td className="border px-2 py-2 text-center">
                    <button
                      className="px-3 py-1 rounded bg-blue-600 text-white"
                      onClick={() => addCatalogService(svc)}
                    >
                      Add
                    </button>
                  </td>
                </tr>
              ))}

              {!filteredCatalog.length && (
                <tr>
                  <td colSpan={7} className="text-center px-3 py-6 text-gray-500">
                    No services found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add new service inside modal */}
        <div className="mt-4 border rounded p-4">
          <div className="font-semibold text-sm mb-3">Add new service</div>

          <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 text-sm">
            <div className="lg:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Name</label>
              <input
                className="w-full border px-3 py-2 rounded"
                value={newCatalogService.name}
                onChange={(e) => setNewCatalogService((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Description</label>
              <input
                className="w-full border px-3 py-2 rounded"
                value={newCatalogService.description}
                onChange={(e) =>
                  setNewCatalogService((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Measure</label>
              <input
                className="w-full border px-3 py-2 rounded"
                value={newCatalogService.measure}
                onChange={(e) => setNewCatalogService((p) => ({ ...p, measure: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Price</label>
              <input
                type="number"
                className="w-full border px-3 py-2 rounded"
                value={newCatalogService.price}
                onChange={(e) => setNewCatalogService((p) => ({ ...p, price: Number(e.target.value) }))}
              />
            </div>

            <div className="flex items-end gap-4 lg:col-span-6">
              <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={newCatalogService.modifiable}
                  onChange={(e) =>
                    setNewCatalogService((p) => ({ ...p, modifiable: e.target.checked }))
                  }
                />
                Modificable
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={newCatalogService.onTotal}
                  onChange={(e) => setNewCatalogService((p) => ({ ...p, onTotal: e.target.checked }))}
                />
                Sobre Total
              </label>

              <button
                className="ml-auto px-4 py-2 rounded bg-gray-900 text-white text-sm"
                onClick={addNewServiceToCatalogAndBill}
              >
                Create & Add
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Include Guides Modal */}
      <Modal
        open={openGuidesModal}
        title="Select Guides"
        onClose={() => {
          setSelectedGuideIds([]);
          setOpenGuidesModal(false);
        }}
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">
              Selected: <span className="font-semibold">{selectedGuideIds.length}</span>
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded border"
                onClick={() => {
                  setSelectedGuideIds([]);
                  setOpenGuidesModal(false);
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-700 text-white disabled:bg-blue-300"
                disabled={loadingGuides || !selectedGuideIds.length}
                onClick={includeSelectedGuides}
              >
                Include
              </button>
            </div>
          </div>
        }
      >
        {!selectedClient ? (
          <div className="text-sm text-gray-600">Select a client first.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              Client: <span className="font-semibold">{selectedClient.name}</span>
            </div>

            <div className="overflow-auto border rounded max-h-[500px]">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border px-2 py-2 text-center">Sel.</th>
                    <th className="border px-2 py-2 text-left">Número</th>
                    <th className="border px-2 py-2 text-left">Beneficiario</th>
                    <th className="border px-2 py-2 text-left">País / Dirección</th>
                    <th className="border px-2 py-2 text-center">Piezas</th>
                    <th className="border px-2 py-2 text-center">Peso Kg</th>
                    <th className="border px-2 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingGuides ? (
                    <tr>
                      <td colSpan={7} className="text-center px-3 py-6 text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : (
                    <>
                      {unbilledGuides.map((g) => {
                        const checked = selectedGuideIds.includes(g._id);
                        return (
                          <tr key={g._id} className={checked ? "bg-sky-50" : ""}>
                            <td className="border px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleGuide(g._id)}
                              />
                            </td>
                            <td className="border px-2 py-2">
                              <span className="inline-flex px-2 py-0.5 rounded bg-green-600 text-white text-[10px] font-semibold">
                                {g.number}
                              </span>
                            </td>
                            <td className="border px-2 py-2">{g.recipientName || "—"}</td>
                            <td className="border px-2 py-2 max-w-[380px] truncate">
                              {g.destination || "—"}
                            </td>
                            <td className="border px-2 py-2 text-center">{g.pieces ?? "—"}</td>
                            <td className="border px-2 py-2 text-center">
                              {typeof g.weightKg === "number" ? money(g.weightKg) : "—"}
                            </td>
                            <td className="border px-2 py-2 text-right">
                              {money(getGuideAmount(g))}
                            </td>
                          </tr>
                        );
                      })}

                      {!unbilledGuides.length && (
                        <tr>
                          <td colSpan={7} className="text-center px-3 py-6 text-gray-500">
                            No guides available.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Include Item Modal */}
      <Modal
        open={openItemModal}
        title="Include Item"
        onClose={() => setOpenItemModal(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button className="px-4 py-2 rounded border" onClick={() => setOpenItemModal(false)}>
              Cancel
            </button>
            <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={addItemLine}>
              Add
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Description</label>
            <input
              className="w-full border px-3 py-2 rounded"
              value={newItem.description}
              onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Qty</label>
            <input
              type="number"
              min={1}
              className="w-full border px-3 py-2 rounded"
              value={newItem.quantity}
              onChange={(e) => setNewItem((p) => ({ ...p, quantity: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Unit Price</label>
            <input
              type="number"
              className="w-full border px-3 py-2 rounded"
              value={newItem.unitPrice}
              onChange={(e) => setNewItem((p) => ({ ...p, unitPrice: Number(e.target.value) }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
