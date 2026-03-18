"use client";

import { toNum } from "@/utils/guideHelpers";

type Props = {
  shippingPrice: number;
  servicesTotal: number;
  insurance: number;
  tax: number;
  otherCharges: number;
  commission: number;
  discount: number;
  totalGuide: number;
};

export default function TotalsSection({
  shippingPrice,
  servicesTotal,
  insurance,
  tax,
  otherCharges,
  commission,
  discount,
  totalGuide,
}: Props) {
  return (
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
          <div className="text-xs text-gray-400 mt-1">
            (incluye comisión y descuento si aplican)
          </div>
        </div>
      </div>
    </div>
  );
}