"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import Table from "@/components/Table";
import {
  Plus,
  Search,
  FileText,
  User,
  Pencil,
  X,
  CheckSquare,
  Square,
  Ban,
  ChevronDown,
} from "lucide-react";

interface ClientAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface SenderClientProfile {
  entityType?: "PERSON" | "COMPANY" | string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  identification?: string;
  addressLine?: string;

  cityId?: string | null;
  cityLabel?: string | null;   // ✅ AGREGAR
  zipCode?: string | null;
}

/**
 * Beneficiary dentro de Client (lo mínimo que necesitamos para mostrar bien en lista)
 * Nota: no asumimos estructura 100% rígida: incluimos varios fallbacks.
 */
interface Beneficiary {
  entityType?: "PERSON" | "COMPANY" | string;
  firstName?: string;
  lastName?: string;
  name?: string;
  companyName?: string;

  phone?: string;
  mobile?: string;
  email?: string;
  identification?: string;

  addressLine?: string;
  cityLabel?: string; // ✅ ESTE
  zipCode?: string;

  profile?: SenderClientProfile;
}

interface SenderClient {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  identification?: string;
  address?: ClientAddress;
  profile?: SenderClientProfile;

  beneficiaries?: Beneficiary[]; // ✅ ESTE
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
  address?: string;
}

interface Guide {
  _id: string;
  guideNumber?: number;
  isActive?: boolean;

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
  updatedAt?: string;

  invoiceNumber?: string | null;
  locationStatus?: string | null;
  shippingTypeLabel?: string | null;
  volume?: number | null;
  city?: string | null;
  // ✅ campos enriquecidos desde backend
  senderName?: string | null;
  senderSecondary?: string | null;
  recipientName?: string | null;
  recipientSecondary?: string | null;
  createdBy?: { _id?: string; username?: string; fullName?: string; email?: string } | string | null;
}

interface UserOption {
  _id: string;
  fullName?: string;
  username?: string;
  email?: string;
  type?: string;
}

interface CityOption {
  _id: string;
  label?: string;
  country?: string;
  department?: string;
  city?: string;
  postalCode?: string | null;
}

interface ConsolidatedOption {
  _id: string;
  number?: string;
  description?: string;
}

type ProcessFilter =
  | "ALL"
  | "INVOICED"
  | "PENDING_INVOICE"
  | "CONSOLIDATED"
  | "PENDING_CONSOLIDATE"
  | "CONFIRMED"
  | "PENDING_CONFIRM";

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

type SelectOption = {
  value: string;
  label: string;
};

function FilterSelect({
  value,
  options,
  placeholder = "Todos",
  emptyValue = ALL,
  onChange,
}: {
  value: string;
  options: SelectOption[];
  placeholder?: string;
  emptyValue?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        className="input w-full appearance-none bg-white pr-9 text-gray-700"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={emptyValue}>{placeholder}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
    </div>
  );
}
export default function GuidesPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  // ====== Filters ======
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
  const [processFilter, setProcessFilter] = useState<ProcessFilter>(ALL as ProcessFilter);

  // catalogs for searchable filters
  const [cities, setCities] = useState<CityOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [consolidatedList, setConsolidatedList] = useState<ConsolidatedOption[]>([]);

  // row selection + dropdown actions
  const [selectedGuideIds, setSelectedGuideIds] = useState<Record<string, boolean>>({});
  const [bulkAction, setBulkAction] = useState("");
  const [reportType, setReportType] = useState("");

  // pagination server-side
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [total, setTotal] = useState(0);

  // Quick find
  const [quickFind, setQuickFind] = useState("");
  const [finding, setFinding] = useState(false);

  // PDFs
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Bulk modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkComment, setBulkComment] = useState("");
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  const [nextGuideNumber, setNextGuideNumber] = useState<string>("");
  const [currentNextNumber, setCurrentNextNumber] = useState<number | null>(null);
  const [savingNext, setSavingNext] = useState(false);

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.adncleaningservices.co.uk/v1/api/";

  const shippingTypeOptions = [ALL, "AEREO", "MARITIMO", "TERRESTRE"];

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

  const getUserLabel = (u: UserOption) =>
    String(u.fullName || u.username || u.email || u._id || "").trim();

  const destCountryOptions: SelectOption[] = [
    { value: "COLOMBIA", label: "Colombia" },
    { value: "ECUADOR", label: "Ecuador" },
  ];

  const destStateOptions = useMemo<SelectOption[]>(() => {
    return Array.from(
      new Set(cities.map((c) => String(c.department || "").trim()).filter(Boolean))
    )
      .sort((a, b) => a.localeCompare(b))
      .map((department) => ({
        value: department,
        label: department,
      }));
  }, [cities]);

  const consolidatedOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: "YES", label: "Sí" },
      { value: "NO", label: "No" },
      ...consolidatedList.map((c) => ({
        value: String(c.number || c._id),
        label: c.number
          ? `${c.number}${c.description ? ` - ${c.description}` : ""}`
          : c.description || c._id,
      })),
    ];
  }, [consolidatedList]);

  const userOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: "ME", label: "Mi usuario" },
      ...users.map((u) => ({
        value: u._id,
        label: getUserLabel(u),
      })),
    ];
  }, [users]);

  const fetchCatalogs = async () => {
    try {
      const [citiesResp, usersResp, consResp] = await Promise.allSettled([
        Api("GET", "cities", null, router),
        Api("GET", "auth/users", null, router),
        Api("GET", "consolidated?limit=500", null, router),
      ]);

      if (citiesResp.status === "fulfilled") {
        const data: any = citiesResp.value;
        setCities(Array.isArray(data?.cities) ? data.cities : []);
      }

      if (usersResp.status === "fulfilled") {
        const data: any = usersResp.value;
        const onlyAdminOrDriver = Array.isArray(data?.users)
          ? data.users.filter((u: UserOption) =>
            ["ADMIN"].includes(
              String(u.type || "").toUpperCase()
            )
          )
          : [];

        setUsers(onlyAdminOrDriver);
      }

      if (consResp.status === "fulfilled") {
        const data: any = consResp.value;
        setConsolidatedList(Array.isArray(data?.data) ? data.data : []);
      }
    } catch (_) {
      // Los catálogos no deben bloquear la lista de guías.
    }
  };

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
        processFilter: processFilter === ALL ? "" : processFilter,
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

  const fetchNextGuideNumber = async () => {
    try {
      const resp = (await Api("GET", "guides/settings/guide-number", null, router)) as any;
      if (resp?.success) {
        setCurrentNextNumber(Number(resp.nextNumber || 1));
        setNextGuideNumber(String(resp.nextNumber || 1));
      }
    } catch (_) { }
  };

  const saveNextGuideNumber = async () => {
    try {
      const n = Number(String(nextGuideNumber || "").trim());

      if (!Number.isFinite(n) || n <= 0) {
        showToast("Ingresa un número válido (> 0)", "error");
        return;
      }

      setSavingNext(true);

      const resp = (await Api(
        "POST",
        "guides/settings/guide-number",
        { nextNumber: n },
        router
      )) as any;

      if (!resp?.success) {
        throw new Error(resp?.message || "Error saving next number");
      }

      setCurrentNextNumber(Number(resp.nextNumber || n));
      setNextGuideNumber(String(resp.nextNumber || n));
      showToast(`Siguiente guía configurada: ${resp.nextNumber}`, "success");
    } catch (e: any) {
      showToast(e?.message || "Error saving next number", "error");
    } finally {
      setSavingNext(false);
    }
  };

  const resetNextGuideNumber = async () => {
    try {
      setSavingNext(true);

      const resp = (await Api(
        "POST",
        "guides/settings/guide-number/reset",
        {},
        router
      )) as any;

      if (!resp?.success) {
        throw new Error(resp?.message || "Error resetting next number");
      }

      setCurrentNextNumber(Number(resp.nextNumber || 1));
      setNextGuideNumber(String(resp.nextNumber || 1));
      showToast("Consecutivo reseteado a 1", "success");
    } catch (e: any) {
      showToast(e?.message || "Error resetting next number", "error");
    } finally {
      setSavingNext(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchGuides({ page: 1 });
      fetchCatalogs();
    }
    fetchNextGuideNumber();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    processFilter,
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
    setProcessFilter(ALL as ProcessFilter);
    setBulkAction("");
    setReportType("");
    setSelectedGuideIds({});
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

  const padGuideNumber = (n?: number) => {
    const v = Number(n || 0);
    if (!Number.isFinite(v) || v <= 0) return "—";
    return String(v).padStart(7, "0");
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };

  const getCityFromAddress = (addr?: string | null) => {
    const a = String(addr || "").trim();
    if (!a) return "—";
    return a.split(",")[0]?.trim() || a;
  };

  const getBeneficiaryByIndex = (guide?: Guide) => {
    const idx = Number(guide?.recipient?.index);
    if (!Number.isFinite(idx) || idx < 0) return null;

    const bens = guide?.senderClient?.beneficiaries;
    if (!Array.isArray(bens) || !bens[idx]) return null;

    return bens[idx];
  };

  const getCityLabelFromGuide = (row: Guide) => {
    // 1) city enriquecida por backend
    const direct = String(row.city || "").trim();
    if (direct) return direct;

    // 2) si address viene con algo, saca primera parte
    const addr = String(row.recipient?.address || "").trim();
    if (addr) return addr.split(",")[0]?.trim() || addr;

    // 3) ✅ fallback: cityLabel del beneficiario
    const ben = getBeneficiaryByIndex(row);
    const benCity = String(ben?.cityLabel || "").trim();
    if (benCity) return benCity;

    // 4) (opcional) fallback final: cityLabel del sender profile (por si acaso)
    const senderCity = String(row.senderClient?.profile?.cityLabel || "").trim();
    if (senderCity) return senderCity;

    return "—";
  };

  const getBeneficiaryDisplayName = (beneficiary: any) => {
    if (!beneficiary) return "";

    const entityType = String(beneficiary?.entityType || beneficiary?.profile?.entityType || "").toUpperCase();

    if (entityType === "COMPANY") {
      return (
        String(beneficiary?.companyName || beneficiary?.profile?.companyName || beneficiary?.name || "")
          .trim()
      );
    }

    // varios fallbacks comunes
    const full =
      String(beneficiary?.name || "").trim() ||
      `${beneficiary?.firstName || beneficiary?.profile?.firstName || ""} ${beneficiary?.lastName || beneficiary?.profile?.lastName || ""}`.trim();

    return full;
  };

  const getBeneficiarySecondary = (beneficiary: any) => {
    if (!beneficiary) return " ";
    return (
      String(
        beneficiary?.identification ||
        beneficiary?.email ||
        beneficiary?.phone ||
        beneficiary?.mobile ||
        beneficiary?.profile?.identification ||
        beneficiary?.profile?.email ||
        beneficiary?.profile?.phone ||
        beneficiary?.profile?.mobile ||
        ""
      ).trim() || " "
    );
  };

  // ✅ helpers estables para sender / recipient
  const getSenderName = (guide?: Guide) => {
    if (guide?.senderName && String(guide.senderName).trim()) {
      return String(guide.senderName).trim();
    }

    const profile = guide?.senderClient?.profile;

    if (profile) {
      if (profile.entityType === "COMPANY") {
        const companyName = String(profile.companyName || "").trim();
        if (companyName) return companyName;
      }

      const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
      if (fullName) return fullName;

      if (profile.companyName?.trim()) return profile.companyName.trim();
    }

    if (guide?.senderClient?.name?.trim()) return guide.senderClient.name.trim();

    return "—";
  };

  const getSenderSecondary = (guide?: Guide) => {
    if (guide?.senderSecondary && String(guide.senderSecondary).trim()) {
      return String(guide.senderSecondary).trim();
    }

    const profile = guide?.senderClient?.profile;

    if (profile) {
      return (
        String(
          profile.identification ||
          profile.email ||
          profile.phone ||
          profile.mobile ||
          ""
        ).trim() || " "
      );
    }

    return (
      String(
        guide?.senderClient?.identification ||
        guide?.senderClient?.email ||
        guide?.senderClient?.phone ||
        ""
      ).trim() || " "
    );
  };

  const getRecipientName = (guide?: Guide) => {
    // 1) preferimos lo enriquecido del backend
    if (guide?.recipientName && String(guide.recipientName).trim()) {
      return String(guide.recipientName).trim();
    }

    // 2) luego el snapshot
    if (guide?.recipient?.name && String(guide.recipient.name).trim()) {
      return String(guide.recipient.name).trim();
    }

    // 3) ✅ fallback: reconstruir desde senderClient.beneficiaries[recipient.index]
    const ben = getBeneficiaryByIndex(guide);
    const name = getBeneficiaryDisplayName(ben);
    if (name) return name;

    return "—";
  };

  const getRecipientSecondary = (guide?: Guide) => {
    // 1) enriquecido
    if (guide?.recipientSecondary && String(guide.recipientSecondary).trim()) {
      return String(guide.recipientSecondary).trim();
    }

    // 2) snapshot
    const snap =
      String(
        guide?.recipient?.identification ||
        guide?.recipient?.email ||
        guide?.recipient?.phone ||
        ""
      ).trim();

    if (snap) return snap;

    // 3) ✅ fallback: desde beneficiary real
    const ben = getBeneficiaryByIndex(guide);
    return getBeneficiarySecondary(ben);
  };

  const handleQuickFind = async () => {
    const term = quickFind.trim();
    if (!term) return;

    const numeric = Number(term.replace(/^0+/, ""));
    const isNumeric = Number.isFinite(numeric) && numeric > 0;

    if (isNumeric) {
      setQ(term);
      fetchGuides({ page: 1 });
      return;
    }

    const id = term.includes("/") ? term.split("/").filter(Boolean).pop() || term : term;

    try {
      setFinding(true);

      const local = guides.find((g) => g._id === id);
      if (local) {
        router.push(`/admin/guides/${local._id}`);
        return;
      }

      const resp = (await Api("GET", `guides/${id}`, null, router)) as ApiResponse<{
        guide: Guide;
      }>;

      if (!resp?.success || !resp?.guide?._id) {
        throw new Error(resp?.message || "Guide not found");
      }

      router.push(`/admin/guides/${resp.guide._id}`);
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
      if (!authToken && typeof window !== "undefined") {
        authToken = localStorage.getItem("token");
      }

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
  // BULK MODAL LOGIC
  // =========================
  const openBulkModal = () => {
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
        g.senderName,
        g.senderSecondary,
        getSenderName(g),
        getSenderSecondary(g),
        g.senderClient?.name,
        g.senderClient?.email,
        g.senderClient?.phone,
        g.senderClient?.identification,
        g.recipientName,
        g.recipientSecondary,
        getRecipientName(g),
        getRecipientSecondary(g),
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
      setBulkSelected((prev) => {
        const next = { ...prev };
        bulkVisibleGuides.forEach((g) => {
          delete next[g._id];
        });
        return next;
      });
    } else {
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
      fetchGuides({ page: currentPage });
    } catch (e: any) {
      showToast(e?.message || "Error updating guides", "error");
    } finally {
      setBulkSaving(false);
    }
  };


  const currentSelectedIds = useMemo(() => {
    return Object.entries(selectedGuideIds)
      .filter(([, checked]) => checked)
      .map(([id]) => id);
  }, [selectedGuideIds]);

  const toggleGuideSelection = (id: string) => {
    setSelectedGuideIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllGuidesOnPage = () => {
    const allSelected = guides.length > 0 && guides.every((g) => selectedGuideIds[g._id]);
    setSelectedGuideIds((prev) => {
      const next = { ...prev };
      guides.forEach((g) => {
        if (allSelected) delete next[g._id];
        else next[g._id] = true;
      });
      return next;
    });
  };

  const openBulkStatusFromSelection = () => {
    if (!currentSelectedIds.length) {
      showToast("Selecciona al menos una guía.", "error");
      return;
    }
    setBulkSelected(Object.fromEntries(currentSelectedIds.map((id) => [id, true])));
    setBulkSearch("");
    setBulkStatus("");
    setBulkComment("");
    setBulkOpen(true);
  };

  const cancelGuide = async (guideId: string) => {
    const ok = window.confirm("¿Seguro que deseas anular esta guía?");
    if (!ok) return;

    try {
      const resp = (await Api(
        "PATCH",
        `guides/${guideId}/active`,
        { isActive: false },
        router
      )) as ApiResponse<{ guide?: Guide }>;

      if (!resp?.success) throw new Error(resp?.message || "Error anulando guía");

      showToast("Guía anulada correctamente", "success");
      fetchGuides({ page: currentPage });
    } catch (e: any) {
      showToast(e?.message || "Error anulando guía", "error");
    }
  };

  const handleBulkAction = async (action: string) => {
    setBulkAction(action);
    if (!action) return;

    if (action === "status") {
      openBulkStatusFromSelection();
      setBulkAction("");
      return;
    }

    if (!currentSelectedIds.length) {
      showToast("Selecciona al menos una guía.", "error");
      setBulkAction("");
      return;
    }

    if (action === "invoice") {
      if (!currentSelectedIds.length) {
        showToast("Selecciona al menos una guía.", "error");
        setBulkAction("");
        return;
      }

      // Redirigir a BillsCreate con múltiples guías
      router.push(
        `/admin/bills/create?guideIds=${currentSelectedIds.join(",")}`
      );

      setBulkAction("");
      return;
    }

    if (action === "delivery-note") {
      showToast("Para Nota de Entrega se requiere endpoint de carga masiva con archivo.", "error");
    }

    setBulkAction("");
  };

  const downloadReport = async (format: "excel" | "pdf") => {
    try {
      if (!currentSelectedIds.length) {
        showToast("Selecciona al menos una guía para exportar.", "error");
        setReportType("");
        return;
      }

      const qs = buildQuery({
        guideIds: currentSelectedIds.join(","),
        format,
      });

      const authToken = token || localStorage.getItem("token");

      const res = await fetch(`${API_URL}/guides/reports/export${qs}`, {
        headers: { Authorization: `jwt ${authToken}` },
      });

      if (!res.ok) {
        throw new Error(`Error generando reporte ${format}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `guides_selected.${format === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (e: any) {
      showToast(e?.message || "Error generando reporte", "error");
    } finally {
      setReportType("");
    }
  };

  // =========================
  // Table columns
  // =========================
  const columns = [
    {
      key: "select",
      label: "",
      render: (_: any, row: Guide) => (
        <button type="button" onClick={() => toggleGuideSelection(row._id)} title="Seleccionar guía">
          {selectedGuideIds[row._id] ? (
            <CheckSquare className="h-4 w-4 text-blue-600" />
          ) : (
            <Square className="h-4 w-4 text-gray-400" />
          )}
        </button>
      ),
    },
    {
      key: "guideNumber",
      label: "Número",
      render: (_: any, row: Guide) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/admin/guides/${row._id}`)}
            className="text-blue-700 hover:underline font-medium"
            title="Ver guía"
          >
            {padGuideNumber(row.guideNumber)}
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => generateGuidePdf(row._id)}
              className="p-1.5 rounded border hover:bg-gray-50"
              title="Ver PDF"
              disabled={generatingPdf}
            >
              <FileText className="h-4 w-4 text-blue-700" />
            </button>

            <button
              type="button"
              onClick={() => openGuideLabelForPrint(row._id)}
              className="p-1.5 rounded border hover:bg-gray-50"
              title="Imprimir Ticket"
            >
              <FileText className="h-4 w-4 text-indigo-700" />
            </button>

            <button
              type="button"
              onClick={() => router.push(`/admin/guides/${row._id}/edit`)}
              className="p-1.5 rounded border hover:bg-gray-50"
              title="Editar"
            >
              <Pencil className="h-4 w-4 text-gray-700" />
            </button>

            <button
              type="button"
              onClick={() => cancelGuide(row._id)}
              className="p-1.5 rounded border hover:bg-red-50"
              title="Anular guía"
            >
              <Ban className="h-4 w-4 text-red-600" />
            </button>
          </div>

          {row.isActive === false && (
            <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
              INACTIVA
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Estatus",
      render: (value: string) => getStatusBadge(value),
    },
    {
      key: "senderClient",
      label: "Sender",
      render: (_: any, row: Guide) => (
        <div className="flex items-center">
          <User className="h-4 w-4 text-gray-400 mr-2" />
          <div className="leading-tight">
            <div className="font-medium">{getSenderName(row)}</div>
            <div className="text-xs text-gray-500">{getSenderSecondary(row)}</div>
          </div>
        </div>
      ),
    },
    {
      key: "recipient",
      label: "Destinatario",
      render: (_: any, row: Guide) => (
        <div className="leading-tight">
          <div className="font-medium">{getRecipientName(row)}</div>
          <div className="text-xs text-gray-500">{getRecipientSecondary(row)}</div>
        </div>
      ),
    },
    {
      key: "city",
      label: "Ciudad",
      render: (_: any, row: Guide) => (
        <div className="leading-tight">
          <div className="font-medium">{getCityLabelFromGuide(row)}</div>
          <div className="text-xs text-gray-500">
            {String(row.recipient?.address || "").trim() ||
              String(getBeneficiaryByIndex(row)?.addressLine || "").trim() ||
              " "}
          </div>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Fecha",
      render: (value: string) => (
        <div className="leading-tight">
          <div className="font-medium">{formatDateTime(value)}</div>
        </div>
      ),
    },
    {
      key: "invoice",
      label: "Factura",
      render: (_: any, row: Guide) => <span className="text-sm">{row.invoiceNumber || "N/A"}</span>,
    },
    {
      key: "agency",
      label: "Agencia",
      render: (_: any, row: Guide) => <span className="text-sm">{row.agency || "—"}</span>,
    },
    {
      key: "locationStatus",
      label: "Ubicación",
      render: (_: any, row: Guide) => (
        <span className="text-sm">{row.locationStatus || "—"}</span>
      ),
    },
    {
      key: "shippingType",
      label: "Tipo de Envío",
      render: (_: any, row: Guide) => {

        // prioridad backend
        let type =
          row.shippingTypeLabel ||
          row.tariffId?.type ||
          "AEREO";   // ✅ default

        const map: Record<string, string> = {
          AEREO: "Aéreo",
          MARITIMO: "Marítimo",
          TERRESTRE: "Terrestre",
        };

        return (
          <span className="text-sm">
            {map[String(type).toUpperCase()] || "Aéreo"}
          </span>
        );
      },
    },
    {
      key: "volume",
      label: "Volumen",
      render: (_: any, row: Guide) => <span className="text-sm">{row.volume ?? 0}</span>,
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
          <div className="hidden lg:flex items-center gap-2 border rounded-lg px-3 py-2 bg-white">
            <div className="text-xs text-gray-500">
              Next #
              <div className="text-sm font-semibold text-gray-800">
                {currentNextNumber ?? "—"}
              </div>
            </div>

            <input
              className="input w-[120px]"
              value={nextGuideNumber}
              onChange={(e) => setNextGuideNumber(e.target.value)}
              placeholder="Ej: 4898"
            />

            <button
              type="button"
              onClick={saveNextGuideNumber}
              disabled={savingNext}
              className="btn-outline disabled:opacity-50"
              title="Guardar siguiente número"
            >
              {savingNext ? "Saving..." : "Set"}
            </button>

            <button
              type="button"
              onClick={resetNextGuideNumber}
              disabled={savingNext}
              className="btn-outline disabled:opacity-50"
              title="Reset a 1 (solo pruebas)"
            >
              Reset
            </button>
          </div>

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
            onClick={() => router.push("/admin/guides/create")}
            className="btn-primary flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Guide
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="space-y-4 mb-6">
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
              <FilterSelect
                value={searchType}
                emptyValue="all"
                placeholder="Todos"
                options={[
                  { value: "sender", label: "Remitente" },
                  { value: "recipient", label: "Destinatario" },
                  { value: "phone", label: "Teléfono" },
                  { value: "email", label: "Email" },
                  { value: "identification", label: "Identificación" },
                ]}
                onChange={(value) => setSearchType(value as any)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Des.País:</label>
              <FilterSelect
                value={destCountry}
                options={destCountryOptions}
                placeholder="Todos"
                onChange={setDestCountry}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Des.Estado:</label>
              <FilterSelect
                value={destState}
                options={destStateOptions}
                placeholder="Todos"
                onChange={setDestState}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500">Consolidado:</label>
              <FilterSelect
                value={consolidated}
                options={consolidatedOptions}
                placeholder="Todos / número consolidado"
                onChange={setConsolidated}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Tipo de Fecha:</label>
              <FilterSelect
                value={dateType}
                emptyValue="createdAt"
                placeholder="Creación"
                options={[{ value: "updatedAt", label: "Actualización" }]}
                onChange={(value) => setDateType(value as any)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Desde:</label>
              <input
                className="input"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Hasta:</label>
              <input
                className="input"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Tipo de Envío:</label>
              <FilterSelect
                value={shippingType}
                options={shippingTypeOptions
                  .filter((o) => o !== ALL)
                  .map((o) => ({ value: o, label: o }))}
                placeholder="Todos"
                onChange={setShippingType}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500">Agencia:</label>
              <FilterSelect
                value={agency}
                options={[{ value: "Via logistics", label: "Via logistics" }]}
                placeholder="Todas"
                onChange={setAgency}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Agente:</label>
              <FilterSelect
                value={agent}
                options={[{ value: "AGENT_1", label: "Agent 1" }]}
                placeholder="Todos"
                onChange={setAgent}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Des.Estado (Status):</label>
              <FilterSelect
                value={status}
                options={statusOptions.map((o) => ({ value: o, label: o }))}
                placeholder="Todos"
                onChange={setStatus}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Finalizado:</label>
              <FilterSelect
                value={finalized}
                options={yesNoOptions
                  .filter((o) => o !== ALL)
                  .map((o) => ({ value: o, label: o === "YES" ? "Sí" : "No" }))}
                placeholder="Todos"
                onChange={setFinalized}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Estatus de Anulación:</label>
              <FilterSelect
                value={cancellationStatus}
                options={[
                  { value: "REQUESTED", label: "Solicitada" },
                  { value: "APPROVED", label: "Aprobada" },
                  { value: "REJECTED", label: "Rechazada" },
                ]}
                placeholder="Todas"
                onChange={setCancellationStatus}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500">Usuario:</label>
              <FilterSelect
                value={userFilter}
                options={userOptions}
                placeholder="Buscar"
                onChange={setUserFilter}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Proceso:</label>
              <FilterSelect
                value={processFilter}
                options={[
                  { value: "INVOICED", label: "Facturadas" },
                  { value: "PENDING_INVOICE", label: "Pend. Facturar" },
                  { value: "CONSOLIDATED", label: "Consolidadas" },
                  { value: "PENDING_CONSOLIDATE", label: "Pend. Consolidar" },
                  { value: "CONFIRMED", label: "Confirmadas" },
                  { value: "PENDING_CONFIRM", label: "Pend. Confirmar" },
                ]}
                placeholder="Todos"
                onChange={(value) => setProcessFilter(value as ProcessFilter)}
              />
            </div>

            <div className="md:col-span-3" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 border-t pt-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <button type="button" onClick={toggleAllGuidesOnPage} className="p-1">
                {guides.length > 0 && guides.every((g) => selectedGuideIds[g._id]) ? (
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                ) : (
                  <Square className="h-5 w-5 text-gray-400" />
                )}
              </button>
              Todas / seleccionadas: {currentSelectedIds.length}
            </label>

            <div className="md:w-[220px]">
              <FilterSelect
                value={bulkAction}
                emptyValue=""
                placeholder="Acciones en Lote"
                options={[
                  { value: "status", label: "Nuevo Estatus" },
                  { value: "invoice", label: "Facturar" },
                  { value: "delivery-note", label: "Nota de Entrega" },
                ]}
                onChange={handleBulkAction}
              />
            </div>

            <div className="md:w-[190px]">
              <FilterSelect
                value={reportType}
                emptyValue=""
                placeholder="Reportes"
                options={[
                  { value: "excel", label: "Exportar a Excel" },
                  { value: "pdf", label: "Exportar a PDF" },
                ]}
                onChange={(value) => {
                  const nextValue = value as "excel" | "pdf" | "";
                  setReportType(nextValue);
                  if (nextValue) downloadReport(nextValue);
                }}
              />
            </div>

            <button type="button" onClick={clearFilters} className="btn-outline">
              Limpiar Filtros
            </button>
          </div>

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
              {finding ? "Searching..." : "Open guide"}
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

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeBulkModal} />

          <div className="relative bg-white w-[95vw] md:w-[900px] rounded-xl shadow-lg flex flex-col max-h-[90vh]">
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

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
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
                  <FilterSelect
                    value={bulkStatus}
                    emptyValue=""
                    placeholder="Seleccionar..."
                    options={statusOptions.map((s) => ({ value: s, label: s }))}
                    onChange={setBulkStatus}
                  />
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
                  Recomendado: deja comentario para trazabilidad (se guarda en internalNotes +
                  statusHistory).
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-50 text-xs text-gray-500 px-3 py-2">
                  <div className="col-span-1">Sel</div>
                  <div className="col-span-2">Número</div>
                  <div className="col-span-2">Estatus</div>
                  <div className="col-span-3">Remitente</div>
                  <div className="col-span-3">Destinatario</div>
                  <div className="col-span-1">Fecha</div>
                </div>

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

                        <div className="col-span-2">
                          <div className="font-medium text-blue-700">
                            {padGuideNumber(g.guideNumber)}
                          </div>
                          {g.isActive === false && (
                            <div className="text-[11px] text-gray-500">INACTIVA</div>
                          )}
                        </div>

                        <div className="col-span-2">{getStatusBadge(g.status)}</div>

                        <div className="col-span-3">
                          <div className="font-medium text-gray-900">{getSenderName(g)}</div>
                          <div className="text-xs text-gray-500">{getSenderSecondary(g)}</div>
                        </div>

                        <div className="col-span-3">
                          <div className="font-medium text-gray-900">{getRecipientName(g)}</div>
                          <div className="text-xs text-gray-500">
                            {getCityFromAddress(g.recipient?.address)}
                          </div>
                        </div>

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