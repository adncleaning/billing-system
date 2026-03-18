"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Api } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

import SenderRecipientSection from "@/components/guides/sections/SenderRecipientSection";
import BasicInfoSection from "@/components/guides/sections/BasicInfoSection";
import PackagesSection from "@/components/guides/sections/PackagesSection";
import TariffSection from "@/components/guides/sections/TariffSection";
import ServicesSection from "@/components/guides/sections/ServicesSection";
import TotalsSection from "@/components/guides/sections/TotalsSection";
import FooterActions from "@/components/guides/sections/FooterActions";
import GuideClientModals from "@/components/guides/modals/GuideClientModals";

import type {
  Client,
  City,
  Invoice,
  InvoiceMode,
  PackageRow,
  PersonPayload,
  ServiceRow,
  Tariff,
} from "@/types/guide";

import {
  applyCitySelection,
  displayPersonName,
  emptyBeneficiary,
  emptyNewCityForm,
  emptyPerson,
  isPersonNameValid,
  normalizeClient,
  packageChargeableWeight,
  toNum,
  volumetricWeight,
} from "@/utils/guideHelpers";

type NewCityForm = {
  label: string;
  country: string;
  postalCode: string;
};

const emptyPackage = (): PackageRow => ({
  id: crypto.randomUUID(),
  invoiceId: null,
  description: "",
  value: 0,
  length: 0,
  width: 0,
  height: 0,
  weight: 0,
  pcs: 1,
  items: [],
});

export default function CreateGuidePage() {
  const router = useRouter();
  const { showToast } = useToast();

  const INTERNAL_COMMENTS_MAX = 1000;

  const [clients, setClients] = useState<Client[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingTariffs, setLoadingTariffs] = useState(true);
  const [loadingCities, setLoadingCities] = useState(true);

  const [senderSearch, setSenderSearch] = useState("");
  const [senderClientId, setSenderClientId] = useState("");
  const [senderClient, setSenderClient] = useState<Client | null>(null);
  const [beneficiaryIndex, setBeneficiaryIndex] = useState(0);

  const [agency, setAgency] = useState("Via logistics");
  const [observations, setObservations] = useState("");
  const [tariffHeading, setTariffHeading] = useState("");
  const [internalComments, setInternalComments] = useState("");

  const [tariffId, setTariffId] = useState("");
  const [measureValue, setMeasureValue] = useState(0);
  const [shippingPrice, setShippingPrice] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);

  const [declaredValue, setDeclaredValue] = useState(0);
  const [insuredAmount, setInsuredAmount] = useState(0);
  const [insurance, setInsurance] = useState(10);
  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [commission, setCommission] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);

  const [services, setServices] = useState<ServiceRow[]>([
    {
      id: "box_small",
      included: false,
      name: "Caja pequeña",
      measure: "Unit",
      price: 2.5,
      quantity: 0,
    },
    {
      id: "box_medium",
      included: false,
      name: "Caja Mediana",
      measure: "Unit",
      price: 3.5,
      quantity: 0,
    },
    {
      id: "box_large",
      included: false,
      name: "Caja Grande",
      measure: "Unit",
      price: 4.0,
      quantity: 0,
    },
  ]);

  const [packages, setPackages] = useState<PackageRow[]>([emptyPackage()]);
  const [availableInvoices, setAvailableInvoices] = useState<Invoice[]>([]);
  const [loadingAvailableInvoices, setLoadingAvailableInvoices] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [invoiceDetailCountry, setInvoiceDetailCountry] =
    useState<InvoiceMode>("COLOMBIA");

  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [showAddBeneficiaryModal, setShowAddBeneficiaryModal] = useState(false);
  const [showEditBeneficiaryModal, setShowEditBeneficiaryModal] = useState(false);

  const [creatingClient, setCreatingClient] = useState(false);
  const [updatingClient, setUpdatingClient] = useState(false);
  const [savingBeneficiary, setSavingBeneficiary] = useState(false);
  const [updatingBeneficiary, setUpdatingBeneficiary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingNewCity, setSavingNewCity] = useState(false);

  const [addBeneficiaryNow, setAddBeneficiaryNow] = useState(false);

  const [clientForm, setClientForm] = useState<{
    agency: string;
    profile: PersonPayload;
    beneficiary: PersonPayload;
  }>({
    agency: "Via logistics",
    profile: emptyPerson(),
    beneficiary: emptyBeneficiary(),
  });

  const [editClientForm, setEditClientForm] = useState<{
    agency: string;
    profile: PersonPayload;
  }>({
    agency: "Via logistics",
    profile: emptyPerson(),
  });

  const [beneficiaryForm, setBeneficiaryForm] = useState<PersonPayload>(
    emptyBeneficiary()
  );
  const [editBeneficiaryForm, setEditBeneficiaryForm] = useState<PersonPayload>(
    emptyBeneficiary()
  );

  const [createClientNewCity, setCreateClientNewCity] = useState(false);
  const [createBeneficiaryNewCity, setCreateBeneficiaryNewCity] =
    useState(false);
  const [editClientNewCity, setEditClientNewCity] = useState(false);
  const [editBeneficiaryNewCity, setEditBeneficiaryNewCity] = useState(false);

  const [createClientCityForm, setCreateClientCityForm] =
    useState<NewCityForm>(emptyNewCityForm());
  const [createBeneficiaryCityForm, setCreateBeneficiaryCityForm] =
    useState<NewCityForm>(emptyNewCityForm());
  const [editClientCityForm, setEditClientCityForm] = useState<NewCityForm>(
    emptyNewCityForm()
  );
  const [editBeneficiaryCityForm, setEditBeneficiaryCityForm] =
    useState<NewCityForm>(emptyNewCityForm());

  const cityById = useMemo(() => {
    const map = new Map<string, City>();
    for (const c of cities) map.set(c._id, c);
    return map;
  }, [cities]);

  const packagesDeclaredValue = useMemo(() => {
    return Number(
      packages.reduce((sum, p) => sum + toNum(p.value), 0).toFixed(2)
    );
  }, [packages]);

  const packagesTotalWeight = useMemo(() => {
    return Number(
      packages.reduce((sum, p) => sum + toNum(p.weight), 0).toFixed(2)
    );
  }, [packages]);

  const packagesChargeableWeight = useMemo(() => {
    return Number(
      packages
        .reduce((sum, p) => sum + packageChargeableWeight(p), 0)
        .toFixed(2)
    );
  }, [packages]);

  const servicesTotal = useMemo(() => {
    return services.reduce((sum, s) => {
      if (!s.included) return sum;
      return sum + toNum(s.price) * toNum(s.quantity);
    }, 0);
  }, [services]);

  const totalGuide = useMemo(() => {
    const extras =
      toNum(insurance) +
      toNum(tax) +
      toNum(otherCharges) +
      toNum(commission) -
      toNum(discount);

    return toNum(shippingPrice) + servicesTotal + extras;
  }, [
    shippingPrice,
    servicesTotal,
    insurance,
    tax,
    otherCharges,
    commission,
    discount,
  ]);

  const filteredClients = useMemo(() => {
    const term = senderSearch.toLowerCase().trim();
    if (!term) return clients;

    return clients.filter((c) => {
      const p = c.profile || emptyPerson();
      const name = displayPersonName(p).toLowerCase();

      return (
        name.includes(term) ||
        (p.companyName || "").toLowerCase().includes(term) ||
        (p.email || "").toLowerCase().includes(term) ||
        (p.phone || "").toLowerCase().includes(term) ||
        (p.mobile || "").toLowerCase().includes(term) ||
        (p.identification || "").toLowerCase().includes(term)
      );
    });
  }, [clients, senderSearch]);

  const beneficiaryPreview = useMemo(() => {
    if (!senderClient?.beneficiaries?.length) return null;
    return senderClient.beneficiaries[beneficiaryIndex] || null;
  }, [senderClient, beneficiaryIndex]);

  const loadCities = async () => {
    setLoadingCities(true);
    try {
      const response: any = await Api("GET", "cities", null, router);
      if (response?.success) {
        setCities(response.cities || []);
        return response.cities || [];
      }
      return [];
    } catch {
      showToast("Error loading cities", "error");
      return [];
    } finally {
      setLoadingCities(false);
    }
  };

  const validateNewCityForm = (form: NewCityForm) => {
    if (!form.label.trim()) return "City name is required";
    if (!form.country.trim()) return "Country is required";
    return null;
  };

  const createCityAndRefresh = async (form: NewCityForm) => {
    const validationError = validateNewCityForm(form);
    if (validationError) {
      showToast(validationError, "error");
      return null;
    }

    setSavingNewCity(true);
    try {
      const payload = {
        label: form.label.trim(),
        country: form.country.trim(),
        postalCode: form.postalCode.trim() || null,
      };

      const res: any = await Api("POST", "cities", payload, router);

      if (!res?.success || !res?.city) {
        showToast(res?.message || "Error creating city", "error");
        return null;
      }

      const createdCity = res.city;
      const refreshedCities = await loadCities();

      const matchedCity =
        refreshedCities.find((c: City) => c._id === createdCity._id) ||
        createdCity;

      showToast("City created successfully", "success");
      return matchedCity;
    } catch (err: any) {
      showToast(err?.message || "Error creating city", "error");
      return null;
    } finally {
      setSavingNewCity(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const c: any = await Api("GET", "clients", null, router);
        if (c?.success) setClients((c.clients || []).map(normalizeClient));
      } catch {
        showToast("Error loading clients", "error");
      } finally {
        setLoadingClients(false);
      }
    })();

    (async () => {
      try {
        const t: any = await Api("GET", "tariffs", null, router);
        if (t?.success) setTariffs(t.tariffs || []);
      } catch {
        showToast("Error loading tariffs", "error");
      } finally {
        setLoadingTariffs(false);
      }
    })();

    loadCities();
  }, [router, showToast]);

  useEffect(() => {
    if (!senderClientId) {
      setSenderClient(null);
      setBeneficiaryIndex(0);
      setAvailableInvoices([]);
      setSelectedInvoiceIds([]);
      return;
    }

    (async () => {
      setLoadingAvailableInvoices(true);

      try {
        const [clientRes, invoicesRes]: any = await Promise.all([
          Api("GET", `clients/${senderClientId}`, null, router),
          Api("GET", `guides/available-invoices/${senderClientId}`, null, router),
        ]);

        if (clientRes?.success) {
          setSenderClient(normalizeClient(clientRes.client));
          setBeneficiaryIndex(0);
        }

        if (invoicesRes?.success) {
          setAvailableInvoices(invoicesRes.invoices || []);
        } else {
          setAvailableInvoices([]);
        }

        setSelectedInvoiceIds([]);
      } catch {
        showToast("Error loading client detail", "error");
        setAvailableInvoices([]);
        setSelectedInvoiceIds([]);
      } finally {
        setLoadingAvailableInvoices(false);
      }
    })();
  }, [senderClientId, router, showToast]);

  useEffect(() => {
    setDeclaredValue(packagesDeclaredValue);
  }, [packagesDeclaredValue]);

  useEffect(() => {
    setMeasureValue(packagesChargeableWeight);
  }, [packagesChargeableWeight]);

  useEffect(() => {
    const calculatedTax = Number((toNum(declaredValue) * 0.19).toFixed(2));
    setTax(calculatedTax);
  }, [declaredValue]);

  useEffect(() => {
    if (!tariffId || !measureValue || measureValue <= 0) {
      setShippingPrice(0);
      setShippingCost(0);
      return;
    }

    (async () => {
      try {
        const data: any = await Api(
          "GET",
          `tariffs/${tariffId}/calc?weight=${measureValue}`,
          null,
          router
        );

        if (data?.success === true || data?.success?.toString() === "true") {
          setShippingPrice(toNum(data.range?.price));
          setShippingCost(toNum(data.range?.cost));
        } else {
          setShippingPrice(0);
          setShippingCost(0);
        }
      } catch {
        setShippingPrice(0);
        setShippingCost(0);
      }
    })();
  }, [tariffId, measureValue, router]);

  const updateClientProfile = (patch: Partial<PersonPayload>) => {
    setClientForm((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...patch },
    }));
  };

  const updateClientBeneficiary = (patch: Partial<PersonPayload>) => {
    setClientForm((prev) => ({
      ...prev,
      beneficiary: { ...prev.beneficiary, ...patch },
    }));
  };

  const updateEditClientProfile = (patch: Partial<PersonPayload>) => {
    setEditClientForm((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...patch },
    }));
  };

  const openEditClient = () => {
    if (!senderClient || !senderClientId) {
      showToast("Select a client first", "error");
      return;
    }

    setEditClientForm({
      agency: senderClient.agency || "Via logistics",
      profile: { ...emptyPerson(), ...(senderClient.profile || {}) },
    });

    setShowEditClientModal(true);
  };

  const openEditBeneficiary = () => {
    if (!senderClientId || !senderClient) {
      showToast("Select a sender first", "error");
      return;
    }

    if (!beneficiaryPreview) {
      showToast("Select a beneficiary first", "error");
      return;
    }

    setEditBeneficiaryForm({
      ...emptyBeneficiary(),
      ...beneficiaryPreview,
    });

    setShowEditBeneficiaryModal(true);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingClient(true);

    try {
      let profile = { ...clientForm.profile };
      let beneficiary = { ...clientForm.beneficiary };

      if (createClientNewCity) {
        const createdCity = await createCityAndRefresh(createClientCityForm);
        if (!createdCity) return;

        profile = applyCitySelection(profile, createdCity._id, cityById);
        profile.cityLabel = createdCity.label;
        profile.zipCode = createdCity.postalCode || "";
      }

      if (addBeneficiaryNow && createBeneficiaryNewCity) {
        const createdCity = await createCityAndRefresh(createBeneficiaryCityForm);
        if (!createdCity) return;

        beneficiary = applyCitySelection(beneficiary, createdCity._id, cityById);
        beneficiary.cityLabel = createdCity.label;
        beneficiary.zipCode = createdCity.postalCode || "";
      }

      if (!isPersonNameValid(profile)) {
        showToast(
          "Client name is required (first/last or company name)",
          "error"
        );
        return;
      }

      const payload: any = {
        agency: clientForm.agency,
        profile,
        beneficiaries: [],
      };

      if (addBeneficiaryNow) {
        if (!isPersonNameValid(beneficiary)) {
          showToast(
            "Beneficiary name is required (first/last or company name)",
            "error"
          );
          return;
        }
        payload.beneficiaries = [beneficiary];
      }

      const data: any = await Api("POST", "clients", payload, router);
      if (!data?.success) {
        showToast(data?.message || "Error creating client", "error");
        return;
      }

      const newClient: Client = normalizeClient(data.client);

      setClients((prev) => [newClient, ...prev]);
      setSenderClientId(newClient._id);
      setShowCreateClientModal(false);

      setAddBeneficiaryNow(false);
      setCreateClientNewCity(false);
      setCreateBeneficiaryNewCity(false);
      setCreateClientCityForm(emptyNewCityForm());
      setCreateBeneficiaryCityForm(emptyNewCityForm());

      setClientForm({
        agency: "Via logistics",
        profile: emptyPerson(),
        beneficiary: emptyBeneficiary(),
      });

      showToast("Client created successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Error creating client", "error");
    } finally {
      setCreatingClient(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderClientId || !senderClient) return;

    setUpdatingClient(true);
    try {
      let profile = { ...editClientForm.profile };

      if (editClientNewCity) {
        const createdCity = await createCityAndRefresh(editClientCityForm);
        if (!createdCity) return;

        profile = applyCitySelection(profile, createdCity._id, cityById);
        profile.cityLabel = createdCity.label;
        profile.zipCode = createdCity.postalCode || "";
      }

      const payload = {
        agency: editClientForm.agency,
        profile,
        beneficiaries: senderClient.beneficiaries || [],
      };

      const updated: any = await Api(
        "PUT",
        `clients/${senderClientId}`,
        payload,
        router
      );
      if (!updated?.success) {
        showToast(updated?.message || "Error updating client", "error");
        return;
      }

      const refreshed: any = await Api(
        "GET",
        `clients/${senderClientId}`,
        null,
        router
      );
      if (refreshed?.success) {
        const normalized = normalizeClient(refreshed.client);
        setSenderClient(normalized);
        setClients((prev) =>
          prev.map((c) => (c._id === senderClientId ? normalized : c))
        );
      }

      setEditClientNewCity(false);
      setEditClientCityForm(emptyNewCityForm());
      setShowEditClientModal(false);
      showToast("Client updated successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Error updating client", "error");
    } finally {
      setUpdatingClient(false);
    }
  };

  const handleAddBeneficiaryToSender = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!senderClientId) {
      showToast("Select a sender first", "error");
      return;
    }

    let newBeneficiary = { ...beneficiaryForm };

    if (createBeneficiaryNewCity) {
      const createdCity = await createCityAndRefresh(createBeneficiaryCityForm);
      if (!createdCity) return;

      newBeneficiary = applyCitySelection(
        newBeneficiary,
        createdCity._id,
        cityById
      );
      newBeneficiary.cityLabel = createdCity.label;
      newBeneficiary.zipCode = createdCity.postalCode || "";
    }

    if (!isPersonNameValid(newBeneficiary)) {
      showToast(
        "Beneficiary name is required (first/last or company name)",
        "error"
      );
      return;
    }

    setSavingBeneficiary(true);
    try {
      const res = (await Api(
        "GET",
        `clients/${senderClientId}`,
        null,
        router
      )) as any;
      const current: Client | null =
        senderClient ?? (res?.client as Client | null);

      if (!current) {
        showToast("Error loading sender client", "error");
        return;
      }

      const beneficiaries = [...(current.beneficiaries || []), newBeneficiary];

      const payload = {
        agency: current.agency || "Via logistics",
        profile: current.profile,
        beneficiaries,
      };

      const updated: any = await Api(
        "PUT",
        `clients/${senderClientId}`,
        payload,
        router
      );
      if (!updated?.success) {
        showToast(updated?.message || "Error adding beneficiary", "error");
        return;
      }

      const refreshed: any = await Api(
        "GET",
        `clients/${senderClientId}`,
        null,
        router
      );
      if (refreshed?.success) {
        const normalized = normalizeClient(refreshed.client);
        setSenderClient(normalized);
        setBeneficiaryIndex(Math.max(0, (normalized.beneficiaries?.length || 1) - 1));
        setClients((prev) =>
          prev.map((c) => (c._id === senderClientId ? normalized : c))
        );
      }

      setCreateBeneficiaryNewCity(false);
      setCreateBeneficiaryCityForm(emptyNewCityForm());
      setBeneficiaryForm(emptyBeneficiary());
      setShowAddBeneficiaryModal(false);
      showToast("Beneficiary added successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Error adding beneficiary", "error");
    } finally {
      setSavingBeneficiary(false);
    }
  };

  const handleUpdateBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderClientId || !senderClient) return;

    let updatedBeneficiary = { ...editBeneficiaryForm };

    if (editBeneficiaryNewCity) {
      const createdCity = await createCityAndRefresh(editBeneficiaryCityForm);
      if (!createdCity) return;

      updatedBeneficiary = applyCitySelection(
        updatedBeneficiary,
        createdCity._id,
        cityById
      );
      updatedBeneficiary.cityLabel = createdCity.label;
      updatedBeneficiary.zipCode = createdCity.postalCode || "";
    }

    if (!isPersonNameValid(updatedBeneficiary)) {
      showToast(
        "Beneficiary name is required (first/last or company name)",
        "error"
      );
      return;
    }

    setUpdatingBeneficiary(true);
    try {
      const beneficiaries = [...(senderClient.beneficiaries || [])];

      if (beneficiaryIndex < 0 || beneficiaryIndex >= beneficiaries.length) {
        showToast("Invalid beneficiary selected", "error");
        return;
      }

      beneficiaries[beneficiaryIndex] = {
        ...beneficiaries[beneficiaryIndex],
        ...updatedBeneficiary,
      };

      const payload = {
        agency: senderClient.agency || "Via logistics",
        profile: senderClient.profile,
        beneficiaries,
      };

      const updated: any = await Api(
        "PUT",
        `clients/${senderClientId}`,
        payload,
        router
      );
      if (!updated?.success) {
        showToast(updated?.message || "Error updating beneficiary", "error");
        return;
      }

      const refreshed: any = await Api(
        "GET",
        `clients/${senderClientId}`,
        null,
        router
      );
      if (refreshed?.success) {
        const normalized = normalizeClient(refreshed.client);
        setSenderClient(normalized);
        setClients((prev) =>
          prev.map((c) => (c._id === senderClientId ? normalized : c))
        );
      }

      setEditBeneficiaryNewCity(false);
      setEditBeneficiaryCityForm(emptyNewCityForm());
      setShowEditBeneficiaryModal(false);
      showToast("Beneficiary updated successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Error updating beneficiary", "error");
    } finally {
      setUpdatingBeneficiary(false);
    }
  };

  const handleSaveGuide = async () => {
    try {
      if (!packages.length) {
        showToast("Add at least one package", "error");
        return;
      }

      const hasAnyData = packages.some(
        (p) =>
          p.description.trim() ||
          toNum(p.value) > 0 ||
          toNum(p.length) > 0 ||
          toNum(p.width) > 0 ||
          toNum(p.height) > 0 ||
          toNum(p.weight) > 0
      );

      if (!hasAnyData) {
        showToast("Fill at least one package detail", "error");
        return;
      }

      if (!senderClientId) {
        showToast("Select a sender (client)", "error");
        return;
      }

      if (!senderClient?.beneficiaries?.length) {
        showToast("Sender has no beneficiaries. Add at least one.", "error");
        return;
      }

      if (!tariffId) {
        showToast("Select a tariff", "error");
        return;
      }

      if (!measureValue || measureValue <= 0) {
        showToast("Enter a valid weight (measure value)", "error");
        return;
      }

      const trimmedInternal = internalComments.trim();
      if (trimmedInternal.length > INTERNAL_COMMENTS_MAX) {
        showToast(
          `Internal comments exceeds ${INTERNAL_COMMENTS_MAX} characters`,
          "error"
        );
        return;
      }

      setSaving(true);

      const payload = {
        agency,
        observations,
        tariffHeading,
        senderClientId,
        beneficiaryIndex,
        tariffId,
        measureValue,
        declaredValue,
        insuredAmount,
        insurance,
        tax,
        discount,
        commission,
        otherCharges,
        services: services.map((s) => ({
          name: s.name,
          measure: s.measure,
          price: s.price,
          quantity: s.quantity,
          included: s.included,
        })),
        invoiceIds: [],
        internalComments: trimmedInternal || "",
        packages: packages.map((p) => ({
          invoiceId: p.invoiceId || null,
          description: p.description,
          value: toNum(p.value),
          length: toNum(p.length),
          width: toNum(p.width),
          height: toNum(p.height),
          weight: toNum(p.weight),
          pcs: toNum(p.pcs),
          volumetricWeight: volumetricWeight(p),
          chargeableWeight: packageChargeableWeight(p),
          items: Array.isArray(p.items) ? p.items : [],
        })),
      };

      const data: any = await Api("POST", "guides", payload, router);
      if (!data?.success) {
        showToast(data?.message || "Error creating guide", "error");
        return;
      }

      showToast("Guide created successfully", "success");
      router.push("/admin/guides");
    } catch (err: any) {
      showToast(err?.message || "Error creating guide", "error");
    } finally {
      setSaving(false);
    }
  };

  const setServiceIncluded = (id: string, included: boolean) => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
            ...s,
            included,
            quantity: included ? Math.max(1, s.quantity) : 0,
          }
          : s
      )
    );
  };

  const setServiceQty = (id: string, qty: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, quantity: Math.max(0, qty) } : s))
    );
  };

  const setServicePrice = (id: string, price: number) => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, price: Math.max(0, toNum(price)) } : s
      )
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Guide</h1>
          <p className="text-gray-600 mt-2">
            Fill sender, recipient, packages, tariff and services
          </p>
        </div>
      </div>

      <SenderRecipientSection
        senderSearch={senderSearch}
        setSenderSearch={setSenderSearch}
        senderClientId={senderClientId}
        setSenderClientId={setSenderClientId}
        senderClient={senderClient}
        filteredClients={filteredClients}
        loadingClients={loadingClients}
        beneficiaryIndex={beneficiaryIndex}
        setBeneficiaryIndex={setBeneficiaryIndex}
        beneficiaryPreview={beneficiaryPreview}
        onOpenEditClient={openEditClient}
        onOpenCreateClient={() => setShowCreateClientModal(true)}
        onOpenEditBeneficiary={openEditBeneficiary}
        onOpenAddBeneficiary={() => {
          if (!senderClientId) {
            showToast("Select a sender first", "error");
            return;
          }
          setShowAddBeneficiaryModal(true);
        }}
      />

      <BasicInfoSection
        agency={agency}
        setAgency={setAgency}
        observations={observations}
        setObservations={setObservations}
        tariffHeading={tariffHeading}
        setTariffHeading={setTariffHeading}
        internalComments={internalComments}
        setInternalComments={setInternalComments}
        internalCommentsMax={INTERNAL_COMMENTS_MAX}
      />

      <PackagesSection
        packages={packages}
        setPackages={setPackages}
        packagesDeclaredValue={packagesDeclaredValue}
        packagesTotalWeight={packagesTotalWeight}
        packagesChargeableWeight={packagesChargeableWeight}
        availableInvoices={availableInvoices}
        loadingAvailableInvoices={loadingAvailableInvoices}
        selectedInvoiceIds={selectedInvoiceIds}
        setSelectedInvoiceIds={setSelectedInvoiceIds}
        invoiceDetailCountry={invoiceDetailCountry}
        setInvoiceDetailCountry={setInvoiceDetailCountry}
      />

      <TariffSection
        tariffs={tariffs}
        loadingTariffs={loadingTariffs}
        tariffId={tariffId}
        setTariffId={setTariffId}
        measureValue={measureValue}
        setMeasureValue={setMeasureValue}
        declaredValue={declaredValue}
        setDeclaredValue={setDeclaredValue}
        insuredAmount={insuredAmount}
        setInsuredAmount={setInsuredAmount}
        insurance={insurance}
        setInsurance={setInsurance}
        tax={tax}
        setTax={setTax}
        discount={discount}
        setDiscount={setDiscount}
        commission={commission}
        setCommission={setCommission}
        otherCharges={otherCharges}
        setOtherCharges={setOtherCharges}
        shippingPrice={shippingPrice}
        shippingCost={shippingCost}
      />

      <ServicesSection
        services={services}
        setServiceIncluded={setServiceIncluded}
        setServiceQty={setServiceQty}
        setServicePrice={setServicePrice}
        servicesTotal={servicesTotal}
      />

      <TotalsSection
        shippingPrice={shippingPrice}
        servicesTotal={servicesTotal}
        insurance={insurance}
        tax={tax}
        otherCharges={otherCharges}
        commission={commission}
        discount={discount}
        totalGuide={totalGuide}
      />

      <FooterActions
        saving={saving}
        onCancel={() => router.back()}
        onSave={handleSaveGuide}
      />

      <GuideClientModals
        cities={cities}
        cityById={cityById}
        loadingCities={loadingCities}
        savingNewCity={savingNewCity}
        emptyNewCityForm={emptyNewCityForm}
        showCreateClientModal={showCreateClientModal}
        setShowCreateClientModal={setShowCreateClientModal}
        creatingClient={creatingClient}
        handleCreateClient={handleCreateClient}
        addBeneficiaryNow={addBeneficiaryNow}
        setAddBeneficiaryNow={setAddBeneficiaryNow}
        clientForm={clientForm}
        setClientForm={setClientForm}
        updateClientProfile={updateClientProfile}
        updateClientBeneficiary={updateClientBeneficiary}
        createClientNewCity={createClientNewCity}
        setCreateClientNewCity={setCreateClientNewCity}
        createClientCityForm={createClientCityForm}
        setCreateClientCityForm={setCreateClientCityForm}
        createBeneficiaryNewCity={createBeneficiaryNewCity}
        setCreateBeneficiaryNewCity={setCreateBeneficiaryNewCity}
        createBeneficiaryCityForm={createBeneficiaryCityForm}
        setCreateBeneficiaryCityForm={setCreateBeneficiaryCityForm}
        onCreateClientCity={async () => {
          const createdCity = await createCityAndRefresh(createClientCityForm);
          if (!createdCity) return;

          setClientForm((prev) => ({
            ...prev,
            profile: applyCitySelection(prev.profile, createdCity._id, cityById),
          }));

          setCreateClientNewCity(false);
          setCreateClientCityForm(emptyNewCityForm());
        }}
        onCreateBeneficiaryCityForClient={async () => {
          const createdCity = await createCityAndRefresh(
            createBeneficiaryCityForm
          );
          if (!createdCity) return;

          setClientForm((prev) => ({
            ...prev,
            beneficiary: applyCitySelection(
              prev.beneficiary,
              createdCity._id,
              cityById
            ),
          }));

          setCreateBeneficiaryNewCity(false);
          setCreateBeneficiaryCityForm(emptyNewCityForm());
        }}
        showEditClientModal={showEditClientModal}
        setShowEditClientModal={setShowEditClientModal}
        updatingClient={updatingClient}
        handleUpdateClient={handleUpdateClient}
        editClientForm={editClientForm}
        setEditClientForm={setEditClientForm}
        updateEditClientProfile={updateEditClientProfile}
        editClientNewCity={editClientNewCity}
        setEditClientNewCity={setEditClientNewCity}
        editClientCityForm={editClientCityForm}
        setEditClientCityForm={setEditClientCityForm}
        onEditClientCity={async () => {
          const createdCity = await createCityAndRefresh(editClientCityForm);
          if (!createdCity) return;

          setEditClientForm((prev) => ({
            ...prev,
            profile: applyCitySelection(prev.profile, createdCity._id, cityById),
          }));

          setEditClientNewCity(false);
          setEditClientCityForm(emptyNewCityForm());
        }}
        showAddBeneficiaryModal={showAddBeneficiaryModal}
        setShowAddBeneficiaryModal={setShowAddBeneficiaryModal}
        savingBeneficiary={savingBeneficiary}
        handleAddBeneficiaryToSender={handleAddBeneficiaryToSender}
        beneficiaryForm={beneficiaryForm}
        setBeneficiaryForm={setBeneficiaryForm}
        onCreateBeneficiaryCity={async () => {
          const createdCity = await createCityAndRefresh(
            createBeneficiaryCityForm
          );
          if (!createdCity) return;

          setBeneficiaryForm((prev) =>
            applyCitySelection(prev, createdCity._id, cityById)
          );

          setCreateBeneficiaryNewCity(false);
          setCreateBeneficiaryCityForm(emptyNewCityForm());
        }}
        showEditBeneficiaryModal={showEditBeneficiaryModal}
        setShowEditBeneficiaryModal={setShowEditBeneficiaryModal}
        updatingBeneficiary={updatingBeneficiary}
        handleUpdateBeneficiary={handleUpdateBeneficiary}
        editBeneficiaryForm={editBeneficiaryForm}
        setEditBeneficiaryForm={setEditBeneficiaryForm}
        editBeneficiaryNewCity={editBeneficiaryNewCity}
        setEditBeneficiaryNewCity={setEditBeneficiaryNewCity}
        editBeneficiaryCityForm={editBeneficiaryCityForm}
        setEditBeneficiaryCityForm={setEditBeneficiaryCityForm}
        onEditBeneficiaryCity={async () => {
          const createdCity = await createCityAndRefresh(
            editBeneficiaryCityForm
          );
          if (!createdCity) return;

          setEditBeneficiaryForm((prev) =>
            applyCitySelection(prev, createdCity._id, cityById)
          );

          setEditBeneficiaryNewCity(false);
          setEditBeneficiaryCityForm(emptyNewCityForm());
        }}
      />
    </div>
  );
}