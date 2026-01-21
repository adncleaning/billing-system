"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  FileText,
  Receipt,
  CreditCard,
  CheckCircle2,
} from "lucide-react";

type CollectionStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "EN_ROUTE"
  | "COLLECTED"
  | "AT_WAREHOUSE"
  | "GUIDE_CREATED"
  | "BILLED"
  | "PAID"
  | "COMPLETED"
  | "CANCELLED";

type Collection = {
  _id: string;
  client: { _id: string; name: string; phone?: string; email?: string };
  address: string;
  postcode: string;
  pickupAt: string;
  status: CollectionStatus;

  billId?: string;
  guideId?: string;
  paymentId?: string;
  notes?: string;
  createdAt?: string;
};

const STATUSES: { key: CollectionStatus; label: string }[] = [
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "EN_ROUTE", label: "En Route" },
  { key: "COLLECTED", label: "Collected" },
  { key: "AT_WAREHOUSE", label: "At Warehouse" },
  { key: "GUIDE_CREATED", label: "Guide Created" },
  { key: "BILLED", label: "Billed" },
  { key: "PAID", label: "Paid" },
  { key: "COMPLETED", label: "Complete" },
];

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString([], { weekday: "long", day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

function stepIndex(status: CollectionStatus) {
  const idx = STATUSES.findIndex((s) => s.key === status);
  return idx < 0 ? 0 : idx;
}

export default function CollectionDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [item, setItem] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // Endpoint sugerido: GET /collections/:id
      const data: any = await Api("GET", `collections/${id}`, null, router);
      setItem(data?.data || data?.collection || null);
    } catch (e: any) {
      showToast(e?.message || "Error loading collection", "error");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(next: CollectionStatus) {
    if (!item) return;
    setUpdating(true);
    try {
      // Endpoint sugerido: PATCH /collections/:id/status
      const data: any = await Api("PATCH", `collections/${item._id}/status`, { status: next }, router);
      const updated = data?.data || data?.collection || null;
      setItem(updated || { ...item, status: next });
      showToast("Status updated", "success");
    } catch (e: any) {
      showToast(e?.message || "Error updating status", "error");
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const dt = useMemo(() => (item ? fmtDateTime(item.pickupAt) : null), [item]);
  const activeIdx = useMemo(() => (item ? stepIndex(item.status) : 0), [item]);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  if (!item) return <div className="p-6 text-sm text-red-600">Collection not found</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Recolección para {item.client?.name || "—"}{" "}
            <span className="text-sm font-normal text-gray-500">ID {item._id}</span>
          </h1>
          <p className="text-gray-600 mt-2">{item.address} • {item.postcode}</p>
        </div>
        <button className="btn-outline" onClick={() => router.push("/admin/collections")}>
          Back
        </button>
      </div>

      {/* Status bar like 3rd image */}
      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-5 md:grid-cols-9 bg-gray-100">
          {STATUSES.map((s, idx) => {
            const active = idx === activeIdx;
            const done = idx < activeIdx;
            return (
              <button
                key={s.key}
                disabled={updating || s.key === "CANCELLED"}
                onClick={() => setStatus(s.key)}
                className={
                  "px-3 py-3 text-sm font-semibold border-r last:border-r-0 transition " +
                  (active ? "bg-[#0F2A73] text-white" : done ? "bg-white text-gray-800" : "bg-gray-100 text-gray-700 hover:bg-gray-200")
                }
                title={updating ? "Updating..." : "Set status"}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main layout like 3rd image */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: location + datetime + notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Location card */}
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <MapPin className="h-5 w-5 text-gray-500 mt-1" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">PICKUP LOCATION</div>
                  <div className="text-2xl font-bold">{item.address}</div>
                  <div className="text-gray-600">{item.postcode}</div>
                </div>
              </div>
              <button className="btn-outline">Edit address</button>
            </div>
          </div>

          {/* Date & time */}
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <CalendarIcon className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">DATE</div>
                  <div className="text-gray-700">{dt?.date}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">TIME</div>
                  <div className="text-gray-700">{dt?.time}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-outline">Cancel</button>
                <button className="btn-primary">Reschedule</button>
              </div>
            </div>
          </div>

          {/* Notes / details */}
          <div className="card p-6">
            <div className="text-sm font-semibold text-gray-900 mb-2">DETAILS</div>
            <div className="text-gray-700 whitespace-pre-wrap">
              {item.notes?.trim() ? item.notes : "No notes"}
            </div>
          </div>
        </div>

        {/* Right column: customer + “has bill/guide/payment” */}
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold text-gray-900">Customer</div>
                <div className="mt-2 text-gray-800 font-semibold">{item.client?.name || "—"}</div>
                <div className="text-gray-600 text-sm">{item.client?.phone || "—"}</div>
                <div className="text-gray-600 text-sm">{item.client?.email || "—"}</div>
              </div>
              <button className="btn-outline">Edit</button>
            </div>
          </div>

          {/* Indicators */}
          <div className="card p-6 space-y-3">
            <div className="text-lg font-bold text-gray-900">Linked</div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-semibold">Bill</div>
                  <div className="text-xs text-gray-500">{item.billId ? "Available" : "Not created"}</div>
                </div>
              </div>
              {item.billId ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <span className="text-xs text-gray-400">—</span>}
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-semibold">Guide</div>
                  <div className="text-xs text-gray-500">{item.guideId ? "Available" : "Not created"}</div>
                </div>
              </div>
              {item.guideId ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <span className="text-xs text-gray-400">—</span>}
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-semibold">Payment</div>
                  <div className="text-xs text-gray-500">{item.paymentId ? "Recorded" : "Not recorded"}</div>
                </div>
              </div>
              {item.paymentId ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <span className="text-xs text-gray-400">—</span>}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card p-6 space-y-3">
            <div className="text-lg font-bold text-gray-900">Actions</div>
            <button className="btn-primary w-full">Create Guide</button>
            <button className="btn-outline w-full">Create Bill</button>
            <button className="btn-outline w-full">Record Payment</button>
          </div>
        </div>
      </div>
    </div>
  );
}
