"use client";

import { useEffect, useState } from "react";
import { useAuth, Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useRouter } from "next/navigation";
import Table from "@/components/Table";
import Modal from "@/components/Modal";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface TariffRange {
    min: number;
    max: number;
    price: number;
    cost: number;
    applyDeclaredValue: boolean;
}

interface Tariff {
    _id: string;
    name: string;
    country: string;
    region: string;
    tariffType: "RANGE" | "FLAT_RANGE";
    shipmentType: string;
    measureUnit: string;
    isActive: boolean;
    ranges: TariffRange[];
    lowerLimit: number;
    upperLimit: number;
    baseCost: number;
    agencyProfit: number;
    visibleInCalculator: boolean;
    fixedPrice: boolean;
    weightMode: string;
    taxMode: string;
    taxPercent: number;
    extraAmount: number;
    extraLabel: string;
    insuranceType: string;
    scaleBase: number;
    scalePrice: number;
    createdAt: string;
}

interface TariffFormData
    extends Omit<
        Tariff,
        "_id" | "createdAt" | "ranges" | "isActive"
    > {
    ranges: TariffRange[];
    isActive: boolean;
}

export default function TariffsPage() {
    const { token } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();

    const [tariffs, setTariffs] = useState<Tariff[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState<TariffFormData>({
        name: "",
        country: "COLOMBIA",
        region: "Todas las ciudades de COLOMBIA",
        tariffType: "RANGE",
        shipmentType: "AEREO",
        measureUnit: "Kg",
        isActive: true,
        ranges: [
            { min: 0.01, max: 3, price: 21, cost: 28, applyDeclaredValue: false },
        ],
        lowerLimit: 0.01,
        upperLimit: 50,
        baseCost: 0,
        agencyProfit: 0,
        visibleInCalculator: true,
        fixedPrice: false,
        weightMode: "MAYOR",
        taxMode: "VALOR_DECLARADO",
        taxPercent: 0,
        extraAmount: 0,
        extraLabel: "",
        insuranceType: "ESCALABLE",
        scaleBase: 1000,
        scalePrice: 10,
    });

    const API_URL =
        process.env.NEXT_PUBLIC_API_URL ||
        "https://api.adncleaningservices.co.uk/v1/api/";

    const fetchTariffs = async () => {
        try {
            const data: any = await Api("GET", "tariffs", null, router);
            if (data.success) {
                setTariffs(data.tariffs);
                setCurrentPage(1);
            }
        } catch (e: any) {
            console.error(e);
            showToast("Error loading tariffs", "error");
        } finally {
            setLoading(false);
        }
    };

    const loadTariffForEdit = async (id: string) => {
        try {
            const data: any = await Api("GET", `tariffs/${id}`, null, router);
            if (!data.success) {
                showToast("Error loading tariff", "error");
                return;
            }
            const t: Tariff = data.tariff;
            setFormData({
                name: t.name,
                country: t.country,
                region: t.region,
                tariffType: t.tariffType,
                shipmentType: t.shipmentType,
                measureUnit: t.measureUnit,
                isActive: t.isActive,
                ranges: t.ranges || [],
                lowerLimit: t.lowerLimit,
                upperLimit: t.upperLimit,
                baseCost: t.baseCost,
                agencyProfit: t.agencyProfit,
                visibleInCalculator: t.visibleInCalculator,
                fixedPrice: t.fixedPrice,
                weightMode: t.weightMode,
                taxMode: t.taxMode,
                taxPercent: t.taxPercent,
                extraAmount: t.extraAmount,
                extraLabel: t.extraLabel,
                insuranceType: t.insuranceType,
                scaleBase: t.scaleBase,
                scalePrice: t.scalePrice,
            });
            setEditingId(id);
            setShowModal(true);
        } catch (e: any) {
            console.error(e);
            showToast("Error loading tariff", "error");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...formData };
            let data: any;
            if (editingId) {
                data = await Api("PUT", `tariffs/${editingId}`, payload, router);
            } else {
                data = await Api("POST", "tariffs", payload, router);
            }

            if (data.success) {
                showToast(
                    editingId ? "Tariff updated successfully" : "Tariff created successfully",
                    "success",
                );
                setShowModal(false);
                setEditingId(null);
                await fetchTariffs();
            } else {
                showToast(data.message || "Error saving tariff", "error");
            }
        } catch (e: any) {
            console.error(e);
            showToast(e.message || "Error saving tariff", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const addRange = () => {
        setFormData((prev) => ({
            ...prev,
            ranges: [
                ...prev.ranges,
                {
                    min: prev.ranges[prev.ranges.length - 1]?.max || 0,
                    max: (prev.ranges[prev.ranges.length - 1]?.max || 0) + 1,
                    price: 0,
                    cost: 0,
                    applyDeclaredValue: false,
                },
            ],
        }));
    };

    const updateRange = (
        index: number,
        field: keyof TariffRange,
        value: any,
    ) => {
        setFormData((prev) => {
            const ranges = [...prev.ranges];
            ranges[index] = { ...ranges[index], [field]: value };
            return { ...prev, ranges };
        });
    };

    const removeRange = (index: number) => {
        setFormData((prev) => {
            if (prev.ranges.length === 1) return prev;
            return {
                ...prev,
                ranges: prev.ranges.filter((_, i) => i !== index),
            };
        });
    };

    const updateField = (field: keyof TariffFormData, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        if (token) {
            fetchTariffs();
        }
    }, [token]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // ==== filtro + paginación ====
    const filteredTariffs = tariffs.filter((t) => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return true;

        return (
            t.name.toLowerCase().includes(term) ||
            t.country.toLowerCase().includes(term) ||
            t.region.toLowerCase().includes(term) ||
            t.shipmentType.toLowerCase().includes(term)
        );
    });

    const totalPages = Math.max(
        1,
        Math.ceil(filteredTariffs.length / PAGE_SIZE),
    );

    const paginatedTariffs = filteredTariffs.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
    );

    const columns = [
        { key: "name", label: "Name" },
        { key: "country", label: "Country" },
        { key: "region", label: "Region" },
        {
            key: "shipmentType",
            label: "Type",
            render: (value: string) => value.toLowerCase(),
        },
        {
            key: "isActive",
            label: "Status",
            render: (value: boolean) => (
                <span
                    className={`px-2 py-1 text-xs rounded-full ${value ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                        }`}
                >
                    {value ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            key: "createdAt",
            label: "Created",
            render: (value: string) => new Date(value).toLocaleDateString(),
        },
        {
            key: "actions",
            label: "Actions",
            render: (_: any, row: Tariff) => (
                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={() => loadTariffForEdit(row._id)}
                        className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600"
                        title="Edit tariff"
                    >
                        <Pencil className="h-4 w-4" />
                    </button>
                    {/* Soft delete = inactivar */}
                    <button
                        type="button"
                        onClick={async () => {
                            if (!confirm("Disable this tariff?")) return;
                            await Api("DELETE", `tariffs/${row._id}`, null, router);
                            fetchTariffs();
                        }}
                        className="p-1.5 rounded-full border border-gray-200 hover:bg-red-50 text-red-600"
                        title="Disable"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            ),
        },
    ];

    const goPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
    const goNext = () =>
        setCurrentPage((p) => Math.min(totalPages, p + 1));

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Tariffs</h1>
                    <p className="text-gray-600 mt-2">
                        Configure price ranges and advanced rules for your shipments
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        // reset básico si quieres
                        setShowModal(true);
                    }}
                    className="btn-primary flex items-center"
                >
                    <Plus className="h-5 w-5 mr-2" />
                    New Tariff
                </button>
            </div>

            <div className="card p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Tariff List
                    </h2>
                    <span className="text-sm text-gray-500">
                        {tariffs.length} tariff{tariffs.length !== 1 ? "s" : ""} total
                    </span>
                </div>

                {/* buscador */}
                <div className="w-full md:w-64 mb-4">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input"
                        placeholder="Search by name, region, type..."
                    />
                </div>

                <Table
                    columns={columns}
                    data={paginatedTariffs}
                    loading={loading}
                    emptyMessage="No tariffs found. Create your first tariff to get started."
                />

                {filteredTariffs.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4">
                        <button
                            type="button"
                            onClick={goPrev}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Modal crear/editar tarifa */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingId(null);
                }}
                title={editingId ? "Edit Tariff" : "Create New Tariff"}
                size="xlarge"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* DATOS BÁSICOS */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            Basic Information
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="label">Tariff name *</label>
                                <input
                                    className="input"
                                    value={formData.name}
                                    onChange={(e) => updateField("name", e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Country *</label>
                                <input
                                    className="input"
                                    value={formData.country}
                                    onChange={(e) => updateField("country", e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Region</label>
                                <input
                                    className="input"
                                    value={formData.region}
                                    onChange={(e) => updateField("region", e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mt-4">
                            <div>
                                <label className="label">Shipment type</label>
                                <select
                                    className="input"
                                    value={formData.shipmentType}
                                    onChange={(e) =>
                                        updateField("shipmentType", e.target.value)
                                    }
                                >
                                    <option value="AEREO">Aéreo</option>
                                    <option value="MARITIMO">Marítimo</option>
                                    <option value="TERRESTRE">Terrestre</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Measure unit</label>
                                <select
                                    className="input"
                                    value={formData.measureUnit}
                                    onChange={(e) =>
                                        updateField("measureUnit", e.target.value)
                                    }
                                >
                                    <option value="Kg">Kg</option>
                                    <option value="Lb">Lb</option>
                                    <option value="m3">m³</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Tariff type</label>
                                <select
                                    className="input"
                                    value={formData.tariffType}
                                    onChange={(e) =>
                                        updateField("tariffType", e.target.value as any)
                                    }
                                >
                                    <option value="RANGE">Tarifa por rango</option>
                                    <option value="FLAT_RANGE">
                                        Tarifa plana en el rango
                                    </option>
                                </select>
                            </div>
                            <div className="flex items-center space-x-2 mt-7">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) =>
                                        updateField("isActive", e.target.checked)
                                    }
                                />
                                <span>Active</span>
                            </div>
                        </div>
                    </div>

                    {/* RANGOS */}
                    <div>
                        <div className="mb-3">
                            <h3 className="text-lg font-medium text-gray-900">Price ranges</h3>
                        </div>

                        <div className="space-y-2">
                            {formData.ranges.map((r, index) => (
                                <div
                                    key={index}
                                    className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-md p-2"
                                >
                                    <div className="col-span-2">
                                        <label className="label">Min</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input"
                                            value={r.min}
                                            onChange={(e) =>
                                                updateRange(index, "min", parseFloat(e.target.value) || 0)
                                            }
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="label">Max</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input"
                                            value={r.max}
                                            onChange={(e) =>
                                                updateRange(index, "max", parseFloat(e.target.value) || 0)
                                            }
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="label">Price</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input"
                                            value={r.price}
                                            onChange={(e) =>
                                                updateRange(index, "price", parseFloat(e.target.value) || 0)
                                            }
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="label">Cost</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input"
                                            value={r.cost}
                                            onChange={(e) =>
                                                updateRange(index, "cost", parseFloat(e.target.value) || 0)
                                            }
                                        />
                                    </div>

                                    <div className="col-span-3 flex items-center mt-5">
                                        <input
                                            type="checkbox"
                                            checked={r.applyDeclaredValue}
                                            onChange={(e) =>
                                                updateRange(index, "applyDeclaredValue", e.target.checked)
                                            }
                                        />
                                        <span className="ml-2 text-xs">Apply to declared value</span>
                                    </div>

                                    <div className="col-span-1 flex justify-end mt-5">
                                        {formData.ranges.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRange(index)}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ✅ Botón abajo del listado */}
                        <div className="mt-3 flex justify-end">
                            <button
                                type="button"
                                onClick={addRange}
                                className="btn-outline text-sm flex items-center"
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add range
                            </button>
                        </div>
                    </div>


                    {/* DATOS AVANZADOS */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            Advanced tariff settings
                        </h3>
                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <label className="label">Lower limit</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    value={formData.lowerLimit}
                                    onChange={(e) =>
                                        updateField(
                                            "lowerLimit",
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label className="label">Upper limit</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    value={formData.upperLimit}
                                    onChange={(e) =>
                                        updateField(
                                            "upperLimit",
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label className="label">Base cost</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    value={formData.baseCost}
                                    onChange={(e) =>
                                        updateField(
                                            "baseCost",
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label className="label">Agency profit</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    value={formData.agencyProfit}
                                    onChange={(e) =>
                                        updateField(
                                            "agencyProfit",
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mt-4">
                            <div className="flex items-center space-x-2 mt-7">
                                <input
                                    type="checkbox"
                                    checked={formData.visibleInCalculator}
                                    onChange={(e) =>
                                        updateField("visibleInCalculator", e.target.checked)
                                    }
                                />
                                <span>Visible in calculator</span>
                            </div>
                            <div className="flex items-center space-x-2 mt-7">
                                <input
                                    type="checkbox"
                                    checked={formData.fixedPrice}
                                    onChange={(e) =>
                                        updateField("fixedPrice", e.target.checked)
                                    }
                                />
                                <span>Fixed price</span>
                            </div>
                            <div>
                                <label className="label">Weight mode</label>
                                <select
                                    className="input"
                                    value={formData.weightMode}
                                    onChange={(e) =>
                                        updateField("weightMode", e.target.value)
                                    }
                                >
                                    <option value="MAYOR">Mayor (físico o volumétrico)</option>
                                    <option value="FISICO">Físico</option>
                                    <option value="VOLUMETRICO">Volumétrico</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Tax mode</label>
                                <select
                                    className="input"
                                    value={formData.taxMode}
                                    onChange={(e) =>
                                        updateField("taxMode", e.target.value)
                                    }
                                >
                                    <option value="VALOR_DECLARADO">Declared value</option>
                                    <option value="NINGUNO">No tax</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mt-4">
                            <div>
                                <label className="label">% Tax</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    value={formData.taxPercent}
                                    onChange={(e) =>
                                        updateField(
                                            "taxPercent",
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label className="label">Extra amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    value={formData.extraAmount}
                                    onChange={(e) =>
                                        updateField(
                                            "extraAmount",
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label className="label">Extra label</label>
                                <input
                                    className="input"
                                    value={formData.extraLabel}
                                    onChange={(e) =>
                                        updateField("extraLabel", e.target.value)
                                    }
                                />
                            </div>
                            <div>
                                <label className="label">Insurance type</label>
                                <select
                                    className="input"
                                    value={formData.insuranceType}
                                    onChange={(e) =>
                                        updateField("insuranceType", e.target.value)
                                    }
                                >
                                    <option value="ESCALABLE">Escalable</option>
                                    <option value="FIJO">Fixed</option>
                                    <option value="NINGUNO">None</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mt-4">
                            <div>
                                <label className="label">Scale base</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    value={formData.scaleBase}
                                    onChange={(e) =>
                                        updateField(
                                            "scaleBase",
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label className="label">Price per scale</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    value={formData.scalePrice}
                                    onChange={(e) =>
                                        updateField(
                                            "scalePrice",
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={() => {
                                setShowModal(false);
                                setEditingId(null);
                            }}
                            className="btn-outline"
                        >
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="btn-primary">
                            {submitting
                                ? "Saving..."
                                : editingId
                                    ? "Update Tariff"
                                    : "Create Tariff"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
