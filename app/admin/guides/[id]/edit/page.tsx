"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Api, useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ArrowLeft, Save } from "lucide-react";

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
  invoiceId: string;
  description: string;
  amount: number;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
}

type InternalNote = {
  comment: string;
  createdAt?: string;
  createdBy?: { _id?: string; username?: string; email?: string } | string | null;
  source?: string;
};

interface Guide {
  _id: string;
  agency?: string;
  observations?: string;
  tariffHeading?: string;
  senderClient: Client;
  recipient: { index: number };
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

  // ✅ Bitácora interna (si el backend la devuelve)
  internalNotes?: InternalNote[];
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

  // ✅ Bitácora: nota nueva
  const [internalComment, setInternalComment] = useState<string>("");
  const INTERNAL_MAX = 1000;

  // Form state (lo necesario para update)
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

  // ========= Fetch initial =========
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
        measureValue: Number(g.measureValue || 0),
        declaredValue: Number(g.declaredValue || 0),
        insuredAmount: Number(g.insuredAmount || 0),
        insurance: g.insurance === undefined || g.insurance === null ? 10 : Number(g.insurance || 0),
        tax: Number(g.tax || 0),
        discount: Number(g.discount || 0),
        commission: Number(g.commission || 0),
        otherCharges: Number(g.otherCharges || 0),
        services: (g.services || []).map((s) => ({
          name: s.name,
          measure: s.measure || "Unit",
          price: Number(s.price || 0),
          quantity: Number(s.quantity || 0),
          included: !!s.included,
          total: Number(s.total || 0),
        })),
        invoiceIds: (g.packages || []).map((p) => p.invoiceId).filter(Boolean),
      });

      // ✅ limpiamos la nota nueva al cargar
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

  // ========= Derived helpers =========
  const selectedClient = useMemo(() => clients.find((c) => c._id === form.senderClientId), [clients, form.senderClientId]);

  const selectedTariff = useMemo(() => tariffs.find((t) => t._id === form.tariffId), [tariffs, form.tariffId]);

  // Auto tax: 19% del declaredValue
  useEffect(() => {
    const declared = Number(form.declaredValue || 0);
    const nextTax = Number((declared * 0.19).toFixed(2));
    setForm((prev) => ({ ...prev, tax: nextTax }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.declaredValue]);

  // Auto insurance default: si está 0, ponlo en 10 (solo una vez si venía vacío)
  useEffect(() => {
    setForm((prev) => {
      if (prev.insurance === 0) return { ...prev, insurance: 10 };
      return prev;
    });
  }, []);

  // ========= Services handlers =========
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

  // ========= Helpers bitácora =========
  const prettyUser = (createdBy: InternalNote["createdBy"]) => {
    if (!createdBy) return "System";
    if (typeof createdBy === "string") return createdBy;
    return createdBy.username || createdBy.email || createdBy._id || "User";
  };

  const prettyDate = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  };

  // ========= Save =========
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

      // ✅ Si hay nota nueva, la mandamos como internalComments
      if (note) payload.internalComments = note;

      const res: any = await Api("PUT", `guides/${guideId}`, payload, router);

      if (!res?.success) throw new Error(res?.message || "Error updating guide");

      showToast("Guide updated successfully", "success");
      setInternalComment("");
      router.push("/admin/guides");
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Error updating guide", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-6">
        <p className="text-sm text-gray-600">Loading guide...</p>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="card p-6">
        <p className="text-sm text-red-600">Guide not found.</p>
        <button className="btn-outline mt-4" onClick={() => router.push("/admin/guides")}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button type="button" className="btn-outline flex items-center" onClick={() => router.push("/admin/guides")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Guide</h1>
            <p className="text-gray-600 mt-1">Update guide information and charges.</p>
          </div>
        </div>

        <button type="button" onClick={handleUpdate} disabled={saving} className="btn-primary flex items-center">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {/* General */}
      <div className="card p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Agency</label>
            <input className="input" value={form.agency} onChange={(e) => setForm((p) => ({ ...p, agency: e.target.value }))} />
          </div>

          <div>
            <label className="label">Tariff heading</label>
            <input
              className="input"
              value={form.tariffHeading}
              onChange={(e) => setForm((p) => ({ ...p, tariffHeading: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="label">Observations</label>
          <textarea
            className="input"
            rows={3}
            value={form.observations}
            onChange={(e) => setForm((p) => ({ ...p, observations: e.target.value }))}
          />
        </div>
      </div>

      {/* ✅ Bitácora interna */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Bitácora interna</h3>
          <div className="text-xs text-gray-500">
            {internalComment.trim().length}/{INTERNAL_MAX}
          </div>
        </div>

        <div>
          <label className="label">Agregar comentario interno (no visible al cliente)</label>
          <textarea
            className="input"
            rows={3}
            value={internalComment}
            onChange={(e) => setInternalComment(e.target.value)}
            placeholder="Ej: Se ajustó el peso según verificación, pendiente de consolidado..."
          />
          <p className="text-xs text-gray-500 mt-2">
            Se guardará al presionar <b>Save changes</b>.
          </p>
        </div>

        <div className="border-t pt-4">
          <div className="text-sm font-medium text-gray-900 mb-2">Historial de notas</div>

          {(!guide.internalNotes || guide.internalNotes.length === 0) ? (
            <div className="text-sm text-gray-500">Sin notas internas registradas.</div>
          ) : (
            <div className="space-y-2">
              {(guide.internalNotes || [])
                .slice()
                .reverse()
                .map((n, idx) => (
                  <div key={idx} className="border rounded-md p-3 bg-gray-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">{prettyUser(n.createdBy)}</span>
                        {n.source ? <span className="text-gray-400"> • {n.source}</span> : null}
                      </div>
                      <div className="text-xs text-gray-500">{prettyDate(n.createdAt)}</div>
                    </div>
                    <div className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{n.comment}</div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Sender + Recipient */}
      <div className="card p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Sender (client)</label>
            <select
              className="input"
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

          <div>
            <label className="label">Recipient (beneficiary)</label>
            <select
              className="input"
              value={form.beneficiaryIndex}
              onChange={(e) => setForm((p) => ({ ...p, beneficiaryIndex: Number(e.target.value) }))}
              disabled={!selectedClient || !selectedClient.beneficiaries?.length}
            >
              {(selectedClient?.beneficiaries || []).map((b, idx) => (
                <option key={idx} value={idx}>
                  {`#${idx + 1} - ${b.name || "No name"}${b.relationship ? ` (${b.relationship})` : ""}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tariff + Weight */}
      <div className="card p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Tariff</label>
            <select className="input" value={form.tariffId} onChange={(e) => setForm((p) => ({ ...p, tariffId: e.target.value }))}>
              <option value="">Select tariff...</option>
              {tariffs.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedTariff && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedTariff.country || ""} {selectedTariff.type ? `• ${selectedTariff.type}` : ""}{" "}
                {selectedTariff.measure ? `• ${selectedTariff.measure}` : ""}
              </p>
            )}
          </div>

          <div>
            <label className="label">Weight / Measure value</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.measureValue}
              onChange={(e) => setForm((p) => ({ ...p, measureValue: Number(e.target.value || 0) }))}
            />
          </div>

          <div>
            <label className="label">Declared value</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.declaredValue}
              onChange={(e) => setForm((p) => ({ ...p, declaredValue: Number(e.target.value || 0) }))}
            />
          </div>
        </div>
      </div>

      {/* Charges */}
      <div className="card p-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Charges</h3>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Insurance (fixed)</label>
            <input type="number" className="input bg-gray-100" value={form.insurance} disabled readOnly />
          </div>

          <div>
            <label className="label">Tax (19% declared)</label>
            <input type="number" className="input bg-gray-100" value={form.tax} disabled readOnly />
          </div>

          <div>
            <label className="label">Insured amount</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.insuredAmount}
              onChange={(e) => setForm((p) => ({ ...p, insuredAmount: Number(e.target.value || 0) }))}
            />
          </div>

          <div>
            <label className="label">Discount</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.discount}
              onChange={(e) => setForm((p) => ({ ...p, discount: Number(e.target.value || 0) }))}
            />
          </div>

          <div>
            <label className="label">Commission</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.commission}
              onChange={(e) => setForm((p) => ({ ...p, commission: Number(e.target.value || 0) }))}
            />
          </div>

          <div>
            <label className="label">Other charges</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.otherCharges}
              onChange={(e) => setForm((p) => ({ ...p, otherCharges: Number(e.target.value || 0) }))}
            />
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="card p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Services</h3>

        {form.services.length === 0 ? (
          <p className="text-sm text-gray-500">No services configured in this guide.</p>
        ) : (
          <div className="space-y-2">
            {form.services.map((s, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-md p-2">
                <div className="col-span-4">
                  <label className="label">Name</label>
                  <input className="input" value={s.name} onChange={(e) => updateService(idx, { name: e.target.value })} />
                </div>

                <div className="col-span-2">
                  <label className="label">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={s.price}
                    onChange={(e) => updateService(idx, { price: Number(e.target.value || 0) })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="label">Qty</label>
                  <input
                    type="number"
                    className="input"
                    value={s.quantity}
                    onChange={(e) => updateService(idx, { quantity: Number(e.target.value || 0) })}
                  />
                </div>

                <div className="col-span-2 flex items-center mt-5">
                  <input type="checkbox" checked={s.included} onChange={(e) => updateService(idx, { included: e.target.checked })} />
                  <span className="ml-2 text-xs">Included</span>
                </div>

                <div className="col-span-2">
                  <label className="label">Total</label>
                  <div className="input bg-gray-100 text-gray-700">{Number(s.total || 0).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Packages (solo vista rápida) */}
      <div className="card p-6 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Packages</h3>
        <p className="text-xs text-gray-500">Aquí solo mostramos lo asociado. Si quieres que en edición también puedas cambiar invoices, lo agregamos.</p>

        {(guide.packages || []).length === 0 ? (
          <p className="text-sm text-gray-500">No packages linked.</p>
        ) : (
          <div className="space-y-2">
            {(guide.packages || []).map((p, idx) => (
              <div key={idx} className="border rounded-md p-3 bg-gray-50">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{p.description}</span>
                  <span className="text-sm font-semibold">£{Number(p.amount || 0).toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-600 mt-2">Items: {(p.items || []).length}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button className="btn-outline" onClick={() => router.push("/admin/guides")}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleUpdate} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}