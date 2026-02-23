"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Route as RouteIcon, RefreshCcw } from "lucide-react";

const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false });

type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

type Waypoint = {
  address?: string;
  lat: number;
  lng: number;
  code?: string;
  timeSlot?: "morning" | "afternoon" | "evening";
  isHQ?: boolean;
};

type OptimizeResult = {
  total?: {
    distance_km?: number;
    duration_human?: string;
    fuel_cost?: number;
  };
  normalizedStops?: Waypoint[];
  order?: number[];
  geometry?: LineStringGeometry;
  segmentBoundaries?: any[];
};

export default function RouteViewPage() {
  const router = useRouter();
  const params = useSearchParams();
  const dayKey = params.get("day") || "";

  const [route, setRoute] = useState<OptimizeResult | null>(null);
  const [meta, setMeta] = useState<{ createdAt?: number } | null>(null);

  useEffect(() => {
    if (!dayKey) return;

    const raw = sessionStorage.getItem(`route:${dayKey}`);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      setRoute(parsed.route || null);
      setMeta({ createdAt: parsed.createdAt });
    } catch {
      setRoute(null);
    }
  }, [dayKey]);

  const orderedStops = useMemo(() => {
    if (!route?.normalizedStops?.length || !route?.order?.length) return [];
    const stops = route.normalizedStops;
    const hqIndex = stops.findIndex((s) => s?.isHQ) >= 0 ? stops.findIndex((s) => s?.isHQ) : 0;

    // Orden único sin HQ repetido
    const seen = new Set<number>();
    const out: { idx: number; item: Waypoint }[] = [];

    for (const stopIdx of route.order) {
      if (stopIdx === hqIndex) continue;
      if (stopIdx < 0 || stopIdx >= stops.length) continue;
      if (seen.has(stopIdx)) continue;
      seen.add(stopIdx);
      out.push({ idx: stopIdx, item: stops[stopIdx] });
    }
    return out;
  }, [route]);

  if (!dayKey) {
    return (
      <div className="p-6">
        <button className="btn-outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </button>
        <div className="mt-4 text-sm text-gray-600">Falta el parámetro <b>day</b>.</div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="p-6 space-y-4">
        <button className="btn-outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </button>

        <div className="card p-5">
          <div className="font-semibold text-gray-900 flex items-center gap-2">
            <RouteIcon className="h-5 w-5" /> Ruta no encontrada
          </div>
          <div className="text-sm text-gray-600 mt-2">
            No hay datos guardados para <b>{dayKey}</b>. Genera la ruta desde el calendario y vuelve a entrar.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button className="btn-outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </button>

        <div className="flex-1">
          <div className="text-xs text-gray-500">Ruta del día</div>
          <div className="text-lg font-bold text-gray-900">{dayKey}</div>
          <div className="text-xs text-gray-600">
            {route.total?.distance_km != null ? `${route.total.distance_km.toFixed(1)} km` : ""}
            {route.total?.duration_human ? ` • ${route.total.duration_human}` : ""}
            {route.total?.fuel_cost != null ? ` • £${route.total.fuel_cost.toFixed(2)}` : ""}
            {meta?.createdAt ? ` • ${new Date(meta.createdAt).toLocaleString()}` : ""}
          </div>
        </div>

        <button
          className="btn-outline"
          onClick={() => {
            // recarga desde sessionStorage por si regeneraste
            const raw = sessionStorage.getItem(`route:${dayKey}`);
            if (!raw) return;
            try {
              const parsed = JSON.parse(raw);
              setRoute(parsed.route || null);
              setMeta({ createdAt: parsed.createdAt });
            } catch {}
          }}
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          Recargar
        </button>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="h-[70vh] min-h-[520px]">
            <RouteMap
              polyline={route.geometry}
              markers={route.normalizedStops || []}
              order={route.order || []}
              showLabels
            />
          </div>
        </div>

        {/* Stops list */}
        <div className="card p-4">
          <div className="font-semibold text-gray-900 mb-3">Paradas (orden)</div>

          <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
            {orderedStops.map((s, i) => (
              <div key={s.idx} className="rounded-lg border p-3 bg-white">
                <div className="text-xs font-bold text-blue-900">#{i + 1}</div>
                <div className="text-sm font-semibold">{s.item.code || "—"}</div>
                <div className="text-xs text-gray-600">{s.item.address || `${s.item.lat}, ${s.item.lng}`}</div>
              </div>
            ))}
            {orderedStops.length === 0 && (
              <div className="text-sm text-gray-600">No hay paradas para mostrar.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
