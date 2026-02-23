"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import Table from "@/components/Table";
import { Plus, Search, FileText, User, Calendar, Pencil, X, CheckSquare, Square } from "lucide-react";

interface ClientAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface SenderClient {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  identification?: string;
  address?: ClientAddress;
}

interface Tariff {
  _id: string;
  name?: string;
  country?: string;
  measure?: string;
  type?: string;
}

interface RecipientSnapshot {
  index: number;
  name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  identification?: string;
  address?: string; // hoy viene string
}

interface Guide {
  _id: string;
  agency?: string;
  observations?: string;
  tariffHeading?: string;

  senderClient?: SenderClient;
  recipient?: RecipientSnapshot;

  tariffId?: Tariff | null;
  measureValue?: number;
  weightToPay?: number;
  declaredValue?: number;

  shippingPrice?: number;
  servicesTotal?: number;

  status?: string;
  createdAt: string;
}

type ApiResponse<T> = { success: boolean; message?: string } & T;

type GuidesListResponse = ApiResponse<{
  guides: Guide[];
  page?: number;
  pageSize?: number;
  total?: number;
}>;

function buildQuery(params: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;

    if (typeof v === "boolean") {
      sp.set(k, v ? "true" : "false");
      return;
    }

    const s = String(v).trim();
    if (!s) return;
    sp.set(k, s);
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

const ALL = "ALL";

export default function GuidesPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  // ====== Tracking Premium filters ======
  const [q, setQ] = useState("");
  const [searchType, setSearchType] = useState<
    "all" | "sender" | "recipient" | "phone" | "email" | "identification"
  >("all");

  const [destCountry, setDestCountry] = useState(ALL);
  const [destState, setDestState] = useState(ALL);
  const [consolidated, setConsolidated] = useState(ALL);

  const [dateType, setDateType] = useState<"createdAt" | "updatedAt">("createdAt");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [shippingType, setShippingType] = useState(ALL);
  const [agency, setAgency] = useState(ALL);
  const [agent, setAgent] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const [finalized, setFinalized] = useState(ALL);
  const [cancellationStatus, setCancellationStatus] = useState(ALL);
  const [userFilter, setUserFilter] = useState(ALL);

  const [onlyUnprocessed, setOnlyUnprocessed] = useState(false);

  // pagination server-side
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [total, setTotal] = useState(0);

  // Quick find
  const [quickFind, setQuickFind] = useState("");
  const [finding, setFinding] = useState(false);

  // PDFs
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // ✅ BULK STATUS MODAL
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkComment, setBulkComment] = useState("");
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.adncleaningservices.co.uk/v1/api/";

  // Options base
  const shippingTypeOptions = [ALL, "AEREO", "MARITIMO", "TERRESTRE"];

  // 👇 IMPORTANT: estos statuses deben estar alineados con tus “Listado de Estados del Sistema”
  // Por ahora pongo algunos ejemplos + los que ya tenías.
  const statusOptions = [
    "CREATED",
    "PENDING",
    "COMPLETE",
    "CANCELLED",
    "RECIBIDO_EN_BODEGA_ORIGEN",
    "GUIA_CREADA",
    "DESPACHADO",
    "EN_TRANSITO_INTERNACIONAL",
    "LLEGADA_PAIS_DESTINO",
    "EN_DISTRIBUCION",
    "ENTREGADO",
  ];

  const yesNoOptions = [ALL, "YES", "NO"];

  const fetchGuides = async (opts?: { page?: number }) => {
    try {
      setLoading(true);

      const pageToLoad = opts?.page ?? currentPage;

      const qs = buildQuery({
        q,
        searchType,
        destCountry: destCountry === ALL ? "" : destCountry,
        destState: destState === ALL ? "" : destState,
        consolidated: consolidated === ALL ? "" : consolidated,
        dateType,
        from: fromDate,
        to: toDate,
        shippingType: shippingType === ALL ? "" : shippingType,
        agency: agency === ALL ? "" : agency,
        status: status === ALL ? "" : status,
        agent: agent === ALL ? "" : agent,
        createdBy: userFilter === ALL ? "" : userFilter,
        finalized: finalized === ALL ? "" : finalized,
        cancellationStatus: cancellationStatus === ALL ? "" : cancellationStatus,
        onlyUnprocessed,
        page: pageToLoad,
        pageSize: PAGE_SIZE,
      });

      const data = (await Api("GET", `guides${qs}`, null, router)) as GuidesListResponse;

      if (data?.success) {
        setGuides(data.guides || []);
        setTotal(Number(data.total || 0));
        setCurrentPage(Number(data.page || pageToLoad));
      } else {
        showToast(data?.message || "Error loading guides", "error");
      }
    } catch (error: any) {
      showToast(error?.message || "Error loading guides", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchGuides({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Debounce filters => refetch
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      fetchGuides({ page: 1 });
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    q,
    searchType,
    destCountry,
    destState,
    consolidated,
    dateType,
    fromDate,
    toDate,
    shippingType,
    agency,
    agent,
    status,
    finalized,
    cancellationStatus,
    userFilter,
    onlyUnprocessed,
  ]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
  }, [total]);

  const goToPreviousPage = () => {
    const next = Math.max(1, currentPage - 1);
    setCurrentPage(next);
    fetchGuides({ page: next });
  };

  const goToNextPage = () => {
    const next = Math.min(totalPages, currentPage + 1);
    setCurrentPage(next);
    fetchGuides({ page: next });
  };

  const clearFilters = () => {
    setQ("");
    setSearchType("all");
    setDestCountry(ALL);
    setDestState(ALL);
    setConsolidated(ALL);
    setDateType("createdAt");
    setFromDate("");
    setToDate("");
    setShippingType(ALL);
    setAgency(ALL);
    setAgent(ALL);
    setStatus(ALL);
    setFinalized(ALL);
    setCancellationStatus(ALL);
    setUserFilter(ALL);
    setOnlyUnprocessed(false);
    setCurrentPage(1);
  };

  const getStatusBadge = (status?: string) => {
    const st = (status || "CREATED").toLowerCase();
    const map: Record<string, string> = {
      created: "bg-blue-100 text-blue-800",
      complete: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800",
    };
    const cls = map[st] || "bg-gray-100 text-gray-800";
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${cls}`}>
        {(status || "CREATED").toUpperCase()}
      </span>
    );
  };

  const money = (n?: number) => {
    const v = Number(n || 0);
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleQuickFind = async () => {
    const term = quickFind.trim();
    if (!term) return;

    const id = term.includes("/") ? term.split("/").filter(Boolean).pop() || term : term;

    try {
      setFinding(true);
      const local = guides.find((g) => g._id === id);
      if (local) {
        router.push(`/admin/guides/${local._id}/edit`);
        return;
      }

      const resp = (await Api("GET", `guides/${id}`, null, router)) as ApiResponse<{ guide: Guide }>;
      if (!resp?.success || !resp?.guide?._id) throw new Error(resp?.message || "Guide not found");
      router.push(`/admin/guides/${resp.guide._id}/edit`);
    } catch (e: any) {
      showToast(e?.message || "Guide not found", "error");
    } finally {
      setFinding(false);
    }
  };

  const generateGuidePdf = async (guideId: string) => {
    try {
      if (!guideId) return;

      let authToken = token;
      if (!authToken && typeof window !== "undefined") authToken = localStorage.getItem("token");
      if (!authToken) {
        showToast("Sesión no válida. Inicia sesión nuevamente.", "error");
        return;
      }

      setGeneratingPdf(true);

      const res = await fetch(`${API_URL}/guides/${guideId}/pdf`, {
        method: "GET",
        headers: { Authorization: `jwt ${authToken}` },
      });

      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          router.push("/");
        }
        let msg = "Error al generar el PDF";
        try {
          const err = await res.json();
          msg = err?.message || msg;
        } catch { }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `guide_${guideId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
      showToast("PDF generado correctamente", "success");
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Error al generar el PDF", "error");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const openGuideLabelForPrint = async (guideId: string) => {
    const authToken = token || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/guides/${guideId}/label`, {
      headers: { Authorization: `jwt ${authToken}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  // =========================
  // ✅ BULK MODAL LOGIC
  // =========================
  const openBulkModal = () => {
    // preselect nada; si quieres preseleccionar la página actual, se puede
    setBulkSelected({});
    setBulkSearch("");
    setBulkStatus("");
    setBulkComment("");
    setBulkOpen(true);
  };

  const closeBulkModal = () => {
    if (bulkSaving) return;
    setBulkOpen(false);
  };

  const bulkVisibleGuides = useMemo(() => {
    const t = bulkSearch.trim().toLowerCase();
    if (!t) return guides;

    return guides.filter((g) => {
      const hay = [
        g._id,
        g.status,
        g.senderClient?.name,
        g.senderClient?.email,
        g.senderClient?.phone,
        g.senderClient?.identification,
        g.recipient?.name,
        g.recipient?.phone,
        g.recipient?.email,
        g.recipient?.identification,
        g.recipient?.address,
        g.tariffId?.name,
        g.tariffId?.country,
        g.tariffId?.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(t);
    });
  }, [bulkSearch, guides]);

  const selectedIds = useMemo(() => {
    return Object.entries(bulkSelected)
      .filter(([, v]) => v)
      .map(([id]) => id);
  }, [bulkSelected]);

  const toggleSelect = (id: string) => {
    setBulkSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAllVisible = () => {
    const allSelected = bulkVisibleGuides.every((g) => bulkSelected[g._id]);
    if (allSelected) {
      // deseleccionar visibles
      setBulkSelected((prev) => {
        const next = { ...prev };
        bulkVisibleGuides.forEach((g) => {
          delete next[g._id];
        });
        return next;
      });
    } else {
      // seleccionar visibles
      setBulkSelected((prev) => {
        const next = { ...prev };
        bulkVisibleGuides.forEach((g) => {
          next[g._id] = true;
        });
        return next;
      });
    }
  };

  const submitBulkStatus = async () => {
    try {
      if (!selectedIds.length) {
        showToast("Selecciona al menos una guía.", "error");
        return;
      }
      if (!bulkStatus.trim()) {
        showToast("Selecciona el nuevo status.", "error");
        return;
      }
      // comentario recomendado (para bitácora), pero no obligatorio
      const payload = {
        guideIds: selectedIds,
        newStatus: bulkStatus.trim(),
        comment: bulkComment.trim(),
      };

      setBulkSaving(true);

      const resp = (await Api("POST", "guides/bulk-status", payload, router)) as ApiResponse<{
        updatedGuides?: number;
        newStatus?: string;
      }>;

      if (!resp?.success) {
        throw new Error(resp?.message || "Error updating guides");
      }

      showToast(
        `Actualizadas ${resp.updatedGuides ?? selectedIds.length} guías a ${payload.newStatus}`,
        "success"
      );

      setBulkOpen(false);

      // refresca lista (con filtros actuales)
      fetchGuides({ page: currentPage });
    } catch (e: any) {
      showToast(e?.message || "Error updating guides", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  // =========================
  // Table columns
  // =========================
  const columns = [
    {
      key: "senderClient",
      label: "Sender",
      render: (_: any, row: Guide) => (
        <div className="flex items-center">
          <User className="h-4 w-4 text-gray-400 mr-2" />
          <div className="leading-tight">
            <div className="font-medium">{row.senderClient?.name || "—"}</div>
            <div className="text-xs text-gray-500">
              {row.senderClient?.identification || row.senderClient?.email || " "}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "recipient",
      label: "Recipient",
      render: (_: any, row: Guide) => (
        <div className="leading-tight">
          <div className="font-medium">{row.recipient?.name || "—"}</div>
          <div className="text-xs text-gray-500">{row.recipient?.relationship || " "}</div>
        </div>
      ),
    },
    {
      key: "tariffId",
      label: "Tariff",
      render: (_: any, row: Guide) => (
        <div className="leading-tight">
          <div className="font-medium">{row.tariffId?.name || "—"}</div>
          <div className="text-xs text-gray-500">
            {row.tariffId?.country ? `${row.tariffId.country}` : " "}
          </div>
        </div>
      ),
    },
    {
      key: "measureValue",
      label: "Measure",
      render: (value: number, row: Guide) => {
        const mv = Number(value || 0).toFixed(2);
        const wp = row.weightToPay ? ` → ${row.weightToPay}kg` : "";
        return <span className="font-medium">{mv}{wp}</span>;
      },
    },
    {
      key: "shippingPrice",
      label: "Shipping",
      render: (value: number) => <span className="font-medium">£{money(value)}</span>,
    },
    {
      key: "servicesTotal",
      label: "Services",
      render: (value: number) => <span className="font-medium">£{money(value)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (value: string) => getStatusBadge(value),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (value: string) => (
        <div className="flex items-center">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          {new Date(value).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: Guide) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => generateGuidePdf(row._id)}
            className="inline-flex items-center text-sm text-blue-600 hover:underline"
          >
            <FileText className="h-4 w-4 mr-1" />
            View PDF
          </button>

          <button
            type="button"
            onClick={() => openGuideLabelForPrint(row._id)}
            className="inline-flex items-center text-sm text-blue-600 hover:underline"
          >
            <FileText className="h-4 w-4 mr-1" />
            Print Ticket
          </button>

          <button
            type="button"
            onClick={() => router.push(`/admin/guides/${row._id}/edit`)}
            className="inline-flex items-center text-sm text-indigo-600 hover:underline"
            title="Edit guide"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Guides</h1>
          <p className="text-gray-600 mt-2">Create and manage shipping guides</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openBulkModal}
            className="btn-outline flex items-center"
            title="Bulk update status"
          >
            <CheckSquare className="h-5 w-5 mr-2" />
            Bulk Status Update
          </button>

          <button
            type="button"
            onClick={() => router.push("/admin/guides/new")}
            className="btn-primary flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Guide
          </button>
        </div>
      </div>

      <div className="card p-6">
        {/* ===== FILTERS BAR (Tracking Premium style) ===== */}
        <div className="space-y-4 mb-6">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500">Búsqueda:</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="input pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Número de Guía / Remitente / Destinatario / Teléfono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">Tipo de Búsqueda:</label>
              <select className="input" value={searchType} onChange={(e) => setSearchType(e.target.value as any)}>
                <option value="all">Todos</option>
                <option value="sender">Remitente</option>
                <option value="recipient">Destinatario</option>
                <option value="phone">Teléfono</option>
                <option value="email">Email</option>
                <option value="identification">Identificación</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Des.País:</label>
              <select className="input" value={destCountry} onChange={(e) => setDestCountry(e.target.value)}>
                <option value={ALL}>Todos</option>
                <option value="COLOMBIA">Colombia</option>
                <option value="ECUADOR">Ecuador</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Des.Estado:</label>
              <select className="input" value={destState} onChange={(e) => setDestState(e.target.value)}>
                <option value={ALL}>Todos</option>
                <option value="VALLE DEL CAUCA">Valle del Cauca</option>
                <option value="PICHINCHA">Pichincha</option>
              </select>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500">Consolidado:</label>
              <select className="input" value={consolidated} onChange={(e) => setConsolidated(e.target.value)}>
                <option value={ALL}>Todos</option>
                <option value="YES">Sí</option>
                <option value="NO">No</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Tipo de Fecha:</label>
              <select className="input" value={dateType} onChange={(e) => setDateType(e.target.value as any)}>
                <option value="createdAt">Creación</option>
                <option value="updatedAt">Actualización</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Desde:</label>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>

            <div>
              <label className="text-xs text-gray-500">Hasta:</label>
              <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>

            <div>
              <label className="text-xs text-gray-500">Tipo de Envío:</label>
              <select className="input" value={shippingType} onChange={(e) => setShippingType(e.target.value)}>
                {shippingTypeOptions.map((o) => (
                  <option key={o} value={o}>
                    {o === ALL ? "Todos" : o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500">Agencia:</label>
              <select className="input" value={agency} onChange={(e) => setAgency(e.target.value)}>
                <option value={ALL}>Todas</option>
                <option value="Via logistics">Via logistics</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Agente:</label>
              <select className="input" value={agent} onChange={(e) => setAgent(e.target.value)}>
                <option value={ALL}>Todos</option>
                <option value="AGENT_1">Agent 1</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Des.Estado (Status):</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value={ALL}>Todos</option>
                {statusOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Finalizado:</label>
              <select className="input" value={finalized} onChange={(e) => setFinalized(e.target.value)}>
                {yesNoOptions.map((o) => (
                  <option key={o} value={o}>
                    {o === ALL ? "Todos" : o === "YES" ? "Sí" : "No"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Estatus de Anulación:</label>
              <select
                className="input"
                value={cancellationStatus}
                onChange={(e) => setCancellationStatus(e.target.value)}
              >
                <option value={ALL}>Todas</option>
                <option value="REQUESTED">Solicitada</option>
                <option value="APPROVED">Aprobada</option>
                <option value="REJECTED">Rechazada</option>
              </select>
            </div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500">Usuario:</label>
              <select className="input" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                <option value={ALL}>Buscar</option>
                <option value="ME">Mi usuario</option>
              </select>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyUnprocessed((v) => !v)}
                  className={`w-12 h-6 rounded-full relative transition ${onlyUnprocessed ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  aria-label="Solo no procesados"
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${onlyUnprocessed ? "left-6" : "left-1"
                      }`}
                  />
                </button>
                <span className="text-sm text-gray-600">Solo no procesados</span>
              </div>
            </div>

            <div className="md:col-span-3 flex items-end justify-end gap-3">
              <button type="button" onClick={clearFilters} className="btn-outline">
                Limpiar Filtros
              </button>
            </div>
          </div>

          {/* Quick Find */}
          <div className="w-full flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickFind}
                onChange={(e) => setQuickFind(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQuickFind();
                  }
                }}
                className="input pl-9"
                placeholder="Quick find by Guide ID (paste and hit Enter)…"
              />
            </div>

            <button
              type="button"
              onClick={handleQuickFind}
              disabled={finding || !quickFind.trim()}
              className="btn-outline flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="h-4 w-4 mr-2" />
              {finding ? "Searching..." : "Open for update"}
            </button>
          </div>

          <div className="text-sm text-gray-500">
            {total} guide{total !== 1 ? "s" : ""} found
          </div>
        </div>

        <Table
          columns={columns}
          data={guides}
          loading={loading}
          emptyMessage="No guides found. Create your first guide to get started."
        />

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ===========================
      ✅ BULK STATUS MODAL (FIXED FOOTER)
    ============================ */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={closeBulkModal} />

          {/* modal */}
          <div className="relative bg-white w-[95vw] md:w-[900px] rounded-xl shadow-lg flex flex-col max-h-[90vh]">
            {/* HEADER (fixed) */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Bulk Status Update</h3>
                <p className="text-sm text-gray-500">
                  Selecciona guías, elige el status y agrega comentario (bitácora interna).
                </p>
              </div>

              <button
                type="button"
                onClick={closeBulkModal}
                className="p-2 rounded hover:bg-gray-100"
                aria-label="Close"
                disabled={bulkSaving}
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* BODY (scroll) */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              {/* top controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500">Buscar dentro del modal</label>
                  <div className="relative">
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      className="input pl-9"
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                      placeholder="Nombre, email, id, status..."
                    />
                  </div>
                </div>

                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500">Nuevo Status</label>
                  <select
                    className="input"
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500">Seleccionados</label>
                  <div className="input flex items-center justify-between">
                    <span className="text-sm">{selectedIds.length}</span>
                    <button
                      type="button"
                      onClick={toggleSelectAllVisible}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Toggle visibles
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500">Comentario (Bitácora interna)</label>
                <textarea
                  className="input min-h-[90px]"
                  value={bulkComment}
                  onChange={(e) => setBulkComment(e.target.value)}
                  placeholder="Ej: Cambio masivo por recepción en bodega. Validado por Bleidy."
                />
                <div className="text-xs text-gray-400 mt-1">
                  Recomendado: deja comentario para trazabilidad (se guarda en internalNotes + statusHistory).
                </div>
              </div>

              {/* list */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-50 text-xs text-gray-500 px-3 py-2">
                  <div className="col-span-1">Sel</div>
                  <div className="col-span-4">Sender</div>
                  <div className="col-span-4">Recipient</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-1">Date</div>
                </div>

                {/* IMPORTANTE: quitamos max-h fijo y dejamos que el BODY maneje el scroll */}
                <div className="overflow-auto">
                  {bulkVisibleGuides.map((g) => {
                    const checked = !!bulkSelected[g._id];
                    return (
                      <div
                        key={g._id}
                        className="grid grid-cols-12 px-3 py-2 border-t text-sm items-center hover:bg-gray-50"
                      >
                        <div className="col-span-1">
                          <button
                            type="button"
                            onClick={() => toggleSelect(g._id)}
                            className="p-1 rounded hover:bg-gray-100"
                            aria-label="Select guide"
                          >
                            {checked ? (
                              <CheckSquare className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </div>

                        <div className="col-span-4">
                          <div className="font-medium text-gray-900">
                            {g.senderClient?.name || "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {g.senderClient?.identification || g.senderClient?.email || g._id}
                          </div>
                        </div>

                        <div className="col-span-4">
                          <div className="font-medium text-gray-900">{g.recipient?.name || "—"}</div>
                          <div className="text-xs text-gray-500">
                            {g.recipient?.phone || g.recipient?.email || " "}
                          </div>
                        </div>

                        <div className="col-span-2">{getStatusBadge(g.status)}</div>

                        <div className="col-span-1 text-xs text-gray-600">
                          {new Date(g.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}

                  {!bulkVisibleGuides.length && (
                    <div className="p-6 text-center text-sm text-gray-500">No results.</div>
                  )}
                </div>
              </div>
            </div>

            {/* FOOTER (always visible) */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t bg-white shrink-0">
              <button
                type="button"
                className="btn-outline"
                onClick={closeBulkModal}
                disabled={bulkSaving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={submitBulkStatus}
                disabled={bulkSaving || !selectedIds.length || !bulkStatus.trim()}
              >
                {bulkSaving ? "Saving..." : "Update selected"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}