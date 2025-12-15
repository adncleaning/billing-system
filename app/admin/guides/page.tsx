"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import Table from "@/components/Table";
import { Plus, Search, FileText, User, Calendar, Pencil } from "lucide-react";

interface ClientAddress {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
}

interface SenderClient {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    identification?: string;
    address?: ClientAddress;
}

interface Tariff {
    _id: string;
    name?: string;
    country?: string;
    measure?: string;
    type?: string;
}

interface RecipientSnapshot {
    index: number;
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
    identification?: string;
    address?: string;
}

interface Guide {
    _id: string;
    agency?: string;
    observations?: string;
    tariffHeading?: string;

    senderClient?: SenderClient;
    recipient?: RecipientSnapshot;

    tariffId?: Tariff | null;
    measureValue?: number;
    declaredValue?: number;

    shippingPrice?: number;
    servicesTotal?: number;

    status?: string;
    createdAt: string;
}

type ApiResponse<T> = { success: boolean; message?: string } & T;

export default function GuidesPage() {
    const { token } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();

    const [guides, setGuides] = useState<Guide[]>([]);
    const [loading, setLoading] = useState(true);

    // Search + pagination
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;

    // ✅ Quick find by guide id/code (para editar)
    const [quickFind, setQuickFind] = useState("");
    const [finding, setFinding] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.co.uk/v1/api/"

    const fetchGuides = async () => {
        try {
            setLoading(true);
            const data: any = await Api("GET", "guides", null, router);
            if (data?.success) {
                setGuides(data.guides || []);
                setCurrentPage(1);
            } else {
                showToast(data?.message || "Error loading guides", "error");
            }
        } catch (error: any) {
            showToast(error?.message || "Error loading guides", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchGuides();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // helper: safe string
    const s = (v: any) => (v ?? "").toString();

    const filteredGuides = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return guides;

        return guides.filter((g) => {
            const sender = g.senderClient;
            const recip = g.recipient;
            const tariff = g.tariffId;

            const haystack = [
                g._id,
                g.status,
                g.agency,
                g.tariffHeading,
                s(g.measureValue),
                s(g.declaredValue),
                s(g.shippingPrice),
                s(g.servicesTotal),

                sender?._id,
                sender?.name,
                sender?.email,
                sender?.phone,
                sender?.identification,

                recip?.name,
                recip?.relationship,
                recip?.phone,
                recip?.email,
                recip?.identification,

                tariff?._id,
                tariff?.name,
                tariff?.country,
                tariff?.measure,
                tariff?.type,

                g.createdAt,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(term);
        });
    }, [guides, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredGuides.length / PAGE_SIZE));
    const paginatedGuides = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredGuides.slice(start, start + PAGE_SIZE);
    }, [filteredGuides, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const goToPreviousPage = () => setCurrentPage((p) => Math.max(1, p - 1));
    const goToNextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

    const getStatusBadge = (status?: string) => {
        const st = (status || "CREATED").toLowerCase();
        const map: Record<string, string> = {
            created: "bg-blue-100 text-blue-800",
            complete: "bg-green-100 text-green-800",
            cancelled: "bg-red-100 text-red-800",
            pending: "bg-yellow-100 text-yellow-800",
        };
        const cls = map[st] || "bg-gray-100 text-gray-800";
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${cls}`}>
                {(status || "CREATED").toUpperCase()}
            </span>
        );
    };

    const money = (n?: number) => {
        const v = Number(n || 0);
        return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // ✅ Busca una guía por ID (backend: GET /guides/:id) y navega a edit
    const handleQuickFind = async () => {
        const term = quickFind.trim();
        if (!term) return;

        // si pega URL completa, intenta extraer el último segmento
        const id = term.includes("/") ? term.split("/").filter(Boolean).pop() || term : term;

        try {
            setFinding(true);

            // Si ya está cargada en la lista, navegamos directo sin pegarle al backend
            const local = guides.find((g) => g._id === id);
            if (local) {
                router.push(`/admin/guides/${local._id}/edit`);
                return;
            }

            const resp = (await Api("GET", `guides/${id}`, null, router)) as ApiResponse<{ guide: Guide }>;

            if (!resp?.success || !resp?.guide?._id) {
                throw new Error(resp?.message || "Guide not found");
            }

            router.push(`/admin/guides/${resp.guide._id}/edit`);
        } catch (e: any) {
            showToast(e?.message || "Guide not found", "error");
        } finally {
            setFinding(false);
        }
    };

    const generateGuidePdf = async (guideId: string) => {
        try {
            if (!guideId) return;

            let authToken = token;
            if (!authToken && typeof window !== "undefined") {
                authToken = localStorage.getItem("token");
            }

            if (!authToken) {
                showToast("Sesión no válida. Inicia sesión nuevamente.", "error");
                return;
            }

            setGeneratingPdf(true);

            // 👇 si tu endpoint es GET:
            const res = await fetch(`${API_URL}/guides/${guideId}/pdf`, {
                method: "GET",
                headers: {
                    Authorization: `jwt ${authToken}`,
                },
            });

            // 👇 si tu endpoint es POST (por ejemplo para elegir template), usa esto:
            // const res = await fetch(`${API_URL}/guides/${guideId}/pdf`, {
            //   method: "POST",
            //   headers: {
            //     "Content-Type": "application/json",
            //     Authorization: `jwt ${authToken}`,
            //   },
            //   body: JSON.stringify({ template: "via" }),
            // });

            if (!res.ok) {
                if (res.status === 401) {
                    if (typeof window !== "undefined") {
                        localStorage.removeItem("token");
                        localStorage.removeItem("user");
                        router.push("/");
                    }
                }

                // intenta leer JSON si backend manda message
                let msg = "Error al generar el PDF";
                try {
                    const err = await res.json();
                    msg = err?.message || msg;
                } catch { }
                throw new Error(msg);
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `guide_${guideId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(url);

            showToast("PDF generado correctamente", "success");
        } catch (error: any) {
            console.error(error);
            showToast(error.message || "Error al generar el PDF", "error");
        } finally {
            setGeneratingPdf(false);
        }
    };

    const openGuideLabelForPrint = async (guideId: string) => {
        let authToken = token || localStorage.getItem("token");
        const res = await fetch(`${API_URL}/guides/${guideId}/label`, {
            headers: { Authorization: `jwt ${authToken}` },
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
    };



    const columns = [
        {
            key: "senderClient",
            label: "Sender",
            render: (_: any, row: Guide) => (
                <div className="flex items-center">
                    <User className="h-4 w-4 text-gray-400 mr-2" />
                    <div className="leading-tight">
                        <div className="font-medium">{row.senderClient?.name || "—"}</div>
                        <div className="text-xs text-gray-500">
                            {row.senderClient?.identification || row.senderClient?.email || " "}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: "recipient",
            label: "Recipient",
            render: (_: any, row: Guide) => (
                <div className="leading-tight">
                    <div className="font-medium">{row.recipient?.name || "—"}</div>
                    <div className="text-xs text-gray-500">{row.recipient?.relationship ? row.recipient.relationship : " "}</div>
                </div>
            ),
        },
        {
            key: "tariffId",
            label: "Tariff",
            render: (_: any, row: Guide) => (
                <div className="leading-tight">
                    <div className="font-medium">{row.tariffId?.name || "—"}</div>
                    <div className="text-xs text-gray-500">{row.tariffId?.country ? `${row.tariffId.country}` : " "}</div>
                </div>
            ),
        },
        {
            key: "measureValue",
            label: "Measure",
            render: (value: number) => <span className="font-medium">{Number(value || 0).toFixed(2)}</span>,
        },
        {
            key: "shippingPrice",
            label: "Shipping",
            render: (value: number) => <span className="font-medium">£{money(value)}</span>,
        },
        {
            key: "servicesTotal",
            label: "Services",
            render: (value: number) => <span className="font-medium">£{money(value)}</span>,
        },
        {
            key: "status",
            label: "Status",
            render: (value: string) => getStatusBadge(value),
        },
        {
            key: "createdAt",
            label: "Created",
            render: (value: string) => (
                <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                    {new Date(value).toLocaleDateString()}
                </div>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            render: (_: any, row: Guide) => (
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => generateGuidePdf(row._id)}
                        className="inline-flex items-center text-sm text-blue-600 hover:underline"
                    >
                        <FileText className="h-4 w-4 mr-1" />
                        View PDF
                    </button>

                    <button
                        type="button"
                        onClick={() => openGuideLabelForPrint(row._id)}
                        className="inline-flex items-center text-sm text-blue-600 hover:underline"
                    >
                        <FileText className="h-4 w-4 mr-1" />
                        Print Ticket
                    </button>

                    <button
                        type="button"
                        onClick={() => router.push(`/admin/guides/${row._id}/edit`)}
                        className="inline-flex items-center text-sm text-indigo-600 hover:underline"
                        title="Edit guide"
                    >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Guides</h1>
                    <p className="text-gray-600 mt-2">Create and manage shipping guides</p>
                </div>

                <button type="button" onClick={() => router.push("/admin/guides/new")} className="btn-primary flex items-center">
                    <Plus className="h-5 w-5 mr-2" />
                    New Guide
                </button>
            </div>

            <div className="card p-6">
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Guide List</h2>
                            <span className="text-sm text-gray-500">
                                {filteredGuides.length} guide{filteredGuides.length !== 1 ? "s" : ""} found
                            </span>
                        </div>

                        {/* Search (en la lista) */}
                        <div className="w-full md:w-72 relative">
                            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input pl-9"
                                placeholder="Search guides..."
                            />
                        </div>
                    </div>

                    {/* ✅ Quick Find (para ir directo a editar) */}
                    <div className="w-full flex flex-col md:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={quickFind}
                                onChange={(e) => setQuickFind(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleQuickFind();
                                    }
                                }}
                                className="input pl-9"
                                placeholder="Quick find by Guide ID (paste and hit Enter)…"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleQuickFind}
                            disabled={finding || !quickFind.trim()}
                            className="btn-outline flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Search className="h-4 w-4 mr-2" />
                            {finding ? "Searching..." : "Open for update"}
                        </button>
                    </div>
                </div>

                <Table columns={columns} data={paginatedGuides} loading={loading} emptyMessage="No guides found. Create your first guide to get started." />

                {/* Pagination */}
                {filteredGuides.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4">
                        <button
                            type="button"
                            onClick={goToPreviousPage}
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
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
