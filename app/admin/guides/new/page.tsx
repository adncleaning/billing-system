"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, Pencil } from "lucide-react";

import { Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import Modal from "@/components/Modal";

/** =========================
 *  Types aligned with new backend model
 *  ========================= */
type EntityType = "PERSON" | "COMPANY";

type PersonPayload = {
  entityType: EntityType;

  firstName?: string;
  lastName?: string;
  companyName?: string;

  identification?: string;
  email?: string;

  phone?: string;
  mobile?: string;

  addressLine?: string;
  cityId?: string | null;
  cityLabel?: string;
  zipCode?: string;

  location?: string;

  // Only for beneficiaries
  relationship?: string;
};

interface Client {
  _id: string;
  agency?: string;
  profile: PersonPayload;
  beneficiaries: PersonPayload[];
  isActive: boolean;
}

interface City {
  _id: string;
  label: string;
  postalCode?: string | null;
  isActive: boolean;
}

interface TariffRange {
  min: number;
  max: number;
  price: number;
  cost: number;
  applyDeclaredValue?: boolean;
}

interface Tariff {
  _id: string;
  name: string;
  country?: string;
  type?: string;
  measure?: string;
  ranges?: TariffRange[];
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  client: string | { _id: string; name: string; email: string };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;

  guide?: string | null;
  guideId?: string | null;
  guideRef?: string | null;
}

type ServiceRow = {
  id: string;
  included: boolean;
  name: string;
  measure: string;
  price: number;
  quantity: number;
};

type PackageRow = {
  id: string;
  description: string;
  value: number;   // “Valor”
  length: number;  // L
  width: number;   // W
  height: number;  // H
  weight: number;  // Wt (peso real)
  pcs: number;     // Pcs
};

const VOLUMETRIC_DIVISOR = 5000; // 👈 ajustable: 5000 o 6000 según tu regla

type InvoiceMode = "ECUADOR" | "COLOMBIA";

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};



const emptyPerson = (): PersonPayload => ({
  entityType: "PERSON",
  firstName: "",
  lastName: "",
  companyName: "",
  identification: "",
  email: "",
  phone: "",
  mobile: "",
  addressLine: "",
  cityId: null,
  cityLabel: "",
  zipCode: "",
  location: "",
});
const normalizePerson = (p: any): PersonPayload => {
  const base = emptyPerson();
  if (!p) return base;

  // Si ya viene con entityType, asumimos que ya es nuevo schema
  if (p.entityType) return { ...base, ...p };

  // Si viene viejo (name/email/phone/address...)
  const fullName = (p.name || "").toString().trim();
  const parts = fullName.split(" ").filter(Boolean);

  return {
    ...base,
    entityType: "PERSON",
    firstName: (parts[0] || "").trim(),
    lastName: parts.slice(1).join(" ").trim(),
    companyName: "",
    email: (p.email || "").toString(),
    phone: (p.phone || "").toString(),
    identification: (p.identification || "").toString(),
    // address viejo (street/city/state/zipCode) -> addressLine + zipCode
    addressLine: [
      p.address?.street || "",
      p.address?.city || "",
      p.address?.state || "",
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    zipCode: (p.address?.zipCode || p.zipCode || "").toString(),
    cityLabel: (p.cityLabel || p.address?.city || "").toString(),
    cityId: p.cityId ?? null,
    mobile: (p.mobile || "").toString(),
    location: (p.location || "").toString(),
  };
};

const normalizeClient = (c: any): Client => {
  // nuevo schema: { profile, beneficiaries, ... }
  if (c?.profile) {
    return {
      ...c,
      profile: normalizePerson(c.profile),
      beneficiaries: Array.isArray(c.beneficiaries) ? c.beneficiaries.map(normalizePerson) : [],
    };
  }

  // viejo schema: { name, email, phone, beneficiaries:[{name,...}], ... }
  return {
    ...c,
    profile: normalizePerson(c),
    beneficiaries: Array.isArray(c?.beneficiaries) ? c.beneficiaries.map(normalizePerson) : [],
  };
};

const emptyBeneficiary = (): PersonPayload => ({
  ...emptyPerson(),
  relationship: "",
});

const displayPersonName = (p?: PersonPayload | null) => {
  if (!p) return "—";
  if (p.entityType === "COMPANY") return (p.companyName || "Company").trim();
  const full = `${p.firstName || ""} ${p.lastName || ""}`.trim();
  return full || "Person";
};

const displayClientLabel = (c: any) => {
  const client = normalizeClient(c);
  const p = client.profile;
  const main = displayPersonName(p);
  const contact = (p.email || p.phone || p.mobile || "").trim();
  return contact ? `${main} — ${contact}` : main;
};

export default function CreateGuidePage() {
  const router = useRouter();
  const { showToast } = useToast();

  // ====== base data ======
  const [clients, setClients] = useState<Client[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState<boolean>(true);

  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingTariffs, setLoadingTariffs] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // ====== Sender / Recipient ======
  const [senderSearch, setSenderSearch] = useState("");
  const [senderClientId, setSenderClientId] = useState("");
  const [senderClient, setSenderClient] = useState<Client | null>(null);
  const [beneficiaryIndex, setBeneficiaryIndex] = useState<number>(0);

  // ====== Basic fields ======
  const [agency, setAgency] = useState<string>("Via logistics");
  const [observations, setObservations] = useState<string>("");
  const [tariffHeading, setTariffHeading] = useState<string>("");

  // ====== Bitácora interna ======
  const [internalComments, setInternalComments] = useState<string>("");
  const INTERNAL_COMMENTS_MAX = 1000;

  // ====== Tariff assign ======
  const [tariffId, setTariffId] = useState<string>("");
  const [measureValue, setMeasureValue] = useState<number>(0);
  const [shippingPrice, setShippingPrice] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);

  // ====== Charges ======
  const [declaredValue, setDeclaredValue] = useState<number>(0);
  const [insuredAmount, setInsuredAmount] = useState<number>(0);
  const [insurance, setInsurance] = useState<number>(10);
  const [tax, setTax] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [commission, setCommission] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);

  // ====== Services ======
  const [services, setServices] = useState<ServiceRow[]>([
    { id: "box_small", included: false, name: "Caja pequeña", measure: "Unit", price: 2.5, quantity: 0 },
    { id: "box_medium", included: false, name: "Caja Mediana", measure: "Unit", price: 3.5, quantity: 0 },
    { id: "box_large", included: false, name: "Caja Grande", measure: "Unit", price: 4.0, quantity: 0 },
  ]);

  // ====== Packages / Invoice ======
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");

  // ====== Invoice Mode ======
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("ECUADOR");

  // ====== Pagination invoices ======
  const [invoicePage, setInvoicePage] = useState<number>(1);
  const INVOICE_PAGE_SIZE = 8;

  // ====== Create Client Modal ======
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [addBeneficiaryNow, setAddBeneficiaryNow] = useState(false);

  const [clientForm, setClientForm] = useState<{
    agency: string;
    profile: PersonPayload;
    beneficiary: PersonPayload;
  }>({
    agency: "Via logistics",
    profile: emptyPerson(),
    beneficiary: emptyBeneficiary(),
  });

  // ====== Edit Client Modal ======
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [updatingClient, setUpdatingClient] = useState(false);
  const [editClientForm, setEditClientForm] = useState<{
    agency: string;
    profile: PersonPayload;
  }>({
    agency: "Via logistics",
    profile: emptyPerson(),
  });

  // ====== Add Beneficiary Modal ======
  const [showAddBeneficiaryModal, setShowAddBeneficiaryModal] = useState(false);
  const [savingBeneficiary, setSavingBeneficiary] = useState(false);
  const [beneficiaryForm, setBeneficiaryForm] = useState<PersonPayload>(emptyBeneficiary());

  // ====== Edit Beneficiary Modal ======
  const [showEditBeneficiaryModal, setShowEditBeneficiaryModal] = useState(false);
  const [updatingBeneficiary, setUpdatingBeneficiary] = useState(false);
  const [editBeneficiaryForm, setEditBeneficiaryForm] = useState<PersonPayload>(emptyBeneficiary());

  // ====== Saving guide ======
  const [saving, setSaving] = useState(false);

  /** =========================
   *  Cities helpers
   *  ========================= */
  const cityById = useMemo(() => {
    const map = new Map<string, City>();
    for (const c of cities) map.set(c._id, c);
    return map;
  }, [cities]);

  const applyCitySelection = (person: PersonPayload, cityId: string) => {
    const city = cityById.get(cityId);
    if (!city) {
      return {
        ...person,
        cityId: cityId || null,
        cityLabel: "",
      };
    }
    // auto fill label + zipCode from postalCode
    return {
      ...person,
      cityId: city._id,
      cityLabel: city.label,
      zipCode: (city.postalCode || "").toString(),
    };
  };

  const [packages, setPackages] = useState<PackageRow[]>([
    { id: crypto.randomUUID(), description: "", value: 0, length: 0, width: 0, height: 0, weight: 0, pcs: 1 },
  ]);

  const volumetricWeight = (p: PackageRow) => {
    const l = toNum(p.length);
    const w = toNum(p.width);
    const h = toNum(p.height);
    if (!l || !w || !h) return 0;
    return Number(((l * w * h) / VOLUMETRIC_DIVISOR).toFixed(2));
  };

  const packageChargeableWeight = (p: PackageRow) => {
    const real = toNum(p.weight);
    const vol = volumetricWeight(p);
    return Math.max(real, vol);
  };

  const packagesDeclaredValue = useMemo(() => {
    return Number(packages.reduce((sum, p) => sum + toNum(p.value), 0).toFixed(2));
  }, [packages]);

  const packagesTotalWeight = useMemo(() => {
    // total “Wt” real sumado
    return Number(packages.reduce((sum, p) => sum + toNum(p.weight), 0).toFixed(2));
  }, [packages]);

  const packagesChargeableWeight = useMemo(() => {
    // suma de “peso a cobrar” por paquete
    return Number(packages.reduce((sum, p) => sum + packageChargeableWeight(p), 0).toFixed(2));
  }, [packages]);

  /** =========================
   *  Tax calculation
   *  ========================= */
  useEffect(() => {
    const dv = toNum(declaredValue || 0);
    const calculatedTax = Number((dv * 0.19).toFixed(2));
    setTax(calculatedTax);
  }, [declaredValue]);

  /** =========================
   *  Fetch base data
   *  ========================= */
  useEffect(() => {
    (async () => {
      try {
        const c: any = await Api("GET", "clients", null, router);
        if (c?.success) setClients((c.clients || []).map(normalizeClient));
      } catch {
        showToast("Error loading clients", "error");
      } finally {
        setLoadingClients(false);
      }
    })();

    (async () => {
      try {
        const t: any = await Api("GET", "tariffs", null, router);
        if (t?.success) setTariffs(t.tariffs || []);
      } catch {
        showToast("Error loading tariffs", "error");
      } finally {
        setLoadingTariffs(false);
      }
    })();

    (async () => {
      setLoadingCities(true);
      try {
        // loads all active cities
        const r: any = await Api("GET", "cities", null, router);
        if (r?.success) setCities(r.cities || []);
      } catch {
        showToast("Error loading cities", "error");
      } finally {
        setLoadingCities(false);
      }
    })();
  }, [router, showToast]);

  /** =========================
   *  Load sender client detail
   *  ========================= */
  useEffect(() => {
    if (!senderClientId) {
      setSenderClient(null);
      setBeneficiaryIndex(0);
      setInvoices([]);
      setSelectedInvoiceId("");
      return;
    }

    (async () => {
      try {
        const data: any = await Api("GET", `clients/${senderClientId}`, null, router);
        if (data?.success) {
          setSenderClient(normalizeClient(data.client));
          setBeneficiaryIndex(0);
        }
      } catch {
        showToast("Error loading client detail", "error");
      }
    })();
  }, [senderClientId, router, showToast]);

  /** =========================
   *  Load invoices for sender (only available without guide)
   *  ========================= */
  useEffect(() => {
    if (!senderClientId) return;

    setLoadingInvoices(true);
    (async () => {
      try {
        const data: any = await Api("GET", `invoices/by-client/${senderClientId}?available=1`, null, router);

        if (data?.success) {
          const all: Invoice[] = data.invoices || [];
          const filtered = all.filter((inv) => !inv.guide && !inv.guideId && !inv.guideRef);
          setInvoices(filtered);
          setInvoicePage(1);
          return;
        }

        setInvoices([]);
      } catch {
        try {
          const raw: any = await Api("GET", `invoices/by-client/${senderClientId}`, null, router);
          const all: Invoice[] = raw?.invoices || [];
          const filtered = all.filter((inv) => !inv.guide && !inv.guideId && !inv.guideRef);
          setInvoices(filtered);
          setInvoicePage(1);
        } catch {
          showToast("Error loading invoices", "error");
          setInvoices([]);
        }
      } finally {
        setLoadingInvoices(false);
      }
    })();
  }, [senderClientId, router, showToast]);

  /** =========================
   *  Selected invoice helpers
   *  ========================= */
  const selectedInvoice = useMemo(() => {
    return invoices.find((i) => i._id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  const invoiceLinesTotal = (inv: Invoice) =>
    Number((inv.items || []).reduce((sum, it) => sum + toNum(it.total || 0), 0).toFixed(2));

  const invoiceColombiaParagraph = (inv: Invoice) => {
    const parts = (inv.items || [])
      .map((it) => {
        const desc = (it.description || "").trim();
        const qty = toNum(it.quantity || 0);
        if (!desc) return "";
        return qty > 0 ? `${desc} (x${qty})` : desc;
      })
      .filter(Boolean);

    return parts.join(", ");
  };
  useEffect(() => {
    setDeclaredValue(packagesDeclaredValue);
  }, [packagesDeclaredValue]);

  useEffect(() => {
    // Auto toma peso a cobrar de paquetes
    setMeasureValue(packagesChargeableWeight);
  }, [packagesChargeableWeight]);

  /** =========================
   *  Calculate tariff by weight
   *  ========================= */
  useEffect(() => {
    if (!tariffId || !measureValue || measureValue <= 0) {
      setShippingPrice(0);
      setShippingCost(0);
      return;
    }

    (async () => {
      try {
        const data: any = await Api("GET", `tariffs/${tariffId}/calc?weight=${measureValue}`, null, router);
        if (data?.success?.toString() === "true" || data?.success === true) {
          setShippingPrice(toNum(data.range?.price || 0));
          setShippingCost(toNum(data.range?.cost || 0));
        } else {
          setShippingPrice(0);
          setShippingCost(0);
        }
      } catch {
        setShippingPrice(0);
        setShippingCost(0);
      }
    })();
  }, [tariffId, measureValue, router]);

  /** =========================
   *  Services totals
   *  ========================= */
  const servicesTotal = useMemo(() => {
    return services.reduce((sum, s) => {
      if (!s.included) return sum;
      const qty = toNum(s.quantity || 0);
      return sum + toNum(s.price || 0) * qty;
    }, 0);
  }, [services]);

  const totalGuide = useMemo(() => {
    const base = toNum(shippingPrice || 0);
    const extras =
      toNum(insurance || 0) +
      toNum(tax || 0) +
      toNum(otherCharges || 0) +
      toNum(commission || 0) -
      toNum(discount || 0);

    return base + servicesTotal + extras;
  }, [shippingPrice, servicesTotal, insurance, tax, otherCharges, commission, discount]);

  /** =========================
   *  Filter clients
   *  ========================= */
  const filteredClients = useMemo(() => {
    const t = senderSearch.toLowerCase().trim();
    if (!t) return clients;

    return clients.filter((c) => {
      const p = c.profile || emptyPerson();
      const name = displayPersonName(p).toLowerCase();
      return (
        name.includes(t) ||
        (p.companyName || "").toLowerCase().includes(t) ||
        (p.email || "").toLowerCase().includes(t) ||
        (p.phone || "").toLowerCase().includes(t) ||
        (p.mobile || "").toLowerCase().includes(t) ||
        (p.identification || "").toLowerCase().includes(t)
      );
    });
  }, [clients, senderSearch]);

  /** =========================
   *  Filter invoices + pagination
   *  ========================= */
  const filteredInvoices = useMemo(() => {
    const t = invoiceSearch.toLowerCase().trim();
    if (!t) return invoices;

    return invoices.filter((inv) => {
      const num = inv.invoiceNumber?.toLowerCase().includes(t);
      const total = String(inv.total || "").includes(t);
      const items = (inv.items || []).some((it) => it.description?.toLowerCase().includes(t));
      return num || total || items;
    });
  }, [invoices, invoiceSearch]);

  const invoiceTotalPages = Math.max(1, Math.ceil(filteredInvoices.length / INVOICE_PAGE_SIZE));
  const paginatedInvoices = filteredInvoices.slice((invoicePage - 1) * INVOICE_PAGE_SIZE, invoicePage * INVOICE_PAGE_SIZE);

  useEffect(() => setInvoicePage(1), [invoiceSearch]);

  /** =========================
   *  Create Client Modal helpers
   *  ========================= */
  const updateClientProfile = (patch: Partial<PersonPayload>) => {
    setClientForm((p) => ({ ...p, profile: { ...p.profile, ...patch } }));
  };

  const updateClientBeneficiary = (patch: Partial<PersonPayload>) => {
    setClientForm((p) => ({ ...p, beneficiary: { ...p.beneficiary, ...patch } }));
  };

  const isPersonNameValid = (p: PersonPayload) => {
    if (p.entityType === "COMPANY") return !!p.companyName?.trim();
    return !!p.firstName?.trim() || !!p.lastName?.trim();
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingClient(true);

    try {
      const p = clientForm.profile;

      if (!isPersonNameValid(p)) {
        showToast("Client name is required (first/last or company name)", "error");
        return;
      }

      const payload: any = {
        agency: clientForm.agency,
        profile: clientForm.profile,
        beneficiaries: [],
      };

      if (addBeneficiaryNow) {
        const b = clientForm.beneficiary;
        if (!isPersonNameValid(b)) {
          showToast("Beneficiary name is required (first/last or company name)", "error");
          return;
        }
        payload.beneficiaries = [b];
      }

      const data: any = await Api("POST", "clients", payload, router);
      if (!data?.success) {
        showToast(data?.message || "Error creating client", "error");
        return;
      }

      const newClient: Client = data.client;

      setClients((prev) => [newClient, ...prev]);
      setSenderClientId(newClient._id);
      setShowCreateClientModal(false);

      // reset form
      setAddBeneficiaryNow(false);
      setClientForm({
        agency: "Via logistics",
        profile: emptyPerson(),
        beneficiary: emptyBeneficiary(),
      });

      showToast("Client created successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Error creating client", "error");
    } finally {
      setCreatingClient(false);
    }
  };

  /** =========================
   *  Edit Client (Sender)
   *  ========================= */
  const openEditClient = () => {
    if (!senderClient || !senderClientId) {
      showToast("Select a client first", "error");
      return;
    }

    setEditClientForm({
      agency: senderClient.agency || "Via logistics",
      profile: { ...emptyPerson(), ...(senderClient.profile || {}) },
    });

    setShowEditClientModal(true);
  };

  const updateEditClientProfile = (patch: Partial<PersonPayload>) => {
    setEditClientForm((p) => ({ ...p, profile: { ...p.profile, ...patch } }));
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderClientId || !senderClient) return;

    setUpdatingClient(true);
    try {
      const payload = {
        agency: editClientForm.agency,
        profile: editClientForm.profile,
        beneficiaries: senderClient.beneficiaries || [],
      };

      const updated: any = await Api("PUT", `clients/${senderClientId}`, payload, router);
      if (!updated?.success) {
        showToast(updated?.message || "Error updating client", "error");
        return;
      }

      const refreshed: any = await Api("GET", `clients/${senderClientId}`, null, router);
      if (refreshed?.success) {
        setSenderClient(normalizeClient(refreshed.client));
        setClients((prev) => prev.map((c) => (c._id === senderClientId ? normalizeClient(refreshed.client) : c)));
      }

      setShowEditClientModal(false);
      showToast("Client updated successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Error updating client", "error");
    } finally {
      setUpdatingClient(false);
    }
  };

  /** =========================
   *  Add Beneficiary to sender client
   *  ========================= */
  const handleAddBeneficiaryToSender = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!senderClientId) {
      showToast("Select a sender first", "error");
      return;
    }

    if (!isPersonNameValid(beneficiaryForm)) {
      showToast("Beneficiary name is required (first/last or company name)", "error");
      return;
    }

    setSavingBeneficiary(true);
    try {
      // Ensure we have current sender data
      const res = (await Api("GET", `clients/${senderClientId}`, null, router)) as any;
      const current: Client | null = senderClient ?? (res?.client as Client | null);

      if (!current) {
        showToast("Error loading sender client", "error");
        return;
      }

      const beneficiaries = [...(current?.beneficiaries || []), beneficiaryForm];

      const payload = {
        agency: current.agency || "Via logistics",
        profile: current.profile,
        beneficiaries,
      };

      const updated: any = await Api("PUT", `clients/${senderClientId}`, payload, router);
      if (!updated?.success) {
        showToast(updated?.message || "Error adding beneficiary", "error");
        return;
      }

      const refreshed: any = await Api("GET", `clients/${senderClientId}`, null, router);
      if (refreshed?.success) {
        setSenderClient(refreshed.client);
        setBeneficiaryIndex(Math.max(0, (refreshed.client?.beneficiaries?.length || 1) - 1));
        setClients((prev) => prev.map((c) => (c._id === senderClientId ? { ...c, ...refreshed.client } : c)));
      }

      setBeneficiaryForm(emptyBeneficiary());
      setShowAddBeneficiaryModal(false);
      showToast("Beneficiary added successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Error adding beneficiary", "error");
    } finally {
      setSavingBeneficiary(false);
    }
  };

  /** =========================
   *  Edit Beneficiary
   *  ========================= */
  const beneficiaryPreview = useMemo(() => {
    if (!senderClient?.beneficiaries?.length) return null;
    return senderClient.beneficiaries[beneficiaryIndex] || null;
  }, [senderClient, beneficiaryIndex]);

  const openEditBeneficiary = () => {
    if (!senderClientId || !senderClient) {
      showToast("Select a sender first", "error");
      return;
    }
    if (!beneficiaryPreview) {
      showToast("Select a beneficiary first", "error");
      return;
    }

    setEditBeneficiaryForm({
      ...emptyBeneficiary(),
      ...beneficiaryPreview,
    });

    setShowEditBeneficiaryModal(true);
  };

  const handleUpdateBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!senderClientId || !senderClient) return;
    if (!isPersonNameValid(editBeneficiaryForm)) {
      showToast("Beneficiary name is required (first/last or company name)", "error");
      return;
    }

    setUpdatingBeneficiary(true);
    try {
      const beneficiaries = [...(senderClient.beneficiaries || [])];
      if (beneficiaryIndex < 0 || beneficiaryIndex >= beneficiaries.length) {
        showToast("Invalid beneficiary selected", "error");
        return;
      }

      beneficiaries[beneficiaryIndex] = {
        ...beneficiaries[beneficiaryIndex],
        ...editBeneficiaryForm,
      };

      const payload = {
        agency: senderClient.agency || "Via logistics",
        profile: senderClient.profile,
        beneficiaries,
      };

      const updated: any = await Api("PUT", `clients/${senderClientId}`, payload, router);
      if (!updated?.success) {
        showToast(updated?.message || "Error updating beneficiary", "error");
        return;
      }

      const refreshed: any = await Api("GET", `clients/${senderClientId}`, null, router);
      if (refreshed?.success) {
        setSenderClient(refreshed.client);
        setClients((prev) => prev.map((c) => (c._id === senderClientId ? { ...c, ...refreshed.client } : c)));
      }

      setShowEditBeneficiaryModal(false);
      showToast("Beneficiary updated successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Error updating beneficiary", "error");
    } finally {
      setUpdatingBeneficiary(false);
    }
  };

  /** =========================
   *  Save Guide
   *  ========================= */
  const handleSaveGuide = async () => {
    try {
      if (!packages.length) {
        showToast("Add at least one package", "error");
        return;
      }
      const hasAnyData = packages.some(p =>
        p.description.trim() ||
        toNum(p.value) > 0 ||
        toNum(p.length) > 0 ||
        toNum(p.width) > 0 ||
        toNum(p.height) > 0 ||
        toNum(p.weight) > 0
      );
      if (!hasAnyData) {
        showToast("Fill at least one package detail", "error");
        return;
      }
      if (!senderClientId) {
        showToast("Select a sender (client)", "error");
        return;
      }
      if (!senderClient?.beneficiaries?.length) {
        showToast("Sender has no beneficiaries. Add at least one.", "error");
        return;
      }
      if (!tariffId) {
        showToast("Select a tariff", "error");
        return;
      }
      if (!measureValue || measureValue <= 0) {
        showToast("Enter a valid weight (measure value)", "error");
        return;
      }

      const trimmedInternal = internalComments.trim();
      if (trimmedInternal.length > INTERNAL_COMMENTS_MAX) {
        showToast(`Internal comments exceeds ${INTERNAL_COMMENTS_MAX} characters`, "error");
        return;
      }

      setSaving(true);

      const payload = {
        agency,
        observations,
        tariffHeading,
        senderClientId,
        beneficiaryIndex,
        tariffId,
        measureValue,
        declaredValue,
        insuredAmount,
        insurance,
        tax,
        discount,
        commission,
        otherCharges,
        services: services.map((s) => ({
          name: s.name,
          measure: s.measure,
          price: s.price,
          quantity: s.quantity,
          included: s.included,
        })),
        invoiceIds: [], // compat con backend viejo si algo lo usa
        // invoiceMode,  // opcional: quítalo si ya no aplica
        internalComments: trimmedInternal || "",
        packages: packages.map(p => ({
          description: p.description,
          value: toNum(p.value),
          length: toNum(p.length),
          width: toNum(p.width),
          height: toNum(p.height),
          weight: toNum(p.weight),
          pcs: toNum(p.pcs),
          volumetricWeight: volumetricWeight(p),
          chargeableWeight: packageChargeableWeight(p),
        })),
      };

      const data: any = await Api("POST", "guides", payload, router);
      if (!data?.success) {
        showToast(data?.message || "Error creating guide", "error");
        return;
      }

      showToast("Guide created successfully", "success");
      router.push("/admin/guides");
    } catch (err: any) {
      showToast(err?.message || "Error creating guide", "error");
    } finally {
      setSaving(false);
    }
  };

  /** =========================
   *  UI helpers
   *  ========================= */
  const setServiceIncluded = (id: string, included: boolean) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, included, quantity: included ? Math.max(1, s.quantity) : 0 } : s)));
  };

  const setServiceQty = (id: string, qty: number) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, quantity: Math.max(0, qty) } : s)));
  };

  const setServicePrice = (id: string, price: number) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, price: Math.max(0, toNum(price || 0)) } : s)));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Guide</h1>
          <p className="text-gray-600 mt-2">Fill sender, recipient, packages, tariff and services</p>
        </div>
      </div>

      {/* Sender / Recipient */}
      <div className="grid grid-cols-2 gap-6">
        {/* Sender */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Remitente *</h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openEditClient}
                className="btn-outline text-sm flex items-center"
                disabled={!senderClientId || !senderClient}
                title="Edit selected client"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit client
              </button>

              <button type="button" onClick={() => setShowCreateClientModal(true)} className="btn-outline text-sm flex items-center">
                <Plus className="h-4 w-4 mr-1" />
                Add client
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="relative w-full">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={senderSearch}
                onChange={(e) => setSenderSearch(e.target.value)}
                className="input pl-9"
                placeholder="Search client by name, email, phone..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select client</label>
            <select className="input" value={senderClientId} onChange={(e) => setSenderClientId(e.target.value)} disabled={loadingClients}>
              <option value="">Choose...</option>
              {filteredClients.map((c) => (
                <option key={c._id} value={c._id}>
                  {displayClientLabel(c)}
                </option>
              ))}
            </select>
          </div>

          {senderClient && (
            <div className="mt-4 text-sm text-gray-700 space-y-1">
              <div className="font-medium">{displayPersonName(senderClient.profile)}</div>
              {!!senderClient.profile.email && <div>{senderClient.profile.email}</div>}
              {!!senderClient.profile.phone && <div>{senderClient.profile.phone}</div>}
              {!!senderClient.profile.mobile && <div>{senderClient.profile.mobile}</div>}
              {!!senderClient.profile.identification && <div>ID: {senderClient.profile.identification}</div>}
              <div className="text-gray-500">
                {(senderClient.profile.addressLine || "").trim()} {(senderClient.profile.cityLabel || "").trim()}{" "}
                {(senderClient.profile.zipCode || "").trim()}
              </div>
            </div>
          )}
        </div>

        {/* Recipient */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Destinatario *</h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openEditBeneficiary}
                className="btn-outline text-sm flex items-center"
                disabled={!senderClientId || !beneficiaryPreview}
                title="Edit selected beneficiary"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit beneficiary
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!senderClientId) {
                    showToast("Select a sender first", "error");
                    return;
                  }
                  setShowAddBeneficiaryModal(true);
                }}
                className="btn-outline text-sm flex items-center"
                disabled={!senderClientId}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add beneficiary
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Beneficiary</label>
            <select
              className="input"
              value={beneficiaryIndex}
              onChange={(e) => setBeneficiaryIndex(Number(e.target.value))}
              disabled={!senderClient || !(senderClient.beneficiaries?.length > 0)}
            >
              {(senderClient?.beneficiaries || []).map((b, idx) => (
                <option key={idx} value={idx}>
                  #{idx + 1} — {displayPersonName(b)} {b.relationship ? `(${b.relationship})` : ""}
                </option>
              ))}
            </select>
          </div>

          {beneficiaryPreview ? (
            <div className="mt-4 text-sm text-gray-700 space-y-1">
              <div className="font-medium">{displayPersonName(beneficiaryPreview)}</div>
              {beneficiaryPreview.relationship && <div>{beneficiaryPreview.relationship}</div>}
              {beneficiaryPreview.phone && <div>{beneficiaryPreview.phone}</div>}
              {beneficiaryPreview.mobile && <div>{beneficiaryPreview.mobile}</div>}
              {beneficiaryPreview.email && <div>{beneficiaryPreview.email}</div>}
              {beneficiaryPreview.identification && <div>ID: {beneficiaryPreview.identification}</div>}
              {(beneficiaryPreview.addressLine || beneficiaryPreview.cityLabel || beneficiaryPreview.zipCode) && (
                <div className="text-gray-500">
                  {(beneficiaryPreview.addressLine || "").trim()} {(beneficiaryPreview.cityLabel || "").trim()}{" "}
                  {(beneficiaryPreview.zipCode || "").trim()}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">Select a sender with beneficiaries.</div>
          )}
        </div>
      </div>

      {/* Basic */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Básicos</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Agencia</label>
            <input className="input" value={agency} onChange={(e) => setAgency(e.target.value)} />
          </div>

          <div className="col-span-1">
            <label className="label">Partida Arancelaria</label>
            <input className="input" value={tariffHeading} onChange={(e) => setTariffHeading(e.target.value)} />
          </div>

          <div className="col-span-1">
            <label className="label">Observaciones</label>
            <input className="input" value={observations} onChange={(e) => setObservations(e.target.value)} />
          </div>
        </div>

        {/* Bitácora interna */}
        <div className="mt-4">
          <label className="label">Bitácora interna (comentarios)</label>
          <textarea
            className="input min-h-[90px]"
            value={internalComments}
            onChange={(e) => setInternalComments(e.target.value.slice(0, INTERNAL_COMMENTS_MAX))}
            placeholder="Notas internas para el equipo (no se muestran al cliente). Ej: validaciones, incidencias, acuerdos, etc."
          />
          <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
            <span>Solo uso interno.</span>
            <span>
              {internalComments.length}/{INTERNAL_COMMENTS_MAX}
            </span>
          </div>
        </div>
      </div>

      {/* Packages (Invoice) */}
      {/* Packages */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Paquetes *</h2>
          <span className="text-sm text-gray-500">{packages.length} paquete(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2">Descripción</th>
                <th className="py-2">Valor</th>
                <th className="py-2">L *</th>
                <th className="py-2">W *</th>
                <th className="py-2">H *</th>
                <th className="py-2">Wt *</th>
                <th className="py-2">Pcs</th>
                <th className="py-2">Vol *</th>
                <th className="py-2"></th>
              </tr>
            </thead>

            <tbody>
              {packages.map((p, idx) => {
                const vol = volumetricWeight(p);
                return (
                  <tr key={p.id} className="border-t">
                    <td className="py-2">
                      <input
                        className="input"
                        value={p.description}
                        onChange={(e) =>
                          setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, description: e.target.value } : x)))
                        }
                      />
                    </td>

                    <td className="py-2">
                      <input
                        className="input text-right"
                        type="number"
                        step="0.01"
                        value={p.value || ""}
                        onChange={(e) =>
                          setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, value: toNum(e.target.value) } : x)))
                        }
                      />
                    </td>

                    <td className="py-2">
                      <input className="input text-right" type="number" step="0.01" value={p.length || ""}
                        onChange={(e) => setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, length: toNum(e.target.value) } : x)))} />
                    </td>

                    <td className="py-2">
                      <input className="input text-right" type="number" step="0.01" value={p.width || ""}
                        onChange={(e) => setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, width: toNum(e.target.value) } : x)))} />
                    </td>

                    <td className="py-2">
                      <input className="input text-right" type="number" step="0.01" value={p.height || ""}
                        onChange={(e) => setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, height: toNum(e.target.value) } : x)))} />
                    </td>

                    <td className="py-2">
                      <input className="input text-right" type="number" step="0.01" value={p.weight || ""}
                        onChange={(e) => setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, weight: toNum(e.target.value) } : x)))} />
                    </td>

                    <td className="py-2">
                      <input className="input text-right" type="number" min={1} value={p.pcs || 1}
                        onChange={(e) => setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, pcs: Math.max(1, toNum(e.target.value)) } : x)))} />
                    </td>

                    <td className="py-2">
                      <input className="input bg-gray-100 text-right" value={vol.toFixed(2)} readOnly />
                    </td>

                    <td className="py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          className="px-2 py-1 border rounded"
                          onClick={() => setPackages((prev) => [...prev, { id: crypto.randomUUID(), description: "", value: 0, length: 0, width: 0, height: 0, weight: 0, pcs: 1 }])}
                          title="Agregar"
                        >
                          +
                        </button>

                        <button
                          type="button"
                          className="px-2 py-1 border rounded text-red-600 disabled:opacity-50"
                          disabled={packages.length === 1}
                          onClick={() => setPackages((prev) => prev.filter((x) => x.id !== p.id))}
                          title="Eliminar"
                        >
                          x
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 text-sm justify-end">
          <div>
            <span className="text-gray-500">Valor declarado (auto):</span>{" "}
            <span className="font-semibold">£{packagesDeclaredValue.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">Peso real:</span>{" "}
            <span className="font-semibold">{packagesTotalWeight.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">Peso a cobrar:</span>{" "}
            <span className="font-semibold">{packagesChargeableWeight.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Tariff */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tarifa</h2>

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="label">Asignar Tarifa *</label>
            <select className="input" value={tariffId} onChange={(e) => setTariffId(e.target.value)} disabled={loadingTariffs}>
              <option value="">Choose tariff...</option>
              {tariffs.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} {t.country ? `(${t.country})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Valor Medida (Peso) *</label>
            <input type="number" step="0.01" className="input" value={measureValue || ""} onChange={(e) => setMeasureValue(toNum(e.target.value || 0))} />
          </div>

          <div>
            <label className="label">Peso a Pagar</label>
            <input className="input bg-gray-100" value={measureValue ? measureValue.toFixed(2) : ""} readOnly />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <div>
            <label className="label">Monto Declarado</label>
            <input type="number" step="0.01" className="input" value={declaredValue || ""} onChange={(e) => setDeclaredValue(toNum(e.target.value || 0))} />
          </div>

          <div>
            <label className="label">Monto Asegurado</label>
            <input type="number" step="0.01" className="input" value={insuredAmount || ""} onChange={(e) => setInsuredAmount(toNum(e.target.value || 0))} />
          </div>

          <div>
            <label className="label">Seguro</label>
            <input type="number" step="0.01" className="input" value={insurance || ""} onChange={(e) => setInsurance(toNum(e.target.value || 0))} />
          </div>

          <div>
            <label className="label">Impuesto</label>
            <input type="number" step="0.01" className="input" value={tax || ""} onChange={(e) => setTax(toNum(e.target.value || 0))} />
          </div>

          <div>
            <label className="label">Descuento</label>
            <input type="number" step="0.01" className="input" value={discount || ""} onChange={(e) => setDiscount(toNum(e.target.value || 0))} />
          </div>

          <div>
            <label className="label">Comisión</label>
            <input type="number" step="0.01" className="input" value={commission || ""} onChange={(e) => setCommission(toNum(e.target.value || 0))} />
          </div>

          <div>
            <label className="label">Otros Cargos</label>
            <input type="number" step="0.01" className="input" value={otherCharges || ""} onChange={(e) => setOtherCharges(toNum(e.target.value || 0))} />
          </div>

          <div className="border rounded-md p-3 bg-gray-50">
            <div className="text-xs text-gray-500">Precio de Envío (por rango)</div>
            <div className="text-lg font-semibold">£{shippingPrice.toFixed(2)}</div>
            <div className="text-xs text-gray-400">Costo: £{shippingCost.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Servicios</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2">Incluir</th>
                <th className="py-2">Nombre</th>
                <th className="py-2">Medida</th>
                <th className="py-2">Precio</th>
                <th className="py-2">Cantidad</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => {
                const rowTotal = s.included ? toNum(s.price || 0) * toNum(s.quantity || 0) : 0;
                return (
                  <tr key={s.id} className="border-t">
                    <td className="py-3">
                      <input type="checkbox" checked={s.included} onChange={(e) => setServiceIncluded(s.id, e.target.checked)} />
                    </td>
                    <td className="py-3">
                      <input className="input" value={s.name} readOnly />
                    </td>
                    <td className="py-3">
                      <input className="input" value={s.measure} readOnly />
                    </td>
                    <td className="py-3">
                      <input
                        className="input text-right"
                        type="number"
                        step="0.01"
                        min={0}
                        value={toNum(s.price || 0)}
                        onChange={(e) => setServicePrice(s.id, toNum(e.target.value || 0))}
                      />
                    </td>
                    <td className="py-3">
                      <input
                        className="input text-right"
                        type="number"
                        min={0}
                        value={s.quantity}
                        disabled={!s.included}
                        onChange={(e) => setServiceQty(s.id, toNum(e.target.value || 0))}
                      />
                    </td>
                    <td className="py-3">
                      <input className="input bg-gray-100 text-right" value={rowTotal.toFixed(2)} readOnly />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end gap-6">
          <div className="text-sm">
            <span className="text-gray-500">Total Servicios:</span> <span className="font-semibold">£{servicesTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Totales</h2>

        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Envío (Tarifa)</span>
              <span className="font-medium">£{shippingPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Servicios</span>
              <span className="font-medium">£{servicesTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Seguro</span>
              <span className="font-medium">£{toNum(insurance || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Impuesto</span>
              <span className="font-medium">£{toNum(tax || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Otros</span>
              <span className="font-medium">£{toNum(otherCharges || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Comisión</span>
              <span className="font-medium">£{toNum(commission || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Descuento</span>
              <span className="font-medium">- £{toNum(discount || 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="border rounded-md p-4 bg-gray-50">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold">£{totalGuide.toFixed(2)}</div>
            <div className="text-xs text-gray-400 mt-1">(incluye comisión y descuento si aplican)</div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="btn-outline">
          Cancel
        </button>
        <button onClick={handleSaveGuide} className="btn-primary" disabled={saving}>
          {saving ? "Creating..." : "Create"}
        </button>
      </div>

      {/* ============ Create Client Modal ============ */}
      <Modal isOpen={showCreateClientModal} onClose={() => setShowCreateClientModal(false)} title="Create New Client" size="large">
        <form onSubmit={handleCreateClient} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Entity type</label>
                <select className="input" value={clientForm.profile.entityType} onChange={(e) => updateClientProfile({ entityType: e.target.value as EntityType })}>
                  <option value="PERSON">Person</option>
                  <option value="COMPANY">Company</option>
                </select>
              </div>

              {clientForm.profile.entityType === "PERSON" ? (
                <>
                  <div>
                    <label className="label">First name *</label>
                    <input className="input" value={clientForm.profile.firstName || ""} onChange={(e) => updateClientProfile({ firstName: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Last name *</label>
                    <input className="input" value={clientForm.profile.lastName || ""} onChange={(e) => updateClientProfile({ lastName: e.target.value })} />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="label">Company name *</label>
                  <input className="input" value={clientForm.profile.companyName || ""} onChange={(e) => updateClientProfile({ companyName: e.target.value })} />
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={clientForm.profile.email || ""} onChange={(e) => updateClientProfile({ email: e.target.value })} />
              </div>
              <div>
                <label className="label">Identification</label>
                <input className="input" value={clientForm.profile.identification || ""} onChange={(e) => updateClientProfile({ identification: e.target.value })} />
              </div>

              <div>
                <label className="label">Phone</label>
                <input className="input" value={clientForm.profile.phone || ""} onChange={(e) => updateClientProfile({ phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Mobile</label>
                <input className="input" value={clientForm.profile.mobile || ""} onChange={(e) => updateClientProfile({ mobile: e.target.value })} />
              </div>

              <div className="col-span-2">
                <label className="label">Address *</label>
                <textarea className="input min-h-[90px]" value={clientForm.profile.addressLine || ""} onChange={(e) => updateClientProfile({ addressLine: e.target.value })} />
              </div>

              <div>
                <label className="label">City</label>
                <select
                  className="input"
                  value={clientForm.profile.cityId || ""}
                  disabled={loadingCities}
                  onChange={(e) => {
                    const cityId = e.target.value;
                    setClientForm((p) => ({ ...p, profile: applyCitySelection(p.profile, cityId) }));
                  }}
                >
                  <option value="">Choose...</option>
                  {cities.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">ZIP Code</label>
                <input className="input" value={clientForm.profile.zipCode || ""} onChange={(e) => updateClientProfile({ zipCode: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Checkbox */}
          <div className="flex items-center gap-2">
            <input id="addBeneficiaryNow" type="checkbox" checked={addBeneficiaryNow} onChange={(e) => setAddBeneficiaryNow(e.target.checked)} />
            <label htmlFor="addBeneficiaryNow" className="text-sm text-gray-700">
              Add beneficiary now
            </label>
          </div>

          {addBeneficiaryNow && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Beneficiary</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Entity type</label>
                  <select className="input" value={clientForm.beneficiary.entityType} onChange={(e) => updateClientBeneficiary({ entityType: e.target.value as EntityType })}>
                    <option value="PERSON">Person</option>
                    <option value="COMPANY">Company</option>
                  </select>
                </div>

                {clientForm.beneficiary.entityType === "PERSON" ? (
                  <>
                    <div>
                      <label className="label">First name *</label>
                      <input className="input" value={clientForm.beneficiary.firstName || ""} onChange={(e) => updateClientBeneficiary({ firstName: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Last name *</label>
                      <input className="input" value={clientForm.beneficiary.lastName || ""} onChange={(e) => updateClientBeneficiary({ lastName: e.target.value })} />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="label">Company name *</label>
                    <input className="input" value={clientForm.beneficiary.companyName || ""} onChange={(e) => updateClientBeneficiary({ companyName: e.target.value })} />
                  </div>
                )}

                <div>
                  <label className="label">Relationship</label>
                  <input className="input" value={clientForm.beneficiary.relationship || ""} onChange={(e) => updateClientBeneficiary({ relationship: e.target.value })} />
                </div>

                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={clientForm.beneficiary.email || ""} onChange={(e) => updateClientBeneficiary({ email: e.target.value })} />
                </div>

                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={clientForm.beneficiary.phone || ""} onChange={(e) => updateClientBeneficiary({ phone: e.target.value })} />
                </div>

                <div>
                  <label className="label">Mobile</label>
                  <input className="input" value={clientForm.beneficiary.mobile || ""} onChange={(e) => updateClientBeneficiary({ mobile: e.target.value })} />
                </div>

                <div className="col-span-2">
                  <label className="label">Identification</label>
                  <input className="input" value={clientForm.beneficiary.identification || ""} onChange={(e) => updateClientBeneficiary({ identification: e.target.value })} />
                </div>

                <div className="col-span-2">
                  <label className="label">Address *</label>
                  <textarea className="input min-h-[90px]" value={clientForm.beneficiary.addressLine || ""} onChange={(e) => updateClientBeneficiary({ addressLine: e.target.value })} />
                </div>

                <div>
                  <label className="label">City</label>
                  <select
                    className="input"
                    value={clientForm.beneficiary.cityId || ""}
                    disabled={loadingCities}
                    onChange={(e) => {
                      const cityId = e.target.value;
                      setClientForm((p) => ({ ...p, beneficiary: applyCitySelection(p.beneficiary, cityId) }));
                    }}
                  >
                    <option value="">Choose...</option>
                    {cities.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">ZIP Code</label>
                  <input className="input" value={clientForm.beneficiary.zipCode || ""} onChange={(e) => updateClientBeneficiary({ zipCode: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowCreateClientModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={creatingClient} className="btn-primary">
              {creatingClient ? "Saving..." : "Create Client"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============ Edit Client Modal ============ */}
      <Modal isOpen={showEditClientModal} onClose={() => setShowEditClientModal(false)} title="Edit Client" size="large">
        <form onSubmit={handleUpdateClient} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Entity type</label>
                <select className="input" value={editClientForm.profile.entityType} onChange={(e) => updateEditClientProfile({ entityType: e.target.value as EntityType })}>
                  <option value="PERSON">Person</option>
                  <option value="COMPANY">Company</option>
                </select>
              </div>

              {editClientForm.profile.entityType === "PERSON" ? (
                <>
                  <div>
                    <label className="label">First name *</label>
                    <input className="input" value={editClientForm.profile.firstName || ""} onChange={(e) => updateEditClientProfile({ firstName: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Last name *</label>
                    <input className="input" value={editClientForm.profile.lastName || ""} onChange={(e) => updateEditClientProfile({ lastName: e.target.value })} />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="label">Company name *</label>
                  <input className="input" value={editClientForm.profile.companyName || ""} onChange={(e) => updateEditClientProfile({ companyName: e.target.value })} />
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={editClientForm.profile.email || ""} onChange={(e) => updateEditClientProfile({ email: e.target.value })} />
              </div>
              <div>
                <label className="label">Identification</label>
                <input className="input" value={editClientForm.profile.identification || ""} onChange={(e) => updateEditClientProfile({ identification: e.target.value })} />
              </div>

              <div>
                <label className="label">Phone</label>
                <input className="input" value={editClientForm.profile.phone || ""} onChange={(e) => updateEditClientProfile({ phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Mobile</label>
                <input className="input" value={editClientForm.profile.mobile || ""} onChange={(e) => updateEditClientProfile({ mobile: e.target.value })} />
              </div>

              <div className="col-span-2">
                <label className="label">Address *</label>
                <textarea className="input min-h-[90px]" value={editClientForm.profile.addressLine || ""} onChange={(e) => updateEditClientProfile({ addressLine: e.target.value })} />
              </div>

              <div>
                <label className="label">City</label>
                <select
                  className="input"
                  value={editClientForm.profile.cityId || ""}
                  disabled={loadingCities}
                  onChange={(e) => {
                    const cityId = e.target.value;
                    setEditClientForm((p) => ({ ...p, profile: applyCitySelection(p.profile, cityId) }));
                  }}
                >
                  <option value="">Choose...</option>
                  {cities.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">ZIP Code</label>
                <input className="input" value={editClientForm.profile.zipCode || ""} onChange={(e) => updateEditClientProfile({ zipCode: e.target.value })} />
              </div>

              <div className="mt-3 text-xs text-gray-500 col-span-2">
                * Nota: Los beneficiarios no se editan aquí. Para editar un beneficiario usa “Edit beneficiary”.
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowEditClientModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={updatingClient} className="btn-primary">
              {updatingClient ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============ Add Beneficiary Modal ============ */}
      <Modal isOpen={showAddBeneficiaryModal} onClose={() => setShowAddBeneficiaryModal(false)} title="Add Beneficiary" size="large">
        <form onSubmit={handleAddBeneficiaryToSender} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Entity type</label>
              <select className="input" value={beneficiaryForm.entityType} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, entityType: e.target.value as EntityType }))}>
                <option value="PERSON">Person</option>
                <option value="COMPANY">Company</option>
              </select>
            </div>

            {beneficiaryForm.entityType === "PERSON" ? (
              <>
                <div>
                  <label className="label">First name *</label>
                  <input className="input" value={beneficiaryForm.firstName || ""} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Last name *</label>
                  <input className="input" value={beneficiaryForm.lastName || ""} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, lastName: e.target.value }))} />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="label">Company name *</label>
                <input className="input" value={beneficiaryForm.companyName || ""} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, companyName: e.target.value }))} />
              </div>
            )}

            <div>
              <label className="label">Relationship</label>
              <input className="input" value={beneficiaryForm.relationship || ""} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, relationship: e.target.value }))} />
            </div>

            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={beneficiaryForm.email || ""} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, email: e.target.value }))} />
            </div>

            <div>
              <label className="label">Phone</label>
              <input className="input" value={beneficiaryForm.phone || ""} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>

            <div>
              <label className="label">Mobile</label>
              <input className="input" value={beneficiaryForm.mobile || ""} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, mobile: e.target.value }))} />
            </div>

            <div className="col-span-2">
              <label className="label">Identification</label>
              <input className="input" value={beneficiaryForm.identification || ""} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, identification: e.target.value }))} />
            </div>

            <div className="col-span-2">
              <label className="label">Address *</label>
              <textarea className="input min-h-[90px]" value={beneficiaryForm.addressLine || ""} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, addressLine: e.target.value }))} />
            </div>

            <div>
              <label className="label">City</label>
              <select
                className="input"
                value={beneficiaryForm.cityId || ""}
                disabled={loadingCities}
                onChange={(e) => {
                  const cityId = e.target.value;
                  setBeneficiaryForm((p) => applyCitySelection(p, cityId));
                }}
              >
                <option value="">Choose...</option>
                {cities.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">ZIP Code</label>
              <input className="input" value={beneficiaryForm.zipCode || ""} onChange={(e) => setBeneficiaryForm((p) => ({ ...p, zipCode: e.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowAddBeneficiaryModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={savingBeneficiary} className="btn-primary">
              {savingBeneficiary ? "Saving..." : "Add Beneficiary"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============ Edit Beneficiary Modal ============ */}
      <Modal isOpen={showEditBeneficiaryModal} onClose={() => setShowEditBeneficiaryModal(false)} title="Edit Beneficiary" size="large">
        <form onSubmit={handleUpdateBeneficiary} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Entity type</label>
              <select className="input" value={editBeneficiaryForm.entityType} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, entityType: e.target.value as EntityType }))}>
                <option value="PERSON">Person</option>
                <option value="COMPANY">Company</option>
              </select>
            </div>

            {editBeneficiaryForm.entityType === "PERSON" ? (
              <>
                <div>
                  <label className="label">First name *</label>
                  <input className="input" value={editBeneficiaryForm.firstName || ""} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Last name *</label>
                  <input className="input" value={editBeneficiaryForm.lastName || ""} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, lastName: e.target.value }))} />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="label">Company name *</label>
                <input className="input" value={editBeneficiaryForm.companyName || ""} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, companyName: e.target.value }))} />
              </div>
            )}

            <div>
              <label className="label">Relationship</label>
              <input className="input" value={editBeneficiaryForm.relationship || ""} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, relationship: e.target.value }))} />
            </div>

            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={editBeneficiaryForm.email || ""} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, email: e.target.value }))} />
            </div>

            <div>
              <label className="label">Phone</label>
              <input className="input" value={editBeneficiaryForm.phone || ""} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>

            <div>
              <label className="label">Mobile</label>
              <input className="input" value={editBeneficiaryForm.mobile || ""} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, mobile: e.target.value }))} />
            </div>

            <div className="col-span-2">
              <label className="label">Identification</label>
              <input className="input" value={editBeneficiaryForm.identification || ""} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, identification: e.target.value }))} />
            </div>

            <div className="col-span-2">
              <label className="label">Address *</label>
              <textarea className="input min-h-[90px]" value={editBeneficiaryForm.addressLine || ""} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, addressLine: e.target.value }))} />
            </div>

            <div>
              <label className="label">City</label>
              <select
                className="input"
                value={editBeneficiaryForm.cityId || ""}
                disabled={loadingCities}
                onChange={(e) => {
                  const cityId = e.target.value;
                  setEditBeneficiaryForm((p) => applyCitySelection(p, cityId));
                }}
              >
                <option value="">Choose...</option>
                {cities.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">ZIP Code</label>
              <input className="input" value={editBeneficiaryForm.zipCode || ""} onChange={(e) => setEditBeneficiaryForm((p) => ({ ...p, zipCode: e.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowEditBeneficiaryModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={updatingBeneficiary} className="btn-primary">
              {updatingBeneficiary ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}