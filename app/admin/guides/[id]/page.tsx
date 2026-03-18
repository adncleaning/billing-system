"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Api, useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  ChevronDown,
  Mail,
  MessageCircle,
  Printer,
  FileText,
  Tag,
  CheckSquare,
  Barcode,
  Package,
  User,
  MapPin,
  Calendar,
  Truck,
  StickyNote,
} from "lucide-react";

type UserRef = {
  _id?: string | null;
  username?: string;
  email?: string;
};

type GuidePackageItem = {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
};

type GuidePackage = {
  index: number;
  invoiceId?: string | null;
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
  items?: GuidePackageItem[];
};

type GuideService = {
  index: number;
  name: string;
  measure: string;
  price: number;
  quantity: number;
  included: boolean;
  total: number;
};

type GuideInternalNote = {
  index: number;
  comment: string;
  createdAt?: string | null;
  source?: string;
  createdBy?: UserRef | null;
};

type GuideStatusHistory = {
  index: number;
  fromStatus?: string;
  toStatus: string;
  comment?: string;
  changedAt?: string | null;
  changedBy?: UserRef | null;
};

type GuideSummary = {
  totalPackages: number;
  totalPieces: number;
  totalWeight: number;
  totalChargeableWeight: number;
  totalVolumetricWeight: number;
  totalDeclaredValue: number;

  measureValue: number;
  weightToPay: number;
  declaredValue: number;
  insuredAmount: number;
  insurance: number;
  tax: number;
  discount: number;
  commission: number;
  otherCharges: number;
  shippingPrice: number;
  shippingCost: number;
  servicesTotal: number;
  grandTotal: number;
};

type Guide = {
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

  locationStatus?: string;
  isProcessed?: boolean;
  shippingTypeLabel?: string;
  city?: string;

  senderName?: string;
  senderSecondary?: string;
  senderAddress?: string;
  senderCity?: string;

  recipientName?: string;
  recipientSecondary?: string;
  recipientAddress?: string;
  recipientCity?: string;

  beneficiary?: {
    name?: string;
    secondary?: string;
    addressLine?: string;
    cityLabel?: string;
    phone?: string;
    email?: string;
    identification?: string;
  } | null;

  tariffId?: {
    _id?: string;
    name?: string;
    country?: string;
    measure?: string;
    type?: string;
  } | null;

  packages?: GuidePackage[];
  services?: GuideService[];
  internalNotes?: GuideInternalNote[];
  statusHistory?: GuideStatusHistory[];
  summary?: GuideSummary;
};

type GuideResponse = {
  success: boolean;
  message?: string;
  guide?: Guide;
};

type CancelGuideResponse = {
  success: boolean;
  message?: string;
};

type BulkStatusResponse = {
  success: boolean;
  message?: string;
  updatedGuides?: number;
  newStatus?: string;
};

function formatDateTime(value?: string | null) {
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

function prettyUser(user?: UserRef | null) {
  if (!user) return "System";
  return user.username || user.email || user._id || "User";
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

function ActionDropdown({
  label,
  items,
}: {
  label: string;
  items: { label: string; onClick?: () => void }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <span>{label}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] border border-gray-200 bg-white shadow-lg">
            {items.map((item, idx) => (
              <button
                key={`${label}-${idx}`}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
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

export default function ShowGuidePage() {
  const router = useRouter();
  const params = useParams();
  const { token } = useAuth();

  const guideId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [guide, setGuide] = useState<Guide | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelComment, setCancelComment] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusValue, setStatusValue] = useState("");
  const [statusComment, setStatusComment] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const fetchGuide = async () => {
    try {
      setLoading(true);

      const res = (await Api("GET", `guides/${guideId}`, null, router)) as GuideResponse;

      if (!res?.success || !res?.guide) {
        throw new Error(res?.message || "Error loading guide");
      }

      setGuide(res.guide);
    } catch (error) {
      console.error(error);
      setGuide(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelGuide = async () => {
    try {
      if (!guide?._id) return;

      setCancelling(true);

      const res = await Api(
        "POST",
        `guides/${guide._id}/cancel`,
        { comment: cancelComment.trim() },
        router
      ) as CancelGuideResponse;

      if (!res?.success) {
        throw new Error(res?.message || "Error cancelling guide");
      }

      setCancelOpen(false);
      setCancelComment("");
      await fetchGuide();
    } catch (error: any) {
      console.error(error);
    } finally {
      setCancelling(false);
    }
  };

  const openStatusModal = () => {
    setStatusValue("");
    setStatusComment("");
    setStatusModalOpen(true);
  };

  const closeStatusModal = () => {
    if (savingStatus) return;
    setStatusModalOpen(false);
  };

  const handleUpdateGuideStatus = async () => {
    try {
      if (!guide?._id) return;

      if (!statusValue.trim()) {
        return;
      }

      setSavingStatus(true);

      const res = (await Api(
        "POST",
        "guides/bulk-status",
        {
          guideIds: [guide._id],
          newStatus: statusValue.trim(),
          comment: statusComment.trim(),
        },
        router
      )) as BulkStatusResponse;

      if (!res?.success) {
        throw new Error(res?.message || "Error updating guide status");
      }

      setStatusModalOpen(false);
      setStatusValue("");
      setStatusComment("");
      await fetchGuide();
    } catch (error: any) {
      console.error(error);
    } finally {
      setSavingStatus(false);
    }
  };

  useEffect(() => {
    if (token && guideId) {
      fetchGuide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, guideId]);

  const latestStatuses = useMemo(() => {
    if (!guide?.statusHistory?.length) return [];
    return [...guide.statusHistory].slice().reverse();
  }, [guide?.statusHistory]);

  const latestInternalNotes = useMemo(() => {
    if (!guide?.internalNotes?.length) return [];
    return [...guide.internalNotes].slice().reverse();
  }, [guide?.internalNotes]);

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
          type="button"
          onClick={() => router.push("/admin/guides")}
          className="mt-4 inline-flex items-center gap-2 border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="border border-gray-200 bg-white px-6 py-5">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 text-sm text-blue-600">
              Home / Guías / Mostrar Guía
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => router.push("/admin/guides")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <h1 className="text-3xl font-light text-gray-700">
                {guide.number || "—"}
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
            <ActionDropdown
              label="Mas Acciones"
              items={[
                {
                  label: "Actualizar",
                  onClick: () => router.push(`/admin/guides/${guide._id}/edit`),
                },
                {
                  label: "Anular",
                  onClick: () => setCancelOpen(true),
                },
              ]}
            />

            <ActionDropdown
              label="Estatus"
              items={[
                {
                  label: "Consolidar",
                  onClick: () => router.push(`/admin/consolidated/create`),
                },
                {
                  label: "Nuevo Estatus",
                  onClick: openStatusModal,
                },
                {
                  label: "Finalizar",
                  onClick: () => {
                    setStatusValue("COMPLETE");
                    setStatusComment("");
                    setStatusModalOpen(true);
                  },
                },
              ]}
            />

            <ActionDropdown
              label="Administración"
              items={[
                {
                  label: "Nueva Factura",
                  onClick: () => router.push(`/admin/bills/create?guideId=${guide._id}`),
                },
              ]}
            />

            <ActionDropdown
              label="Etiquetas"
              items={[
                { label: "Label_Ecuador" },
                { label: "guideDefault" },
              ]}
            />

            <button
              type="button"
              className="border border-gray-300 p-2 hover:bg-gray-50"
              title="Email"
            >
              <Mail className="h-4 w-4 text-gray-700" />
            </button>

            <button
              type="button"
              className="border border-gray-300 p-2 hover:bg-gray-50"
              title="WhatsApp"
            >
              <MessageCircle className="h-4 w-4 text-gray-700" />
            </button>

            <button
              type="button"
              className="border border-gray-300 p-2 hover:bg-gray-50"
              title="Print"
            >
              <Printer className="h-4 w-4 text-gray-700" />
            </button>

            <button
              type="button"
              className="border border-gray-300 p-2 hover:bg-gray-50"
              title="PDF"
            >
              <FileText className="h-4 w-4 text-gray-700" />
            </button>

            <button
              type="button"
              className="border border-gray-300 p-2 hover:bg-gray-50"
              title="Tag"
            >
              <Tag className="h-4 w-4 text-gray-700" />
            </button>

            <button
              type="button"
              className="border border-gray-300 p-2 hover:bg-gray-50"
              title="Check"
            >
              <CheckSquare className="h-4 w-4 text-gray-700" />
            </button>

            <button
              type="button"
              className="border border-gray-300 p-2 hover:bg-gray-50"
              title="Barcode"
            >
              <Barcode className="h-4 w-4 text-gray-700" />
            </button>

            <button
              type="button"
              onClick={() => router.push(`/admin/guides/${guide._id}/edit`)}
              className="ml-2 inline-flex items-center gap-2 border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Editar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 text-gray-400" />
              <span>
                <span className="font-medium">Agencia:</span> {guide.agency || "—"}
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
                {guide.recipientCity || guide.city || "—"}
              </span>
            </div>

            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 text-gray-400" />
              <span>
                <span className="font-medium">Tipo de envío:</span>{" "}
                {guide.shippingTypeLabel || "—"}
              </span>
            </div>

            <div className="flex items-start gap-2">
              <Package className="mt-0.5 h-4 w-4 text-gray-400" />
              <span>
                <span className="font-medium">Tarifa:</span>{" "}
                {guide.tariffId?.name || guide.tariffHeading || "—"}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-700">
            <InfoRow
              label="Paquetes iniciales:"
              value={guide.summary?.totalPackages ?? 0}
            />
            <InfoRow
              label="Piezas iniciales:"
              value={guide.summary?.totalPieces ?? 0}
            />
            <InfoRow
              label="Volumen inicial:"
              value={formatNumber(guide.summary?.totalVolumetricWeight)}
            />
            <InfoRow
              label="Peso inicial:"
              value={`${formatNumber(guide.summary?.totalWeight)} Kg`}
            />
            <InfoRow
              label="Peso a pagar:"
              value={`${formatNumber(guide.summary?.weightToPay)} Kg`}
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
              value={`$${formatMoney(guide.summary?.declaredValue)}`}
            />
            <InfoRow
              label="Seguro:"
              value={`$${formatMoney(guide.summary?.insurance)}`}
            />
            <InfoRow
              label="Impuesto:"
              value={`$${formatMoney(guide.summary?.tax)}`}
            />
            <InfoRow
              label="Total guía:"
              value={`$${formatMoney(guide.summary?.grandTotal)}`}
            />
          </div>
        </div>

        <div className="mt-5 border-t border-gray-200 pt-4 text-sm text-gray-700">
          <span className="font-medium">OBSERVACIONES:</span>{" "}
          {guide.observations || "—"}
        </div>
      </div>

      {/* Cargos */}
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
                <th className="px-3 py-2 font-medium">Otros Cargos</th>
                <th className="px-3 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 text-gray-700">
                <td className="px-3 py-3">
                  {guide.tariffId?.name || guide.tariffHeading || "—"}
                </td>
                <td className="px-3 py-3">
                  {formatNumber(guide.summary?.weightToPay || guide.summary?.measureValue)}
                </td>
                <td className="px-3 py-3">
                  {formatMoney(guide.summary?.shippingPrice)}
                </td>
                <td className="px-3 py-3">
                  {formatMoney(guide.summary?.insuredAmount)}
                </td>
                <td className="px-3 py-3">{formatMoney(guide.summary?.tax)}</td>
                <td className="px-3 py-3">
                  {formatMoney(guide.summary?.insurance)}
                </td>
                <td className="px-3 py-3">
                  {formatMoney(guide.summary?.discount)}
                </td>
                <td className="px-3 py-3">
                  {formatMoney(guide.summary?.otherCharges)}
                </td>
                <td className="px-3 py-3 font-semibold">
                  {formatMoney(guide.summary?.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Remitente / Destinatario */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Remitente">
          <div className="space-y-3 text-sm text-gray-700">
            <div className="font-semibold text-gray-900">
              {guide.senderName || "—"}
            </div>
            <div>{guide.senderAddress || "—"}</div>
            <div>{guide.senderCity || "—"}</div>
            <div>{guide.senderSecondary || "—"}</div>
          </div>
        </SectionCard>

        <SectionCard title="Destinatario">
          <div className="space-y-3 text-sm text-gray-700">
            <div className="font-semibold text-gray-900">
              {guide.recipientName || "—"}
            </div>
            <div>{guide.recipientAddress || "—"}</div>
            <div>{guide.recipientCity || "—"}</div>
            <div>{guide.recipientSecondary || "—"}</div>
          </div>
        </SectionCard>
      </div>

      {/* Paquetes */}
      <SectionCard title="Paquetes">
        {guide.packages?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Paquete</th>
                  <th className="px-3 py-2 font-medium">Tracking</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Volumen</th>
                  <th className="px-3 py-2 font-medium">Peso</th>
                  <th className="px-3 py-2 font-medium">P.Vol</th>
                  <th className="px-3 py-2 font-medium">Piezas</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {guide.packages.map((pkg, idx) => (
                  <tr key={idx} className="border-b border-gray-100 text-gray-700">
                    <td className="px-3 py-3">
                      <span className="inline-flex bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                        {guide.number || "—"}P{idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-3">{pkg.invoiceNumber || "N/A"}</td>
                    <td className="px-3 py-3">{formatMoney(pkg.amount)}</td>
                    <td className="px-3 py-3">
                      {formatNumber(pkg.volumetricWeight)}
                    </td>
                    <td className="px-3 py-3">{formatNumber(pkg.weight)}</td>
                    <td className="px-3 py-3">
                      {formatNumber(pkg.chargeableWeight)}
                    </td>
                    <td className="px-3 py-3">{pkg.pcs ?? 1}</td>
                    <td className="px-3 py-3">{pkg.description || "—"}</td>
                  </tr>
                ))}

                <tr className="bg-gray-50 text-gray-700">
                  <td className="px-3 py-3 font-medium" colSpan={3}>
                    Cantidad de Paquetes
                  </td>
                  <td className="px-3 py-3 font-medium">Volumen</td>
                  <td className="px-3 py-3 font-medium">Peso</td>
                  <td className="px-3 py-3 font-medium">P.Vol</td>
                  <td className="px-3 py-3 font-medium">Piezas</td>
                  <td className="px-3 py-3" />
                </tr>

                <tr className="border-t border-gray-200 text-gray-800">
                  <td className="px-3 py-3" colSpan={3}>
                    {guide.summary?.totalPackages ?? 0}
                  </td>
                  <td className="px-3 py-3">
                    {formatNumber(guide.summary?.totalVolumetricWeight)}
                  </td>
                  <td className="px-3 py-3">
                    {formatNumber(guide.summary?.totalWeight)}
                  </td>
                  <td className="px-3 py-3">
                    {formatNumber(guide.summary?.totalChargeableWeight)}
                  </td>
                  <td className="px-3 py-3">
                    {guide.summary?.totalPieces ?? 0}
                  </td>
                  <td className="px-3 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Guía no tiene paquetes registrados.</div>
        )}
      </SectionCard>

      {/* Documentos */}
      <SectionCard
        title={`Documentos: Guía ${guide.number || ""}`}
        right={
          <button
            type="button"
            className="bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
          >
            Agregar
          </button>
        }
      >
        <div className="py-8 text-center text-lg font-light text-gray-500">
          Guía NO tiene documentos anexos
        </div>
      </SectionCard>

      {/* Servicios */}
      <SectionCard title="Servicios">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-3 py-2 font-medium">Servicio</th>
                <th className="px-3 py-2 font-medium">Impuesto</th>
                <th className="px-3 py-2 font-medium">Flete</th>
                <th className="px-3 py-2 font-medium">Flete por Volumen</th>
                <th className="px-3 py-2 font-medium">Otros Cargos</th>
                <th className="px-3 py-2 font-medium">Descuento</th>
                <th className="px-3 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 text-gray-700">
                <td className="px-3 py-3">
                  {guide.services?.length
                    ? `${guide.services.length} servicio(s)`
                    : "Sin servicios"}
                </td>
                <td className="px-3 py-3">{formatMoney(guide.summary?.tax)}</td>
                <td className="px-3 py-3">
                  {formatMoney(guide.summary?.shippingPrice)}
                </td>
                <td className="px-3 py-3">0.00</td>
                <td className="px-3 py-3">
                  {formatMoney(guide.summary?.otherCharges)}
                </td>
                <td className="px-3 py-3">
                  {formatMoney(guide.summary?.discount)}
                </td>
                <td className="px-3 py-3 font-semibold">
                  {formatMoney(guide.summary?.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {!!guide.services?.length && (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Medida</th>
                  <th className="px-3 py-2 font-medium">Precio</th>
                  <th className="px-3 py-2 font-medium">Cantidad</th>
                  <th className="px-3 py-2 font-medium">Incluido</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {guide.services.map((service) => (
                  <tr
                    key={service.index}
                    className="border-b border-gray-100 text-gray-700"
                  >
                    <td className="px-3 py-3">{service.name}</td>
                    <td className="px-3 py-3">{service.measure}</td>
                    <td className="px-3 py-3">{formatMoney(service.price)}</td>
                    <td className="px-3 py-3">{service.quantity}</td>
                    <td className="px-3 py-3">{service.included ? "Sí" : "No"}</td>
                    <td className="px-3 py-3">{formatMoney(service.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Imágenes */}
      <SectionCard
        title={`Imágenes en Guía ${guide.number || ""}`}
        right={
          <button
            type="button"
            className="border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Subir imágenes
          </button>
        }
      >
        <div className="py-8 text-center text-lg font-light text-gray-500">
          Guía no tiene fotos anexas
        </div>
      </SectionCard>

      {/* Historial de estatus */}
      <SectionCard title={`Estatus para Guía ${guide.number || ""}`}>
        {latestStatuses.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Comentario</th>
                  <th className="px-3 py-2 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {latestStatuses.map((item) => (
                  <tr key={item.index} className="border-b border-gray-100 text-gray-700">
                    <td className="px-3 py-3">{formatDateTime(item.changedAt)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center border px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                          item.toStatus
                        )}`}
                      >
                        {item.toStatus || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">{item.comment || "—"}</td>
                    <td className="px-3 py-3">{prettyUser(item.changedBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Comentario</th>
                  <th className="px-3 py-2 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 text-gray-700">
                  <td className="px-3 py-3">{formatDateTime(guide.createdAt)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center border px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                        guide.status
                      )}`}
                    >
                      {guide.status || "CREATED"}
                    </span>
                  </td>
                  <td className="px-3 py-3">Guía creada</td>
                  <td className="px-3 py-3">System</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Bitácora interna */}
      <SectionCard title="Bitácora interna">
        {latestInternalNotes.length ? (
          <div className="space-y-3">
            {latestInternalNotes.map((note) => (
              <div
                key={note.index}
                className="border border-gray-200 bg-gray-50 p-4"
              >
                <div className="mb-2 flex flex-col gap-2 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    <span className="font-medium text-gray-700">
                      {prettyUser(note.createdBy)}
                    </span>
                    {note.source ? <span>• {note.source}</span> : null}
                  </div>

                  <div>{formatDateTime(note.createdAt)}</div>
                </div>

                <div className="whitespace-pre-wrap text-sm text-gray-800">
                  {note.comment}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Sin notas internas registradas.
          </div>
        )}
      </SectionCard>
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!cancelling) setCancelOpen(false);
            }}
          />

          <div className="relative w-full max-w-2xl overflow-hidden border border-gray-300 bg-white shadow-2xl">
            <div className="bg-blue-500 px-6 py-5">
              <h3 className="text-2xl font-light text-white">
                Confirmar la anulación de la Guía
              </h3>
            </div>

            <div className="p-8">
              <div className="mb-6">
                <label className="mb-2 block text-sm text-gray-500">
                  Agregar nota interna
                </label>
                <textarea
                  rows={4}
                  value={cancelComment}
                  onChange={(e) => setCancelComment(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="mb-8 border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-400">
                <span className="font-semibold text-red-600">Advertencia:</span>{" "}
                Los Paquetes contenidos en la Guía serán anulados
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCancelOpen(false)}
                    disabled={cancelling}
                    className="border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Cerrar
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelGuide}
                    disabled={cancelling}
                    className="bg-orange-600 px-5 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
                  >
                    {cancelling ? "Confirmando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeStatusModal}
          />

          <div className="relative bg-white w-full max-w-2xl rounded-xl shadow-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b shrink-0">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Actualizar estatus de la guía
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Selecciona el nuevo estatus y agrega un comentario para la bitácora interna.
                </p>
              </div>

              <button
                type="button"
                onClick={closeStatusModal}
                className="p-2 rounded hover:bg-gray-100"
                disabled={savingStatus}
                aria-label="Close"
              >
                <ChevronDown className="h-5 w-5 text-gray-600 rotate-45" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-2">
                    Guía seleccionada
                  </label>
                  <div className="input bg-gray-50">
                    {guide.number || "—"}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-2">
                    Nuevo estatus
                  </label>
                  <select
                    className="input"
                    value={statusValue}
                    onChange={(e) => setStatusValue(e.target.value)}
                    disabled={savingStatus}
                  >
                    <option value="">Seleccionar...</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  Comentario (Bitácora interna)
                </label>
                <textarea
                  className="input min-h-[110px]"
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  placeholder="Ej: Cambio validado por recepción en bodega."
                  disabled={savingStatus}
                />
                <div className="text-xs text-gray-400 mt-1">
                  Este comentario se guardará en el historial y en la bitácora interna.
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-50 text-xs text-gray-500 px-3 py-2">
                  <div className="col-span-2">Número</div>
                  <div className="col-span-3">Estatus actual</div>
                  <div className="col-span-3">Remitente</div>
                  <div className="col-span-3">Destinatario</div>
                  <div className="col-span-1">Fecha</div>
                </div>

                <div className="grid grid-cols-12 px-3 py-3 border-t text-sm items-center">
                  <div className="col-span-2 font-medium text-blue-700">
                    {guide.number || "—"}
                  </div>

                  <div className="col-span-3">
                    <span
                      className={`inline-flex items-center border px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                        guide.status
                      )}`}
                    >
                      {guide.status || "CREATED"}
                    </span>
                  </div>

                  <div className="col-span-3">
                    <div className="font-medium text-gray-900">
                      {guide.senderName || "—"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {guide.senderSecondary || " "}
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className="font-medium text-gray-900">
                      {guide.recipientName || "—"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {guide.recipientCity || guide.city || " "}
                    </div>
                  </div>

                  <div className="col-span-1 text-xs text-gray-600">
                    {guide.createdAt
                      ? new Date(guide.createdAt).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-white shrink-0">
              <button
                type="button"
                className="btn-outline"
                onClick={closeStatusModal}
                disabled={savingStatus}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={handleUpdateGuideStatus}
                disabled={savingStatus || !statusValue.trim()}
              >
                {savingStatus ? "Saving..." : "Actualizar estatus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}