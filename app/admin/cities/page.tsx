"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Search, MapPin, Hash } from "lucide-react";

import Table from "@/components/Table";
import Modal from "@/components/Modal";
import { Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

// ---------------- Types ----------------
type CityItem = {
  _id: string;
  label: string; // "CIUDAD (DEP)"
  postalCode?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
};

type Column = {
  key: string;
  label: string;
  render?: (_: any, row: any) => React.ReactNode;
};

// ---------------- Helpers ----------------
function normalizeLabel(city: string, dept: string) {
  const c = (city || "").trim();
  const d = (dept || "").trim();
  if (!c) return "";
  if (!d) return c;
  return `${c} (${d})`;
}

// Parse "ACACIAS (Meta)" => { city:"ACACIAS", dept:"Meta" }
function parseLabel(label: string) {
  const s = (label || "").trim();
  const match = s.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (match) return { city: match[1].trim(), dept: match[2].trim() };
  return { city: s, dept: "" };
}

function postalToString(v: any) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (Number.isFinite(n)) return String(Math.trunc(n));
  return String(v);
}

export default function CitiesPage() {
  const router = useRouter();

  // ✅ tu toast context
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState<CityItem[]>([]);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CityItem | null>(null);

  const [form, setForm] = useState({
    city: "",
    dept: "",
    postalCode: "",
  });

  // ---------------- API ----------------
  const fetchCities = async () => {
    try {
      setLoading(true);

      const url = search?.trim()
        ? `cities?search=${encodeURIComponent(search.trim())}`
        : "cities";

      const data: any = await Api("GET", url, null, router);

      if (data?.success) setRows(data.cities || []);
      else setRows([]);
    } catch (err) {
      console.error(err);
      showToast("Error loading cities", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const createCity = async () => {
    const label = normalizeLabel(form.city, form.dept);
    if (!label) {
      showToast("City is required", "error");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        label,
        postalCode: form.postalCode ? form.postalCode.trim() : null,
      };

      const data: any = await Api("POST", "cities", payload, router);

      if (!data?.success) {
        showToast(data?.message || "Error creating city", "error");
        return;
      }

      showToast("City created", "success");
      setShowModal(false);
      setEditing(null);
      setForm({ city: "", dept: "", postalCode: "" });

      await fetchCities();
    } catch (err) {
      console.error(err);
      showToast("Error creating city", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateCity = async () => {
    if (!editing?._id) return;

    const label = normalizeLabel(form.city, form.dept);
    if (!label) {
      showToast("City is required", "error");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        label,
        postalCode: form.postalCode ? form.postalCode.trim() : null,
      };

      const data: any = await Api("PUT", `cities/${editing._id}`, payload, router);

      if (!data?.success) {
        showToast(data?.message || "Error updating city", "error");
        return;
      }

      showToast("City updated", "success");
      setShowModal(false);
      setEditing(null);
      setForm({ city: "", dept: "", postalCode: "" });

      await fetchCities();
    } catch (err) {
      console.error(err);
      showToast("Error updating city", "error");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI events ----------------
  const openCreate = () => {
    setEditing(null);
    setForm({ city: "", dept: "", postalCode: "" });
    setShowModal(true);
  };

  const openEdit = (row: CityItem) => {
    const { city, dept } = parseLabel(row.label || "");
    setEditing(row);
    setForm({
      city,
      dept,
      postalCode: postalToString(row.postalCode),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateCity();
    else await createCity();
  };

  // ---------------- Effects ----------------
  useEffect(() => {
    fetchCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // búsqueda “live” con debounce
  useEffect(() => {
    const t = setTimeout(() => {
      fetchCities();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ---------------- Columns ----------------
  const columns: Column[] = useMemo(
    () => [
      {
        key: "label",
        label: "City (Department)",
        render: (_: any, row: CityItem) => (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="font-medium">{row.label || "—"}</span>
          </div>
        ),
      },
      {
        key: "postalCode",
        label: "Postcode",
        render: (_: any, row: CityItem) => (
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-gray-400" />
            <span>{postalToString(row.postalCode) || "—"}</span>
          </div>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (_: any, row: CityItem) => (
          <button
            type="button"
            className="btn-outline text-sm py-1 px-3"
            onClick={() => openEdit(row)}
          >
            <span className="inline-flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit
            </span>
          </button>
        ),
      },
    ],
    // openEdit es estable aquí porque no depende de nada externo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.label || "").toLowerCase().includes(q));
  }, [rows, search]);

  // ---------------- Render ----------------
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cities & Postcodes</h1>
          <p className="text-sm text-gray-500">
            Manage city list and postcodes (format: <b>City (Department)</b>)
          </p>
        </div>

        <button className="btn-primary" onClick={openCreate}>
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add city
          </span>
        </button>
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div className="relative w-full md:max-w-md">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9"
              placeholder="Search city or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="text-sm text-gray-500">
            Total: <b>{filtered.length}</b>
          </div>
        </div>

        <Table columns={columns} data={filtered} loading={loading} emptyMessage="No cities found." />
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit city" : "Add city"}
        size="large"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="e.g. ACACIAS"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department (optional)</label>
              <input
                className="input"
                value={form.dept}
                onChange={(e) => setForm((p) => ({ ...p, dept: e.target.value }))}
                placeholder="e.g. Meta / ANT / N/STDER"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Postcode (optional)</label>
            <input
              className="input"
              value={form.postalCode}
              onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
              placeholder="e.g. 507001"
            />
            <p className="text-xs text-gray-500 mt-2">
              Saved as: <b>{normalizeLabel(form.city, form.dept) || "—"}</b>
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {editing ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
