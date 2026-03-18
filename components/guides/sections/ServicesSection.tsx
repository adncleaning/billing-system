"use client";

import type { ServiceRow } from "@/types/guide";
import { toNum } from "@/utils/guideHelpers";

type Props = {
  services: ServiceRow[];
  setServiceIncluded: (id: string, included: boolean) => void;
  setServiceQty: (id: string, qty: number) => void;
  setServicePrice: (id: string, price: number) => void;
  servicesTotal: number;
};

export default function ServicesSection({
  services,
  setServiceIncluded,
  setServiceQty,
  setServicePrice,
  servicesTotal,
}: Props) {
  return (
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
          <span className="text-gray-500">Total Servicios:</span>{" "}
          <span className="font-semibold">£{servicesTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}