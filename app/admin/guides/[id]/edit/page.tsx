"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Api, useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  ArrowLeft,
  Save,
  User,
  MapPin,
  Calendar,
  Truck,
  Package,
  StickyNote,
} from "lucide-react";

interface Beneficiary {
  name?: string;
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
  measure?: string;
  type?: string;
  ranges: TariffRange[];
}

interface GuideService {
  name: string;
  measure?: string;
  price: number;
  quantity: number;
  included: boolean;
  total: number;
}

interface GuidePackage {
  invoiceId?: string;
  invoiceNumber?: string | null;
  description: string;
  amount: number;
  length?: number;
  width?: number;
  height?: number;
  weight?: number;
  pcs?: number;
  volumetricWeight?: number;
  chargeableWeight?: number;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
}

type InternalNote = {
  comment: string;
  createdAt?: string;
  createdBy?: { _id?: string; username?: string; email?: string } | string | null;
  source?: string;
};

interface GuideSummary {
  totalPackages?: number;
  totalPieces?: number;
  totalWeight?: number;
  totalChargeableWeight?: number;
  totalVolumetricWeight?: number;
  totalDeclaredValue?: number;
  measureValue?: number;
  weightToPay?: number;
  declaredValue?: number;
  insuredAmount?: number;
  insurance?: number;
  tax?: number;
  discount?: number;
  commission?: number;
  otherCharges?: number;
  shippingPrice?: number;
  shippingCost?: number;
  servicesTotal?: number;
  grandTotal?: number;
}

interface Guide {
  _id: string;
  guideNumber?: number;
  number?: string;
  isActive?: boolean;
  agency?: string;
  observations?: string;
  tariffHeading?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  shippingTypeLabel?: string;
  locationStatus?: string;
  senderName?: string;
  senderSecondary?: string;
  senderAddress?: string;
  senderCity?: string;
  recipientName?: string;
  recipientSecondary?: string;
  recipientAddress?: string;
  recipientCity?: string;

  senderClient: Client;
  recipient: {
    index: number;
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
    identification?: string;
    address?: string;
  };

  tariffId?: Tariff | null;
  measureValue?: number;
  declaredValue?: number;
  insuredAmount?: number;
  insurance?: number;
  tax?: number;
  discount?: number;
  commission?: number;
  otherCharges?: number;
  services?: GuideService[];
  packages?: GuidePackage[];
  internalNotes?: InternalNote[];
  summary?: GuideSummary;
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatMoney(value?: number | null) {
  return Number(value || 0).toFixed(2);
}

function formatNumber(value?: number | null) {
  return Number(value || 0).toFixed(2);
}

function prettyUser(createdBy: InternalNote["createdBy"]) {
  if (!createdBy) return "System";
  if (typeof createdBy === "string") return createdBy;
  return createdBy.username || createdBy.email || createdBy._id || "User";
}

function statusBadgeClass(status?: string) {
  const st = String(status || "CREATED").toUpperCase();

  if (["COMPLETE", "ENTREGADO", "FINALIZADO"].includes(st)) {
    return "bg-green-100 text-green-800 border-green-200";
  }

  if (["CANCELLED", "ANULADA", "REJECTED"].includes(st)) {
    return "bg-red-100 text-red-800 border-red-200";
  }

  if (
    ["PENDING", "EN_TRANSITO_INTERNACIONAL", "DESPACHADO", "EN_DISTRIBUCION"].includes(
      st
    )
  ) {
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  }

  return "bg-blue-100 text-blue-800 border-blue-200";
}

function SectionCard({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 className="text-[28px] font-light text-gray-600">{title}</h2>
        {right}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="min-w-[150px] text-gray-500">{label}</span>
      <div className="font-medium text-gray-800">{value ?? "—"}</div>
    </div>
  );
}

export default function EditGuidePage() {
  const router = useRouter();
  const params = useParams();
  const { token } = useAuth();
  const { showToast } = useToast();

  const guideId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [guide, setGuide] = useState<Guide | null>(null);

  const [internalComment, setInternalComment] = useState<string>("");
  const INTERNAL_MAX = 1000;

  const [form, setForm] = useState({
    agency: "",
    observations: "",
    tariffHeading: "",
    senderClientId: "",
    beneficiaryIndex: 0,
    tariffId: "",
    measureValue: 0,
    declaredValue: 0,
    insuredAmount: 0,
    insurance: 10,
    tax: 0,
    discount: 0,
    commission: 0,
    otherCharges: 0,
    services: [] as GuideService[],
    invoiceIds: [] as string[],
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [gRes, cRes, tRes] = (await Promise.all([
        Api("GET", `guides/${guideId}`, null, router),
        Api("GET", "clients", null, router),
        Api("GET", "tariffs", null, router),
      ])) as any[];

      if (!gRes?.success) throw new Error(gRes?.message || "Error loading guide");
      if (!cRes?.success) throw new Error(cRes?.message || "Error loading clients");
      if (!tRes?.success) throw new Error(tRes?.message || "Error loading tariffs");

      const g: Guide = gRes.guide;
      setGuide(g);
      setClients(cRes.clients || []);
      setTariffs(tRes.tariffs || []);

      setForm({
        agency: g.agency || "",
        observations: g.observations || "",
        tariffHeading: g.tariffHeading || "",
        senderClientId: g.senderClient?._id || "",
        beneficiaryIndex: g.recipient?.index ?? 0,
        tariffId: (g.tariffId as any)?._id || "",
        measureValue: Number(g.summary?.measureValue ?? g.measureValue ?? 0),
        declaredValue: Number(g.summary?.declaredValue ?? g.declaredValue ?? 0),
        insuredAmount: Number(g.summary?.insuredAmount ?? g.insuredAmount ?? 0),
        insurance:
          g.summary?.insurance === undefined || g.summary?.insurance === null
            ? g.insurance === undefined || g.insurance === null
              ? 10
              : Number(g.insurance || 0)
            : Number(g.summary.insurance || 0),
        tax: Number(g.summary?.tax ?? g.tax ?? 0),
        discount: Number(g.summary?.discount ?? g.discount ?? 0),
        commission: Number(g.summary?.commission ?? g.commission ?? 0),
        otherCharges: Number(g.summary?.otherCharges ?? g.otherCharges ?? 0),
        services: (g.services || []).map((s) => ({
          name: s.name,
          measure: s.measure || "Unit",
          price: Number(s.price || 0),
          quantity: Number(s.quantity || 0),
          included: !!s.included,
          total: Number(s.total || 0),
        })),
        invoiceIds: (g.packages || [])
          .map((p) => p.invoiceId)
          .filter(Boolean) as string[],
      });

      setInternalComment("");
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Error loading edit form", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && guideId) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, guideId]);

  const selectedClient = useMemo(
    () => clients.find((c) => c._id === form.senderClientId),
    [clients, form.senderClientId]
  );

  const selectedTariff = useMemo(
    () => tariffs.find((t) => t._id === form.tariffId),
    [tariffs, form.tariffId]
  );

  const selectedBeneficiary = useMemo(() => {
    if (!selectedClient?.beneficiaries?.length) return null;
    return selectedClient.beneficiaries[Number(form.beneficiaryIndex)] || null;
  }, [selectedClient, form.beneficiaryIndex]);

  const computedSummary = useMemo(() => {
    const shippingPrice =
      selectedTariff?.ranges?.find((r) => {
        const weight = Number(form.measureValue || 0);
        return weight >= Number(r.min || 0) && weight <= Number(r.max || 0);
      })?.price || 0;

    const servicesTotal = (form.services || []).reduce(
      (sum, s) => sum + Number(s.total || 0),
      0
    );

    const grandTotal =
      Number(shippingPrice || 0) +
      Number(form.insurance || 0) +
      Number(form.tax || 0) +
      Number(form.otherCharges || 0) +
      Number(servicesTotal || 0) -
      Number(form.discount || 0);

    return {
      shippingPrice: Number(shippingPrice || 0),
      servicesTotal,
      grandTotal,
    };
  }, [
    selectedTariff,
    form.measureValue,
    form.services,
    form.insurance,
    form.tax,
    form.otherCharges,
    form.discount,
  ]);

  useEffect(() => {
    const declared = Number(form.declaredValue || 0);
    const nextTax = Number((declared * 0.19).toFixed(2));
    setForm((prev) => ({ ...prev, tax: nextTax }));
  }, [form.declaredValue]);

  useEffect(() => {
    setForm((prev) => {
      if (prev.insurance === 0) return { ...prev, insurance: 10 };
      return prev;
    });
  }, []);

  const updateService = (index: number, patch: Partial<GuideService>) => {
    setForm((prev) => {
      const next = [...prev.services];
      const current = next[index];

      const merged: GuideService = { ...current, ...patch };

      const price = Number(merged.price || 0);
      const qty = Number(merged.quantity || 0);
      merged.total = merged.included ? price * qty : 0;

      next[index] = merged;
      return { ...prev, services: next };
    });
  };

  const handleUpdate = async () => {
    try {
      setSaving(true);

      const note = internalComment.trim();
      if (note.length > INTERNAL_MAX) {
        showToast(`Internal comment is too long (max ${INTERNAL_MAX})`, "error");
        return;
      }

      const payload: any = {
        agency: form.agency,
        observations: form.observations,
        tariffHeading: form.tariffHeading,
        senderClientId: form.senderClientId,
        beneficiaryIndex: form.beneficiaryIndex,
        tariffId: form.tariffId || null,
        measureValue: Number(form.measureValue || 0),
        declaredValue: Number(form.declaredValue || 0),
        insuredAmount: Number(form.insuredAmount || 0),
        insurance: Number(form.insurance || 0),
        tax: Number(form.tax || 0),
        discount: Number(form.discount || 0),
        commission: Number(form.commission || 0),
        otherCharges: Number(form.otherCharges || 0),
        services: form.services,
        invoiceIds: form.invoiceIds,
      };

      if (note) payload.internalComments = note;

      const res: any = await Api("PUT", `guides/${guideId}`, payload, router);

      if (!res?.success) throw new Error(res?.message || "Error updating guide");

      showToast("Guide updated successfully", "success");
      setInternalComment("");
      router.push(`/admin/guides/${guideId}`);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Error updating guide", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-600">Loading guide...</p>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="border border-gray-200 bg-white p-6">
        <p className="text-sm text-red-600">Guide not found.</p>
        <button
          className="mt-4 inline-flex items-center gap-2 border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          onClick={() => router.push("/admin/guides")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border border-gray-200 bg-white px-6 py-5">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 text-sm text-blue-600">
              Home / Guías / Editar Guía
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => router.push(`/admin/guides/${guideId}`)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <h1 className="text-3xl font-light text-gray-700">
                Editar {guide.number || "Guía"}
              </h1>

              {guide.isActive === false && (
                <span className="border border-gray-300 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                  INACTIVA
                </span>
              )}

              <span
                className={`inline-flex items-center border px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                  guide.status
                )}`}
              >
                {guide.status || "CREATED"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/admin/guides/${guideId}`)}
              className="border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving}
              className="inline-flex items-center gap-2 border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 text-gray-400" />
              <span>
                <span className="font-medium">Agencia:</span>{" "}
                {form.agency || "—"}
              </span>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-gray-400" />
              <span>
                <span className="font-medium">Fecha de creación:</span>{" "}
                {formatDateTime(guide.createdAt)}
              </span>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
              <span>
                <span className="font-medium">Ciudad destino:</span>{" "}
                {selectedBeneficiary?.address ||
                  guide.recipientCity ||
                  guide.recipientAddress ||
                  "—"}
              </span>
            </div>

            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 text-gray-400" />
              <span>
                <span className="font-medium">Tipo de envío:</span>{" "}
                {selectedTariff?.type || guide.shippingTypeLabel || "—"}
              </span>
            </div>

            <div className="flex items-start gap-2">
              <Package className="mt-0.5 h-4 w-4 text-gray-400" />
              <span>
                <span className="font-medium">Tarifa:</span>{" "}
                {selectedTariff?.name || guide.tariffId?.name || form.tariffHeading || "—"}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-700">
            <InfoRow
              label="Paquetes:"
              value={guide.summary?.totalPackages ?? guide.packages?.length ?? 0}
            />
            <InfoRow
              label="Piezas:"
              value={guide.summary?.totalPieces ?? 0}
            />
            <InfoRow
              label="Volumen:"
              value={formatNumber(guide.summary?.totalVolumetricWeight)}
            />
            <InfoRow
              label="Peso guía:"
              value={`${formatNumber(form.measureValue)} Kg`}
            />
            <InfoRow
              label="Ubicación:"
              value={guide.locationStatus || "—"}
            />
          </div>

          <div className="space-y-2 text-sm text-gray-700">
            <InfoRow label="Estado actual:" value={guide.status || "CREATED"} />
            <InfoRow
              label="Última actualización:"
              value={formatDateTime(guide.updatedAt)}
            />
            <InfoRow
              label="Declarado:"
              value={`$${formatMoney(form.declaredValue)}`}
            />
            <InfoRow
              label="Impuesto:"
              value={`$${formatMoney(form.tax)}`}
            />
            <InfoRow
              label="Total estimado:"
              value={`$${formatMoney(computedSummary.grandTotal)}`}
            />
          </div>
        </div>
      </div>

      <SectionCard title="Información General">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-gray-500">Agency</label>
            <input
              className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={form.agency}
              onChange={(e) => setForm((p) => ({ ...p, agency: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-500">Tariff heading</label>
            <input
              className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={form.tariffHeading}
              onChange={(e) =>
                setForm((p) => ({ ...p, tariffHeading: e.target.value }))
              }
            />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm text-gray-500">Observations</label>
            <textarea
              rows={4}
              className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={form.observations}
              onChange={(e) =>
                setForm((p) => ({ ...p, observations: e.target.value }))
              }
            />
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Remitente">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-gray-500">Sender (client)</label>
              <select
                className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={form.senderClientId}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    senderClientId: e.target.value,
                    beneficiaryIndex: 0,
                    invoiceIds: [],
                  }))
                }
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} - {c.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">
                {selectedClient?.name || guide.senderName || "—"}
              </div>
              <div>{selectedClient?.email || guide.senderSecondary || "—"}</div>
              <div>{selectedClient?.phone || "—"}</div>
              <div>
                {selectedClient?.address
                  ? [
                      selectedClient.address.street,
                      selectedClient.address.city,
                      selectedClient.address.state,
                      selectedClient.address.zipCode,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : guide.senderAddress || "—"}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Destinatario">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-gray-500">
                Recipient (beneficiary)
              </label>
              <select
                className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={form.beneficiaryIndex}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    beneficiaryIndex: Number(e.target.value),
                  }))
                }
                disabled={!selectedClient || !selectedClient.beneficiaries?.length}
              >
                {(selectedClient?.beneficiaries || []).map((b, idx) => (
                  <option key={idx} value={idx}>
                    {`#${idx + 1} - ${b.name || "No name"}${
                      b.relationship ? ` (${b.relationship})` : ""
                    }`}
                  </option>
                ))}
              </select>
            </div>

            <div className="border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">
                {selectedBeneficiary?.name || guide.recipientName || "—"}
              </div>
              <div>
                {selectedBeneficiary?.identification ||
                  selectedBeneficiary?.email ||
                  selectedBeneficiary?.phone ||
                  guide.recipientSecondary ||
                  "—"}
              </div>
              <div>{selectedBeneficiary?.phone || guide.recipient?.phone || "—"}</div>
              <div>{selectedBeneficiary?.address || guide.recipientAddress || "—"}</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Tarifa y Medidas">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm text-gray-500">Tariff</label>
            <select
              className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={form.tariffId}
              onChange={(e) => setForm((p) => ({ ...p, tariffId: e.target.value }))}
            >
              <option value="">Select tariff...</option>
              {tariffs.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedTariff && (
              <p className="mt-2 text-xs text-gray-500">
                {selectedTariff.country || ""}
                {selectedTariff.type ? ` • ${selectedTariff.type}` : ""}
                {selectedTariff.measure ? ` • ${selectedTariff.measure}` : ""}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-500">
              Weight / Measure value
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={form.measureValue}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  measureValue: Number(e.target.value || 0),
                }))
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-500">Declared value</label>
            <input
              type="number"
              step="0.01"
              className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={form.declaredValue}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  declaredValue: Number(e.target.value || 0),
                }))
              }
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Cargos a la Guía">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-3 py-2 font-medium">Tarifa</th>
                <th className="px-3 py-2 font-medium">Valor Medida</th>
                <th className="px-3 py-2 font-medium">Precio de Envío</th>
                <th className="px-3 py-2 font-medium">Monto Asegurado</th>
                <th className="px-3 py-2 font-medium">Impuesto</th>
                <th className="px-3 py-2 font-medium">Seguro</th>
                <th className="px-3 py-2 font-medium">Descuento</th>
                <th className="px-3 py-2 font-medium">Comisión</th>
                <th className="px-3 py-2 font-medium">Otros Cargos</th>
                <th className="px-3 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 text-gray-700">
                <td className="px-3 py-3">
                  {selectedTariff?.name || guide.tariffId?.name || "—"}
                </td>
                <td className="px-3 py-3">{formatNumber(form.measureValue)}</td>
                <td className="px-3 py-3">
                  {formatMoney(computedSummary.shippingPrice)}
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    step="0.01"
                    className="w-[110px] border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                    value={form.insuredAmount}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        insuredAmount: Number(e.target.value || 0),
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    className="w-[100px] border border-gray-200 bg-gray-100 px-2 py-1 text-sm text-gray-700"
                    value={form.tax}
                    disabled
                    readOnly
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    className="w-[100px] border border-gray-200 bg-gray-100 px-2 py-1 text-sm text-gray-700"
                    value={form.insurance}
                    disabled
                    readOnly
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    step="0.01"
                    className="w-[100px] border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                    value={form.discount}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        discount: Number(e.target.value || 0),
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    step="0.01"
                    className="w-[100px] border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                    value={form.commission}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        commission: Number(e.target.value || 0),
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    step="0.01"
                    className="w-[100px] border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                    value={form.otherCharges}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        otherCharges: Number(e.target.value || 0),
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-3 font-semibold">
                  {formatMoney(computedSummary.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Servicios">
        {form.services.length === 0 ? (
          <div className="text-sm text-gray-500">
            No services configured in this guide.
          </div>
        ) : (
          <div className="space-y-3">
            {form.services.map((s, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-3 border border-gray-200 bg-gray-50 p-4 lg:grid-cols-12"
              >
                <div className="lg:col-span-4">
                  <label className="mb-2 block text-sm text-gray-500">Name</label>
                  <input
                    className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    value={s.name}
                    onChange={(e) => updateService(idx, { name: e.target.value })}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm text-gray-500">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    value={s.price}
                    onChange={(e) =>
                      updateService(idx, { price: Number(e.target.value || 0) })
                    }
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm text-gray-500">Qty</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    value={s.quantity}
                    onChange={(e) =>
                      updateService(idx, { quantity: Number(e.target.value || 0) })
                    }
                  />
                </div>

                <div className="flex items-end lg:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={s.included}
                      onChange={(e) =>
                        updateService(idx, { included: e.target.checked })
                      }
                    />
                    Included
                  </label>
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm text-gray-500">Total</label>
                  <div className="border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                    {formatMoney(s.total)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Paquetes Asociados">
        {(guide.packages || []).length === 0 ? (
          <div className="text-sm text-gray-500">No packages linked.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium">Factura</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Peso</th>
                  <th className="px-3 py-2 font-medium">P.Vol</th>
                  <th className="px-3 py-2 font-medium">Items</th>
                </tr>
              </thead>
              <tbody>
                {(guide.packages || []).map((p, idx) => (
                  <tr key={idx} className="border-b border-gray-100 text-gray-700">
                    <td className="px-3 py-3">{p.description || "—"}</td>
                    <td className="px-3 py-3">{p.invoiceNumber || p.invoiceId || "—"}</td>
                    <td className="px-3 py-3">{formatMoney(p.amount)}</td>
                    <td className="px-3 py-3">{formatNumber(p.weight)}</td>
                    <td className="px-3 py-3">{formatNumber(p.chargeableWeight)}</td>
                    <td className="px-3 py-3">{p.items?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Bitácora interna"
        right={
          <div className="text-xs text-gray-500">
            {internalComment.trim().length}/{INTERNAL_MAX}
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm text-gray-500">
              Agregar comentario interno (no visible al cliente)
            </label>
            <textarea
              rows={4}
              className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={internalComment}
              onChange={(e) => setInternalComment(e.target.value)}
              placeholder="Ej: Se ajustó el peso según verificación, pendiente de consolidado..."
            />
            <p className="mt-2 text-xs text-gray-500">
              Se guardará al presionar <b>Save changes</b>.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="mb-3 text-sm font-medium text-gray-900">
              Historial de notas
            </div>

            {!guide.internalNotes || guide.internalNotes.length === 0 ? (
              <div className="text-sm text-gray-500">
                Sin notas internas registradas.
              </div>
            ) : (
              <div className="space-y-3">
                {(guide.internalNotes || [])
                  .slice()
                  .reverse()
                  .map((n, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="mb-2 flex flex-col gap-2 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2">
                          <StickyNote className="h-4 w-4" />
                          <span className="font-medium text-gray-700">
                            {prettyUser(n.createdBy)}
                          </span>
                          {n.source ? <span>• {n.source}</span> : null}
                        </div>

                        <div>{formatDateTime(n.createdAt)}</div>
                      </div>

                      <div className="whitespace-pre-wrap text-sm text-gray-800">
                        {n.comment}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end gap-3">
        <button
          className="border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          onClick={() => router.push(`/admin/guides/${guideId}`)}
        >
          Cancel
        </button>
        <button
          className="inline-flex items-center gap-2 border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          onClick={handleUpdate}
          disabled={saving}
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}