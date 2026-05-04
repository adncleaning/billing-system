"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Search,
  MapPin,
  Hash,
  Globe,
  Building2,
  Upload,
} from "lucide-react";

import Table from "@/components/Table";
import Modal from "@/components/Modal";
import { Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

type CityItem = {
  _id: string;
  label: string;
  country: string;
  department: string;
  city: string;
  postalCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Column = {
  key: string;
  label: string;
  render?: (_: any, row: any) => React.ReactNode;
};

const COUNTRY_OPTIONS = [
  "Colombia",
  "Ecuador",
  "Venezuela",
  "España",
  "Reino Unido",
];

function postalToString(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function buildLabel(city: string, department: string, country: string) {
  const c = (city || "").trim();
  const d = (department || "").trim();
  const p = (country || "").trim();

  if (c && d && p) return `${c} (${d}, ${p})`;
  if (c && d) return `${c} (${d})`;
  if (c && p) return `${c} (${p})`;
  return c;
}

export default function CitiesPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const [rows, setRows] = useState<CityItem[]>([]);
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CityItem | null>(null);

  const [form, setForm] = useState({
    country: "Colombia",
    department: "",
    city: "",
    postalCode: "",
  });

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
      showToast("Error loading locations", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const createCity = async () => {
    if (!form.country || !form.department.trim() || !form.city.trim()) {
      showToast("Country, department and city are required", "error");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        country: form.country,
        department: form.department.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode ? form.postalCode.trim() : null,
      };

      const data: any = await Api("POST", "cities", payload, router);

      if (!data?.success) {
        showToast(data?.message || "Error creating location", "error");
        return;
      }

      showToast("Location created", "success");

      setShowModal(false);
      setEditing(null);
      setForm({
        country: "Colombia",
        department: "",
        city: "",
        postalCode: "",
      });

      await fetchCities();
    } catch (err) {
      console.error(err);
      showToast("Error creating location", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateCity = async () => {
    if (!editing?._id) return;

    if (!form.country || !form.department.trim() || !form.city.trim()) {
      showToast("Country, department and city are required", "error");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        country: form.country,
        department: form.department.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode ? form.postalCode.trim() : null,
      };

      const data: any = await Api(
        "PUT",
        `cities/${editing._id}`,
        payload,
        router
      );

      if (!data?.success) {
        showToast(data?.message || "Error updating location", "error");
        return;
      }

      showToast("Location updated", "success");

      setShowModal(false);
      setEditing(null);
      setForm({
        country: "Colombia",
        department: "",
        city: "",
        postalCode: "",
      });

      await fetchCities();
    } catch (err) {
      console.error(err);
      showToast("Error updating location", "error");
    } finally {
      setLoading(false);
    }
  };

  const importExcel = async (file: File) => {
    try {
      setImporting(true);

      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        "https://api.adncleaningservices.co.uk/v1/api/";

      const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${cleanBaseUrl}cities/import`, {
        method: "POST",
        headers: {
          Authorization: `jwt ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Import failed");
      }

      const summary = data?.summary || {};

      showToast(
        `Import completed. Processed: ${summary.processed || 0}, errors: ${
          summary.errors || 0
        }`,
        "success"
      );

      await fetchCities();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "Error importing Excel", "error");
    } finally {
      setImporting(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      country: "Colombia",
      department: "",
      city: "",
      postalCode: "",
    });
    setShowModal(true);
  };

  const openEdit = (row: CityItem) => {
    setEditing(row);
    setForm({
      country: row.country || "Colombia",
      department: row.department || "",
      city: row.city || "",
      postalCode: postalToString(row.postalCode),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editing) await updateCity();
    else await createCity();
  };

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchCities();
    }, 350);

    return () => clearTimeout(t);
  }, [search]);

  const columns: Column[] = useMemo(
    () => [
      {
        key: "country",
        label: "Country",
        render: (_: any, row: CityItem) => (
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-400" />
            <span>{row.country || "—"}</span>
          </div>
        ),
      },
      {
        key: "department",
        label: "Department",
        render: (_: any, row: CityItem) => (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <span>{row.department || "—"}</span>
          </div>
        ),
      },
      {
        key: "city",
        label: "City",
        render: (_: any, row: CityItem) => (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="font-medium">{row.city || "—"}</span>
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
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((r) =>
      [r.label, r.country, r.department, r.city, r.postalCode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const fromRecord = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, filtered.length);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Countries, Departments, Cities & Postcodes
          </h1>
          <p className="text-sm text-gray-500">
            Manage locations by country, department, city and postcode.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="btn-outline cursor-pointer">
            <span className="inline-flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Import Excel"}
            </span>

            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (file) importExcel(file);

                e.currentTarget.value = "";
              }}
            />
          </label>

          <button className="btn-primary" onClick={openCreate}>
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add location
            </span>
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div className="relative w-full md:max-w-md">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9"
              placeholder="Search country, department, city or postcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="text-sm text-gray-500">
            Total: <b>{filtered.length}</b>
          </div>
        </div>

        <Table
          columns={columns}
          data={paginatedRows}
          loading={loading}
          emptyMessage="No locations found."
        />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-5">
          <div className="text-sm text-gray-500">
            Showing <b>{fromRecord}</b> to <b>{toRecord}</b> of{" "}
            <b>{filtered.length}</b> records
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              className="input w-24"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <button
              type="button"
              className="btn-outline px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>

            <span className="text-sm text-gray-600">
              Page <b>{page}</b> of <b>{totalPages}</b>
            </span>

            <button
              type="button"
              className="btn-outline px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit location" : "Add location"}
        size="large"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country *
              </label>

              <select
                className="input"
                value={form.country}
                onChange={(e) =>
                  setForm((p) => ({ ...p, country: e.target.value }))
                }
                required
              >
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department *
              </label>

              <input
                className="input"
                value={form.department}
                onChange={(e) =>
                  setForm((p) => ({ ...p, department: e.target.value }))
                }
                placeholder="e.g. Meta / Pichincha / Miranda / Madrid / England"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>

              <input
                className="input"
                value={form.city}
                onChange={(e) =>
                  setForm((p) => ({ ...p, city: e.target.value }))
                }
                placeholder="e.g. Acacías"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Postcode
              </label>

              <input
                className="input"
                value={form.postalCode}
                onChange={(e) =>
                  setForm((p) => ({ ...p, postalCode: e.target.value }))
                }
                placeholder="e.g. 507001 / SW1A 1AA"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mt-2">
              Saved as:{" "}
              <b>
                {buildLabel(form.city, form.department, form.country) || "—"}
              </b>
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setShowModal(false)}
            >
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