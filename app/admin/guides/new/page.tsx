"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";

import { Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import Modal from "@/components/Modal";

interface Beneficiary {
    name: string;
    relationship?: string;
    phone?: string;
    email?: string;
    identification?: string;
    address?: string;
}

interface Client {
    _id: string;
    name: string;
    email: string;
    phone: string;
    identification?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
    };
    beneficiaries: Beneficiary[];
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

type InvoiceMode = "ECUADOR" | "COLOMBIA";

export default function CreateGuidePage() {
    const router = useRouter();
    const { showToast } = useToast();

    // ====== data base ======
    const [clients, setClients] = useState<Client[]>([]);
    const [tariffs, setTariffs] = useState<Tariff[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);

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

    // ====== Invoice Mode (Ecuador/Colombia) ======
    const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("ECUADOR");

    // ====== Pagination invoices ======
    const [invoicePage, setInvoicePage] = useState<number>(1);
    const INVOICE_PAGE_SIZE = 8;

    // ====== Create Client Modal (Sender) ======
    const [showCreateClientModal, setShowCreateClientModal] = useState(false);
    const [creatingClient, setCreatingClient] = useState(false);
    const [clientForm, setClientForm] = useState({
        name: "",
        email: "",
        phone: "",
        identification: "",
        address: { street: "", city: "", state: "", zipCode: "" },
        beneficiaries: [{ name: "", relationship: "", phone: "", email: "", identification: "", address: "" }] as Beneficiary[],
    });

    // ====== Add Beneficiary Modal (Recipient) ======
    const [showAddBeneficiaryModal, setShowAddBeneficiaryModal] = useState(false);
    const [savingBeneficiary, setSavingBeneficiary] = useState(false);
    const [beneficiaryForm, setBeneficiaryForm] = useState<Beneficiary>({
        name: "",
        relationship: "",
        phone: "",
        email: "",
        identification: "",
        address: "",
    });

    // ====== Saving guide ======
    const [saving, setSaving] = useState(false);

    // -------------------------
    // Tax calculation
    // -------------------------
    useEffect(() => {
        const dv = Number(declaredValue || 0);
        const calculatedTax = Number((dv * 0.19).toFixed(2));
        setTax(calculatedTax);
    }, [declaredValue]);

    // -------------------------
    // Fetch base data
    // -------------------------
    useEffect(() => {
        (async () => {
            try {
                const c: any = await Api("GET", "clients", null, router);
                if (c?.success) setClients(c.clients || []);
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
    }, [router, showToast]);

    // -------------------------
    // Load sender client detail
    // -------------------------
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
                    setSenderClient(data.client);
                    setBeneficiaryIndex(0);
                }
            } catch {
                showToast("Error loading client detail", "error");
            }
        })();
    }, [senderClientId, router, showToast]);

    // -------------------------
    // Load invoices for sender (ONLY available without guide)
    // -------------------------
    useEffect(() => {
        if (!senderClientId) return;

        setLoadingInvoices(true);
        (async () => {
            try {
                // Prefer backend filter
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
                // fallback: load all then filter
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

    // -------------------------
    // Selected invoice
    // -------------------------
    const selectedInvoice = useMemo(() => {
        return invoices.find((i) => i._id === selectedInvoiceId) || null;
    }, [invoices, selectedInvoiceId]);

    const invoiceLinesTotal = (inv: Invoice) =>
        Number((inv.items || []).reduce((sum, it) => sum + Number(it.total || 0), 0).toFixed(2));

    const invoiceColombiaParagraph = (inv: Invoice) => {
        const parts = (inv.items || [])
            .map((it) => {
                const desc = (it.description || "").trim();
                const qty = Number(it.quantity || 0);
                if (!desc) return "";
                return qty > 0 ? `${desc} (x${qty})` : desc;
            })
            .filter(Boolean);

        return parts.join(", ");
    };

    // Declared value changes depending on mode
    useEffect(() => {
        if (!selectedInvoice) return;

        // Siempre usa el total original de la invoice (independiente del modo)
        setDeclaredValue(Number(selectedInvoice.total || 0));
    }, [selectedInvoice]);

    // -------------------------
    // Calculate tariff by weight
    // -------------------------
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
                    setShippingPrice(Number(data.range?.price || 0));
                    setShippingCost(Number(data.range?.cost || 0));
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

    // -------------------------
    // Services totals
    // -------------------------
    const servicesTotal = useMemo(() => {
        return services.reduce((sum, s) => {
            if (!s.included) return sum;
            const qty = Number(s.quantity || 0);
            return sum + Number(s.price || 0) * qty;
        }, 0);
    }, [services]);

    const totalGuide = useMemo(() => {
        const base = Number(shippingPrice || 0);
        const extras =
            Number(insurance || 0) +
            Number(tax || 0) +
            Number(otherCharges || 0) +
            Number(commission || 0) -
            Number(discount || 0);

        return base + servicesTotal + extras;
    }, [shippingPrice, servicesTotal, insurance, tax, otherCharges, commission, discount]);

    // -------------------------
    // Filter clients
    // -------------------------
    const filteredClients = useMemo(() => {
        const t = senderSearch.toLowerCase().trim();
        if (!t) return clients;

        return clients.filter((c) => {
            return (
                c.name?.toLowerCase().includes(t) ||
                c.email?.toLowerCase().includes(t) ||
                c.phone?.toLowerCase().includes(t) ||
                c.identification?.toLowerCase().includes(t)
            );
        });
    }, [clients, senderSearch]);

    // -------------------------
    // Filter invoices + pagination
    // -------------------------
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

    // -------------------------
    // Create Client Modal helpers
    // -------------------------
    const updateClientField = (path: string, value: string) => {
        setClientForm((prev) => {
            const keys = path.split(".");
            const copy: any = { ...prev };
            let cur = copy;
            for (let i = 0; i < keys.length - 1; i++) {
                cur[keys[i]] = { ...cur[keys[i]] };
                cur = cur[keys[i]];
            }
            cur[keys[keys.length - 1]] = value;
            return copy;
        });
    };

    const updateBeneficiaryField = (index: number, field: keyof Beneficiary, value: string) => {
        setClientForm((prev) => {
            const list = [...prev.beneficiaries];
            list[index] = { ...list[index], [field]: value };
            return { ...prev, beneficiaries: list };
        });
    };

    const addBeneficiary = () => {
        setClientForm((prev) => ({
            ...prev,
            beneficiaries: [...prev.beneficiaries, { name: "", relationship: "", phone: "", email: "", identification: "", address: "" }],
        }));
    };

    const removeBeneficiary = (index: number) => {
        setClientForm((prev) => {
            if (prev.beneficiaries.length === 1) return prev;
            const list = prev.beneficiaries.filter((_, i) => i !== index);
            return { ...prev, beneficiaries: list };
        });
    };

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingClient(true);
        try {
            const payload = {
                name: clientForm.name,
                email: clientForm.email,
                phone: clientForm.phone,
                identification: clientForm.identification,
                address: clientForm.address,
                beneficiaries: clientForm.beneficiaries,
            };

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
            setClientForm({
                name: "",
                email: "",
                phone: "",
                identification: "",
                address: { street: "", city: "", state: "", zipCode: "" },
                beneficiaries: [{ name: "", relationship: "", phone: "", email: "", identification: "", address: "" }],
            });

            showToast("Client created successfully", "success");
        } catch (err: any) {
            showToast(err?.message || "Error creating client", "error");
        } finally {
            setCreatingClient(false);
        }
    };

    // -------------------------
    // Add Beneficiary to sender client
    // -------------------------
    const handleAddBeneficiaryToSender = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!senderClientId) {
            showToast("Select a sender first", "error");
            return;
        }
        if (!beneficiaryForm.name?.trim()) {
            showToast("Beneficiary name is required", "error");
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
                name: current.name,
                email: current.email,
                phone: current.phone,
                identification: current.identification,
                address: current.address,
                beneficiaries,
            };

            const updated: any = await Api("PUT", `clients/${senderClientId}`, payload, router);
            if (!updated?.success) {
                showToast(updated?.message || "Error adding beneficiary", "error");
                return;
            }

            // Refresh sender client
            const refreshed: any = await Api("GET", `clients/${senderClientId}`, null, router);
            if (refreshed?.success) {
                setSenderClient(refreshed.client);
                setBeneficiaryIndex(Math.max(0, (refreshed.client?.beneficiaries?.length || 1) - 1));
            }

            setBeneficiaryForm({ name: "", relationship: "", phone: "", email: "", identification: "", address: "" });
            setShowAddBeneficiaryModal(false);
            showToast("Beneficiary added successfully", "success");
        } catch (err: any) {
            showToast(err?.message || "Error adding beneficiary", "error");
        } finally {
            setSavingBeneficiary(false);
        }
    };

    // -------------------------
    // Save Guide
    // -------------------------
    const handleSaveGuide = async () => {
        try {
            if (!senderClientId) {
                showToast("Select a sender (client)", "error");
                return;
            }
            if (!senderClient?.beneficiaries?.length) {
                showToast("Sender has no beneficiaries. Add at least one.", "error");
                return;
            }
            if (!selectedInvoiceId) {
                showToast("Select an invoice (package) available without guide", "error");
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
                invoiceIds: [selectedInvoiceId],
                // opcional si quieres registrar la forma de presentación
                invoiceMode,
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

    // -------------------------
    // UI helpers
    // -------------------------
    const beneficiaryPreview = useMemo(() => {
        if (!senderClient?.beneficiaries?.length) return null;
        return senderClient.beneficiaries[beneficiaryIndex] || null;
    }, [senderClient, beneficiaryIndex]);

    const setServiceIncluded = (id: string, included: boolean) => {
        setServices((prev) =>
            prev.map((s) =>
                s.id === id ? { ...s, included, quantity: included ? Math.max(1, s.quantity) : 0 } : s,
            ),
        );
    };

    const setServiceQty = (id: string, qty: number) => {
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, quantity: Math.max(0, qty) } : s)));
    };

    const setServicePrice = (id: string, price: number) => {
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, price: Math.max(0, Number(price || 0)) } : s)));
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

                        <button
                            type="button"
                            onClick={() => setShowCreateClientModal(true)}
                            className="btn-outline text-sm flex items-center"
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Add client
                        </button>
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
                        <select
                            className="input"
                            value={senderClientId}
                            onChange={(e) => setSenderClientId(e.target.value)}
                            disabled={loadingClients}
                        >
                            <option value="">Choose...</option>
                            {filteredClients.map((c) => (
                                <option key={c._id} value={c._id}>
                                    {c.name} — {c.email}
                                </option>
                            ))}
                        </select>
                    </div>

                    {senderClient && (
                        <div className="mt-4 text-sm text-gray-700 space-y-1">
                            <div className="font-medium">{senderClient.name}</div>
                            <div>{senderClient.email}</div>
                            <div>{senderClient.phone}</div>
                            {senderClient.identification && <div>ID: {senderClient.identification}</div>}
                            <div className="text-gray-500">
                                {(senderClient.address?.street || "").trim()}{" "}
                                {(senderClient.address?.city || "").trim()}{" "}
                                {(senderClient.address?.state || "").trim()}{" "}
                                {(senderClient.address?.zipCode || "").trim()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Recipient */}
                <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Destinatario *</h2>

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
                                    #{idx + 1} — {b.name || "No name"} {b.relationship ? `(${b.relationship})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {beneficiaryPreview ? (
                        <div className="mt-4 text-sm text-gray-700 space-y-1">
                            <div className="font-medium">{beneficiaryPreview.name}</div>
                            {beneficiaryPreview.relationship && <div>{beneficiaryPreview.relationship}</div>}
                            {beneficiaryPreview.phone && <div>{beneficiaryPreview.phone}</div>}
                            {beneficiaryPreview.email && <div>{beneficiaryPreview.email}</div>}
                            {beneficiaryPreview.identification && <div>ID: {beneficiaryPreview.identification}</div>}
                            {beneficiaryPreview.address && <div className="text-gray-500">{beneficiaryPreview.address}</div>}
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
            </div>

            {/* Packages (Invoice) */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Paquetes (Invoice) *</h2>
                    <span className="text-sm text-gray-500">{filteredInvoices.length} available invoice(s)</span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                    <div className="relative w-full md:w-96">
                        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={invoiceSearch}
                            onChange={(e) => setInvoiceSearch(e.target.value)}
                            className="input pl-9"
                            placeholder="Search invoice by number, total, item..."
                            disabled={!senderClientId || loadingInvoices}
                        />
                    </div>

                    <select
                        className="input md:w-52"
                        value={invoiceMode}
                        onChange={(e) => setInvoiceMode(e.target.value as InvoiceMode)}
                        disabled={!senderClientId || loadingInvoices}
                    >
                        <option value="ECUADOR">Ecuador</option>
                        <option value="COLOMBIA">Colombia</option>
                    </select>
                </div>

                {!senderClientId ? (
                    <div className="text-sm text-gray-500">Select a sender to load invoices.</div>
                ) : loadingInvoices ? (
                    <div className="text-sm text-gray-500">Loading invoices...</div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="text-sm text-gray-500">No available invoices (without guide) for this client.</div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {paginatedInvoices.map((inv) => {
                                const shownTotal =
                                    invoiceMode === "COLOMBIA" ? invoiceLinesTotal(inv) : Number(inv.total || 0);

                                return (
                                    <label
                                        key={inv._id}
                                        className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer ${selectedInvoiceId === inv._id ? "border-blue-500 bg-blue-50" : "border-gray-200"
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="invoice"
                                            checked={selectedInvoiceId === inv._id}
                                            onChange={() => setSelectedInvoiceId(inv._id)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <div className="font-medium text-gray-900">Invoice {inv.invoiceNumber}</div>
                                                <div className="text-sm font-semibold">£{shownTotal.toFixed(2)}</div>
                                            </div>
                                            <div className="text-xs text-gray-500">{new Date(inv.createdAt).toLocaleDateString()}</div>

                                            <div className="text-xs text-gray-600 mt-2">
                                                {invoiceMode === "ECUADOR" ? (
                                                    <>
                                                        {(inv.items || []).slice(0, 2).map((it, idx) => (
                                                            <div key={idx}>• {it.description} (x{it.quantity})</div>
                                                        ))}
                                                        {(inv.items || []).length > 2 && (
                                                            <div className="text-gray-400">+ {(inv.items || []).length - 2} more</div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="text-gray-700">{invoiceColombiaParagraph(inv)}</div>
                                                )}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {filteredInvoices.length > INVOICE_PAGE_SIZE && (
                            <div className="flex items-center justify-between mt-4">
                                <button
                                    type="button"
                                    onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                                    disabled={invoicePage === 1}
                                    className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">
                                    Page {invoicePage} of {invoiceTotalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setInvoicePage((p) => Math.min(invoiceTotalPages, p + 1))}
                                    disabled={invoicePage === invoiceTotalPages}
                                    className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}

                        {/* Preview invoice details */}
                        {selectedInvoice && (
                            <div className="mt-6 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-900">Invoice items (detail)</h3>
                                    <div className="text-sm text-gray-600">
                                        Declared value auto:{" "}
                                        <span className="font-semibold">£{Number(declaredValue || 0).toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-500">
                                                <th className="py-2">Description</th>
                                                <th className="py-2">Qty</th>
                                                <th className="py-2">Unit</th>
                                                <th className="py-2">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoiceMode === "ECUADOR" ? (
                                                (selectedInvoice.items || []).map((it, idx) => (
                                                    <tr key={idx} className="border-t">
                                                        <td className="py-2">{it.description}</td>
                                                        <td className="py-2">{it.quantity}</td>
                                                        <td className="py-2">£{Number(it.unitPrice || 0).toFixed(2)}</td>
                                                        <td className="py-2 font-medium">£{Number(it.total || 0).toFixed(2)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr className="border-t">
                                                    <td className="py-2">{invoiceColombiaParagraph(selectedInvoice)}</td>
                                                    <td className="py-2">—</td>
                                                    <td className="py-2">—</td>
                                                    <td className="py-2 font-medium">£{invoiceLinesTotal(selectedInvoice).toFixed(2)}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Tariff */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Tarifa</h2>

                <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-2">
                        <label className="label">Asignar Tarifa *</label>
                        <select
                            className="input"
                            value={tariffId}
                            onChange={(e) => setTariffId(e.target.value)}
                            disabled={loadingTariffs}
                        >
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
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={measureValue || ""}
                            onChange={(e) => setMeasureValue(Number(e.target.value || 0))}
                        />
                    </div>

                    <div>
                        <label className="label">Peso a Pagar</label>
                        <input className="input bg-gray-100" value={measureValue ? measureValue.toFixed(2) : ""} readOnly />
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                        <label className="label">Monto Declarado</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={declaredValue || ""}
                            onChange={(e) => setDeclaredValue(Number(e.target.value || 0))}
                        />
                    </div>

                    <div>
                        <label className="label">Monto Asegurado</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={insuredAmount || ""}
                            onChange={(e) => setInsuredAmount(Number(e.target.value || 0))}
                        />
                    </div>

                    <div>
                        <label className="label">Seguro</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={insurance || ""}
                            onChange={(e) => setInsurance(Number(e.target.value || 0))}
                        />
                    </div>

                    <div>
                        <label className="label">Impuesto</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={tax || ""}
                            onChange={(e) => setTax(Number(e.target.value || 0))}
                        />
                    </div>

                    <div>
                        <label className="label">Descuento</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={discount || ""}
                            onChange={(e) => setDiscount(Number(e.target.value || 0))}
                        />
                    </div>

                    <div>
                        <label className="label">Comisión</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={commission || ""}
                            onChange={(e) => setCommission(Number(e.target.value || 0))}
                        />
                    </div>

                    <div>
                        <label className="label">Otros Cargos</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={otherCharges || ""}
                            onChange={(e) => setOtherCharges(Number(e.target.value || 0))}
                        />
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
                                const rowTotal = s.included ? Number(s.price || 0) * Number(s.quantity || 0) : 0;
                                return (
                                    <tr key={s.id} className="border-t">
                                        <td className="py-3">
                                            <input
                                                type="checkbox"
                                                checked={s.included}
                                                onChange={(e) => setServiceIncluded(s.id, e.target.checked)}
                                            />
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
                                                value={Number(s.price || 0)}
                                                onChange={(e) => setServicePrice(s.id, Number(e.target.value || 0))}
                                            // si lo quieres editable solo cuando esté incluido, descomenta:
                                            // disabled={!s.included}
                                            />
                                        </td>
                                        <td className="py-3">
                                            <input
                                                className="input text-right"
                                                type="number"
                                                min={0}
                                                value={s.quantity}
                                                disabled={!s.included}
                                                onChange={(e) => setServiceQty(s.id, Number(e.target.value || 0))}
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
                        <span className="text-gray-500">Total Servicios:</span>{" "}
                        <span className="font-semibold">£{servicesTotal.toFixed(2)}</span>
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
                            <span className="font-medium">£{Number(insurance || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Impuesto</span>
                            <span className="font-medium">£{Number(tax || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Otros</span>
                            <span className="font-medium">£{Number(otherCharges || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Comisión</span>
                            <span className="font-medium">£{Number(commission || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Descuento</span>
                            <span className="font-medium">- £{Number(discount || 0).toFixed(2)}</span>
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
            <Modal
                isOpen={showCreateClientModal}
                onClose={() => setShowCreateClientModal(false)}
                title="Create New Client"
                size="large"
            >
                <form onSubmit={handleCreateClient} className="space-y-6">
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Full Name *</label>
                                <input className="input" value={clientForm.name} onChange={(e) => updateClientField("name", e.target.value)} required />
                            </div>
                            <div>
                                <label className="label">Email *</label>
                                <input type="email" className="input" value={clientForm.email} onChange={(e) => updateClientField("email", e.target.value)} required />
                            </div>
                            <div>
                                <label className="label">Phone *</label>
                                <input className="input" value={clientForm.phone} onChange={(e) => updateClientField("phone", e.target.value)} required />
                            </div>
                            <div>
                                <label className="label">Identification *</label>
                                <input className="input" value={clientForm.identification} onChange={(e) => updateClientField("identification", e.target.value)} required />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="label">Street</label>
                                <input className="input" value={clientForm.address.street} onChange={(e) => updateClientField("address.street", e.target.value)} />
                            </div>
                            <div>
                                <label className="label">City</label>
                                <input className="input" value={clientForm.address.city} onChange={(e) => updateClientField("address.city", e.target.value)} />
                            </div>
                            <div>
                                <label className="label">State</label>
                                <input className="input" value={clientForm.address.state} onChange={(e) => updateClientField("address.state", e.target.value)} />
                            </div>
                            <div>
                                <label className="label">ZIP Code</label>
                                <input className="input" value={clientForm.address.zipCode} onChange={(e) => updateClientField("address.zipCode", e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Beneficiaries */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-medium text-gray-900">Beneficiaries</h3>
                            <button type="button" className="btn-outline text-sm flex items-center" onClick={addBeneficiary}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Beneficiary
                            </button>
                        </div>

                        <div className="space-y-3">
                            {clientForm.beneficiaries.map((b, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm font-semibold">Beneficiary #{idx + 1}</div>

                                        {clientForm.beneficiaries.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeBeneficiary(idx)}
                                                className="flex items-center text-xs text-red-600 hover:underline"
                                            >
                                                <Trash2 className="h-3 w-3 mr-1" />
                                                Remove
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="label">Name *</label>
                                            <input
                                                className="input"
                                                value={b.name || ""}
                                                onChange={(e) => updateBeneficiaryField(idx, "name", e.target.value)}
                                                required={idx === 0}
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Relationship</label>
                                            <input className="input" value={b.relationship || ""} onChange={(e) => updateBeneficiaryField(idx, "relationship", e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label">Phone</label>
                                            <input className="input" value={b.phone || ""} onChange={(e) => updateBeneficiaryField(idx, "phone", e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label">Email</label>
                                            <input type="email" className="input" value={b.email || ""} onChange={(e) => updateBeneficiaryField(idx, "email", e.target.value)} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="label">Identification</label>
                                            <input className="input" value={b.identification || ""} onChange={(e) => updateBeneficiaryField(idx, "identification", e.target.value)} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="label">Address</label>
                                            <input className="input" value={b.address || ""} onChange={(e) => updateBeneficiaryField(idx, "address", e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

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

            {/* ============ Add Beneficiary Modal ============ */}
            <Modal
                isOpen={showAddBeneficiaryModal}
                onClose={() => setShowAddBeneficiaryModal(false)}
                title="Add Beneficiary"
                size="large"
            >
                <form onSubmit={handleAddBeneficiaryToSender} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Name *</label>
                            <input
                                className="input"
                                value={beneficiaryForm.name || ""}
                                onChange={(e) => setBeneficiaryForm((p) => ({ ...p, name: e.target.value }))}
                                required
                            />
                        </div>

                        <div>
                            <label className="label">Relationship</label>
                            <input
                                className="input"
                                value={beneficiaryForm.relationship || ""}
                                onChange={(e) => setBeneficiaryForm((p) => ({ ...p, relationship: e.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="label">Phone</label>
                            <input
                                className="input"
                                value={beneficiaryForm.phone || ""}
                                onChange={(e) => setBeneficiaryForm((p) => ({ ...p, phone: e.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="label">Email</label>
                            <input
                                type="email"
                                className="input"
                                value={beneficiaryForm.email || ""}
                                onChange={(e) => setBeneficiaryForm((p) => ({ ...p, email: e.target.value }))}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="label">Identification</label>
                            <input
                                className="input"
                                value={beneficiaryForm.identification || ""}
                                onChange={(e) => setBeneficiaryForm((p) => ({ ...p, identification: e.target.value }))}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="label">Address</label>
                            <input
                                className="input"
                                value={beneficiaryForm.address || ""}
                                onChange={(e) => setBeneficiaryForm((p) => ({ ...p, address: e.target.value }))}
                            />
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
        </div>
    );
}
