"use client";

import { useEffect, useRef } from "react";
import Head from "next/head";
import type { LatLngExpression } from "leaflet";

type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][]; // [lng, lat]
};

export type Waypoint = {
  address?: string;
  lat: number;
  lng: number;
  code?: string;
  timeSlot?: "morning" | "afternoon" | "evening";
  isHQ?: boolean; // ✅ soporta HQ desde backend
};

type LeafletMapProps = {
  polyline?: LineStringGeometry | null;
  markers?: Waypoint[];
  order?: number[];
  showLabels?: boolean;
};

export default function LeafletMap({
  polyline = null,
  markers = [],
  order = [],
  showLabels = true,
}: LeafletMapProps) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let L: any;

    const init = async () => {
      if (!mapDivRef.current) return;

      const leaflet = await import("leaflet");
      L = (leaflet as any).default || leaflet;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapRef.current) {
        mapRef.current = L.map(mapDivRef.current).setView([51.509, -0.118], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(mapRef.current);
      } else {
        // Limpia layers previos (markers y polylines)
        mapRef.current.eachLayer((layer: any) => {
          if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker) {
            mapRef.current.removeLayer(layer);
          }
        });
      }

      /**
       * ✅ Numeración correcta:
       * - 'order' viene del backend con índices contra normalizedStops (markers).
       * - Incluye HQ repetido muchas veces.
       * - Queremos números 1..N SOLO para paradas (no HQ).
       * - Si una parada se repite en 'order', NO renumerar.
       */

      // Detecta el índice de HQ (idealmente 0, pero lo detectamos por isHQ por seguridad)
      const hqIndex = (() => {
        const idx = markers.findIndex((m) => m?.isHQ);
        return idx >= 0 ? idx : 0;
      })();

      const orderIndex: Record<number, number> = {};
      let counter = 0;

      if (Array.isArray(order)) {
        order.forEach((stopIdx) => {
          // Ignora HQ (por retornos entre franjas)
          if (stopIdx === hqIndex) return;

          // Si el índice no existe en markers, ignóralo
          if (stopIdx < 0 || stopIdx >= markers.length) return;

          // Si ya está numerado, no renumerar
          if (orderIndex[stopIdx]) return;

          // Solo numerar si NO es HQ por bandera (doble seguridad)
          if (markers[stopIdx]?.isHQ) return;

          counter += 1;
          orderIndex[stopIdx] = counter;
        });
      }

      const boundsPoints: LatLngExpression[] = [];

      markers.forEach((m, idx) => {
        if (m?.lat && m?.lng) {
          const isHQ = !!m?.isHQ || idx === hqIndex;

          // ✅ número solo para paradas (no HQ)
          const number = !isHQ ? orderIndex[idx] || "" : "";

          // ✅ label: si es HQ, mostrar HQ; si no, postcode/code o primera parte del address
          const label = isHQ
            ? "HQ"
            : m.code
              ? m.code.toUpperCase()
              : (m.address || "").split(",")[0];

          // Si showLabels: texto junto al círculo
          // HQ solo muestra label (HQ) sin "(n)"
          const text = showLabels && label
            ? isHQ
              ? `${label}`
              : `${label}${number ? ` (${number})` : ""}`
            : "";

          const circleText = isHQ ? "HQ" : (number || "");

          const html = `
            <div style="display:flex; align-items:center; gap:6px;">
              <div style="
                width:28px;height:28px;border-radius:9999px;
                background:${isHQ ? "#111827" : "#2563EB"};
                color:#fff;display:flex;
                align-items:center;justify-content:center;
                font-weight:700;font-size:12px;border:2px solid white;
                box-shadow:0 1px 4px rgba(0,0,0,.25);
              ">${circleText}</div>
              ${
                text
                  ? `<div style="
                background:rgba(255,255,255,.9);
                border:1px solid #e5e7eb;
                border-radius:6px;
                padding:2px 6px;
                font-size:12px;
                color:#111827;
                box-shadow:0 1px 3px rgba(0,0,0,.12);
                white-space:nowrap;
              ">${text}</div>`
                  : ``
              }
            </div>
          `;

          const divIcon = L.divIcon({
            html,
            className: "",
            iconSize: [10, 10],
            iconAnchor: [0, 0],
          });

          L.marker([m.lat, m.lng], { icon: divIcon })
            .addTo(mapRef.current)
            .bindPopup(m.address || `${m.lat}, ${m.lng}`);

          boundsPoints.push([m.lat, m.lng]);
        }
      });

      // Polyline
      if (polyline?.type === "LineString" && Array.isArray(polyline.coordinates)) {
        const latlngs: LatLngExpression[] = polyline.coordinates.map(([lng, lat]) => [lat, lng]);
        L.polyline(latlngs, { weight: 4 }).addTo(mapRef.current);
        latlngs.forEach((pt) => boundsPoints.push(pt));
      }

      if (boundsPoints.length) {
        mapRef.current.fitBounds(boundsPoints, { padding: [24, 24] });
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(polyline), JSON.stringify(markers), JSON.stringify(order), showLabels]);

  return (
    <>
      <Head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </Head>
      <div ref={mapDivRef} className="w-full h-full" />
    </>
  );
}
