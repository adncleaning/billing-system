"use client";

import { useEffect, useMemo } from "react";
import type { Tariff, InvoiceMode } from "@/types/guide";
import { toNum } from "@/utils/guideHelpers";

type Props = {
  tariffs: Tariff[];
  loadingTariffs: boolean;
  selectedCountry: InvoiceMode | string;
  tariffId: string;
  setTariffId: (value: string) => void;
  measureValue: number;
  setMeasureValue: (value: number) => void;
  declaredValue: number;
  setDeclaredValue: (value: number) => void;
  insuredAmount: number;
  setInsuredAmount: (value: number) => void;
  insurance: number;
  setInsurance: (value: number) => void;
  tax: number;
  setTax: (value: number) => void;
  discount: number;
  setDiscount: (value: number) => void;
  commission: number;
  setCommission: (value: number) => void;
  otherCharges: number;
  setOtherCharges: (value: number) => void;
  shippingPrice: number;
  shippingCost: number;
};

export default function TariffSection({
  tariffs,
  loadingTariffs,
  selectedCountry,
  tariffId,
  setTariffId,
  measureValue,
  setMeasureValue,
  declaredValue,
  setDeclaredValue,
  insuredAmount,
  setInsuredAmount,
  insurance,
  setInsurance,
  tax,
  setTax,
  discount,
  setDiscount,
  commission,
  setCommission,
  otherCharges,
  setOtherCharges,
  shippingPrice,
  shippingCost,
}: Props) {
  const filteredTariffs = useMemo(() => {
    const country = String(selectedCountry || "").trim().toUpperCase();

    if (!country) return tariffs;

    return tariffs.filter(
      (t) => String(t.country || "").trim().toUpperCase() === country
    );
  }, [tariffs, selectedCountry]);

  useEffect(() => {
    if (!tariffId) return;

    const existsInFiltered = filteredTariffs.some((t) => t._id === tariffId);

    if (!existsInFiltered) {
      setTariffId("");
    }
  }, [filteredTariffs, tariffId, setTariffId]);

  return (
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
            <option value="">
              {selectedCountry
                ? `Choose tariff for ${selectedCountry}...`
                : "Choose tariff..."}
            </option>

            {filteredTariffs.map((t) => (
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
            onChange={(e) => setMeasureValue(toNum(e.target.value || 0))}
          />
        </div>

        <div>
          <label className="label">Peso a Pagar</label>
          <input
            className="input bg-gray-100"
            value={measureValue ? measureValue.toFixed(2) : ""}
            readOnly
          />
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
            onChange={(e) => setDeclaredValue(toNum(e.target.value || 0))}
          />
        </div>

        <div>
          <label className="label">Monto Asegurado</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={insuredAmount || ""}
            onChange={(e) => setInsuredAmount(toNum(e.target.value || 0))}
          />
        </div>

        <div>
          <label className="label">Seguro</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={insurance || ""}
            onChange={(e) => setInsurance(toNum(e.target.value || 0))}
          />
        </div>

        <div>
          <label className="label">Impuesto</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={tax || ""}
            onChange={(e) => setTax(toNum(e.target.value || 0))}
          />
        </div>

        <div>
          <label className="label">Descuento</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={discount || ""}
            onChange={(e) => setDiscount(toNum(e.target.value || 0))}
          />
        </div>

        <div>
          <label className="label">Comisión</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={commission || ""}
            onChange={(e) => setCommission(toNum(e.target.value || 0))}
          />
        </div>

        <div>
          <label className="label">Otros Cargos</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={otherCharges || ""}
            onChange={(e) => setOtherCharges(toNum(e.target.value || 0))}
          />
        </div>

        <div className="border rounded-md p-3 bg-gray-50">
          <div className="text-xs text-gray-500">Precio de Envío (por rango)</div>
          <div className="text-lg font-semibold">£{shippingPrice.toFixed(2)}</div>
          <div className="text-xs text-gray-400">Costo: £{shippingCost.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}