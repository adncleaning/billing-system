"use client";

import type React from "react";
import type { Invoice, InvoiceItem, InvoiceMode, PackageRow } from "@/types/guide";
import {
  packageChargeableWeight,
  toNum,
  volumetricWeight,
} from "@/utils/guideHelpers";

type Props = {
  packages: PackageRow[];
  setPackages: React.Dispatch<React.SetStateAction<PackageRow[]>>;
  packagesDeclaredValue: number;
  packagesTotalWeight: number;
  packagesChargeableWeight: number;

  availableInvoices: Invoice[];
  loadingAvailableInvoices: boolean;
  selectedInvoiceIds: string[];
  setSelectedInvoiceIds: React.Dispatch<React.SetStateAction<string[]>>;
  invoiceDetailCountry: InvoiceMode;
  setInvoiceDetailCountry: React.Dispatch<React.SetStateAction<InvoiceMode>>;
};

const emptyPackage = (): PackageRow => ({
  id: crypto.randomUUID(),
  invoiceId: null,
  description: "",
  value: 0,
  length: 0,
  width: 0,
  height: 0,
  weight: 0,
  pcs: 1,
  items: [],
});

export default function PackagesSection({
  packages,
  setPackages,
  packagesDeclaredValue,
  packagesTotalWeight,
  packagesChargeableWeight,
  availableInvoices,
  loadingAvailableInvoices,
  selectedInvoiceIds,
  setSelectedInvoiceIds,
  invoiceDetailCountry,
  setInvoiceDetailCountry,
}: Props) {
  const toggleInvoice = (invoiceId: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const addManualPackage = () => {
    setPackages((prev) => [...prev, emptyPackage()]);
  };

  const removePackage = (id: string) => {
    setPackages((prev) =>
      prev.length === 1 ? prev : prev.filter((x) => x.id !== id)
    );
  };

  const updatePackage = <K extends keyof PackageRow>(
    id: string,
    field: K,
    value: PackageRow[K]
  ) => {
    setPackages((prev) =>
      prev.map((pkg) => (pkg.id === id ? { ...pkg, [field]: value } : pkg))
    );
  };

  const buildPackagesForColombia = (invoices: Invoice[]): PackageRow[] => {
    return invoices.map((inv) => {
      const items = Array.isArray(inv.items) ? inv.items : [];

      const value = Number(
        items
          .reduce((sum, item) => sum + toNum(item?.total || 0), 0)
          .toFixed(2)
      );

      const description =
        items
          .map((item) => String(item?.description || "").trim())
          .filter(Boolean)
          .join(", ") || `Invoice ${inv.invoiceNumber}`;

      return {
        id: crypto.randomUUID(),
        invoiceId: inv._id,
        description,
        value,
        length: 0,
        width: 0,
        height: 0,
        weight: 0,
        pcs: 1,
        items,
      };
    });
  };

  const buildPackagesForEcuador = (invoices: Invoice[]): PackageRow[] => {
    return invoices.flatMap((inv) => {
      const items = Array.isArray(inv.items) ? inv.items : [];

      return items.map((item: InvoiceItem) => ({
        id: crypto.randomUUID(),
        invoiceId: inv._id,
        description:
          String(item?.description || "").trim() || `Invoice ${inv.invoiceNumber}`,
        value: Number(toNum(item?.total || 0).toFixed(2)),
        length: 0,
        width: 0,
        height: 0,
        weight: 0,
        pcs: Math.max(1, toNum(item?.quantity || 1)),
        items: [item],
      }));
    });
  };

  const loadSelectedInvoicesIntoPackages = () => {
    const selectedInvoices = availableInvoices.filter((inv) =>
      selectedInvoiceIds.includes(inv._id)
    );

    if (!selectedInvoices.length) return;

    const mappedPackages =
      invoiceDetailCountry === "COLOMBIA"
        ? buildPackagesForColombia(selectedInvoices)
        : buildPackagesForEcuador(selectedInvoices);

    setPackages((prev) => {
      const hasRealManualData = prev.some(
        (p) =>
          !p.invoiceId &&
          (
            p.description.trim() ||
            toNum(p.value) > 0 ||
            toNum(p.length) > 0 ||
            toNum(p.width) > 0 ||
            toNum(p.height) > 0 ||
            toNum(p.weight) > 0
          )
      );

      if (!hasRealManualData && prev.length === 1 && !prev[0].invoiceId) {
        const first = prev[0];
        const emptyLike =
          !first.description &&
          !first.value &&
          !first.length &&
          !first.width &&
          !first.height &&
          !first.weight &&
          (first.pcs === 1 || !first.pcs);

        if (emptyLike) {
          return mappedPackages.length ? mappedPackages : [emptyPackage()];
        }
      }

      return [...prev, ...mappedPackages];
    });
  };

  const clearInvoicePackages = () => {
    setPackages((prev) => {
      const manualPackages = prev.filter((p) => !p.invoiceId);
      return manualPackages.length ? manualPackages : [emptyPackage()];
    });
    setSelectedInvoiceIds([]);
  };

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Paquetes *</h2>
        <span className="text-sm text-gray-500">
          {packages.length} paquete(s)
        </span>
      </div>

      {/* Facturas disponibles */}
      <div className="border rounded-xl p-4 bg-gray-50 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Cargar detalle desde facturas
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Colombia: una sola línea por factura. Ecuador: detalle línea por línea.
            </p>
          </div>

          <div className="w-full md:w-60">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              País destino
            </label>
            <select
              className="input"
              value={invoiceDetailCountry}
              onChange={(e) =>
                setInvoiceDetailCountry(e.target.value as InvoiceMode)
              }
            >
              <option value="COLOMBIA">Colombia</option>
              <option value="ECUADOR">Ecuador</option>
            </select>
          </div>
        </div>

        {loadingAvailableInvoices ? (
          <div className="text-sm text-gray-500">Cargando facturas...</div>
        ) : !availableInvoices.length ? (
          <div className="text-sm text-gray-500">
            No hay facturas disponibles para este cliente.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {availableInvoices.map((inv) => (
              <label
                key={inv._id}
                className="flex items-start gap-3 border rounded-lg p-3 bg-white hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedInvoiceIds.includes(inv._id)}
                  onChange={() => toggleInvoice(inv._id)}
                  className="mt-1"
                />

                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-gray-900">
                    {inv.invoiceNumber} - £{toNum(inv.total).toFixed(2)}
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    {inv.itemsCount || inv.items?.length || 0} línea(s) · Valor declarado £
                    {toNum(
                      inv.totalDeclaredValue ??
                        (inv.items || []).reduce(
                          (sum, item) => sum + toNum(item.total),
                          0
                        )
                    ).toFixed(2)}
                  </div>

                  {inv.createdAt && (
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={() => setSelectedInvoiceIds([])}
            disabled={!selectedInvoiceIds.length}
          >
            Limpiar selección
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={clearInvoicePackages}
          >
            Limpiar paquetes de facturas
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={loadSelectedInvoicesIntoPackages}
            disabled={!selectedInvoiceIds.length}
          >
            Cargar facturas a paquetes
          </button>
        </div>
      </div>

      {/* Acciones manuales */}
      <div className="flex justify-end">
        <button
          type="button"
          className="btn-outline"
          onClick={addManualPackage}
        >
          + Agregar paquete manual
        </button>
      </div>

      {/* Tabla de paquetes */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-2">Factura</th>
              <th className="py-2 pr-2">Descripción</th>
              <th className="py-2 pr-2">Valor</th>
              <th className="py-2 pr-2">L *</th>
              <th className="py-2 pr-2">W *</th>
              <th className="py-2 pr-2">H *</th>
              <th className="py-2 pr-2">Wt *</th>
              <th className="py-2 pr-2">Pcs</th>
              <th className="py-2 pr-2">Vol *</th>
              <th className="py-2 pr-2">Cobrar</th>
              <th className="py-2"></th>
            </tr>
          </thead>

          <tbody>
            {packages.map((p) => {
              const vol = volumetricWeight(p);
              const chargeable = packageChargeableWeight(p);

              return (
                <tr key={p.id} className="border-t align-top">
                  <td className="py-2 pr-2 min-w-[120px]">
                    <div className="text-xs text-gray-600">
                      {p.invoiceId || "-"}
                    </div>
                  </td>

                  <td className="py-2 pr-2 min-w-[260px]">
                    <input
                      className="input"
                      value={p.description}
                      onChange={(e) =>
                        updatePackage(p.id, "description", e.target.value)
                      }
                    />

                    {Array.isArray(p.items) && p.items.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                        {p.items.map((item, idx) => (
                          <div key={idx} className="truncate">
                            {item.quantity} x {item.description} - £
                            {toNum(item.total).toFixed(2)}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="py-2 pr-2 min-w-[120px]">
                    <input
                      className="input text-right"
                      type="number"
                      step="0.01"
                      value={p.value || ""}
                      onChange={(e) =>
                        updatePackage(p.id, "value", toNum(e.target.value))
                      }
                    />
                  </td>

                  <td className="py-2 pr-2 min-w-[90px]">
                    <input
                      className="input text-right"
                      type="number"
                      step="0.01"
                      value={p.length || ""}
                      onChange={(e) =>
                        updatePackage(p.id, "length", toNum(e.target.value))
                      }
                    />
                  </td>

                  <td className="py-2 pr-2 min-w-[90px]">
                    <input
                      className="input text-right"
                      type="number"
                      step="0.01"
                      value={p.width || ""}
                      onChange={(e) =>
                        updatePackage(p.id, "width", toNum(e.target.value))
                      }
                    />
                  </td>

                  <td className="py-2 pr-2 min-w-[90px]">
                    <input
                      className="input text-right"
                      type="number"
                      step="0.01"
                      value={p.height || ""}
                      onChange={(e) =>
                        updatePackage(p.id, "height", toNum(e.target.value))
                      }
                    />
                  </td>

                  <td className="py-2 pr-2 min-w-[90px]">
                    <input
                      className="input text-right"
                      type="number"
                      step="0.01"
                      value={p.weight || ""}
                      onChange={(e) =>
                        updatePackage(p.id, "weight", toNum(e.target.value))
                      }
                    />
                  </td>

                  <td className="py-2 pr-2 min-w-[90px]">
                    <input
                      className="input text-right"
                      type="number"
                      min={1}
                      value={p.pcs || 1}
                      onChange={(e) =>
                        updatePackage(
                          p.id,
                          "pcs",
                          Math.max(1, toNum(e.target.value))
                        )
                      }
                    />
                  </td>

                  <td className="py-2 pr-2 min-w-[100px]">
                    <input
                      className="input bg-gray-100 text-right"
                      value={vol.toFixed(2)}
                      readOnly
                    />
                  </td>

                  <td className="py-2 pr-2 min-w-[100px]">
                    <input
                      className="input bg-gray-100 text-right"
                      value={chargeable.toFixed(2)}
                      readOnly
                    />
                  </td>

                  <td className="py-2">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        className="px-2 py-1 border rounded"
                        onClick={addManualPackage}
                        title="Agregar"
                      >
                        +
                      </button>

                      <button
                        type="button"
                        className="px-2 py-1 border rounded text-red-600 disabled:opacity-50"
                        disabled={packages.length === 1}
                        onClick={() => removePackage(p.id)}
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
          <span className="font-semibold">
            {packagesChargeableWeight.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}