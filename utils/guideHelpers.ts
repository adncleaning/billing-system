import type { City, Client, PackageRow, PersonPayload } from "@/types/guide";

export const VOLUMETRIC_DIVISOR = 5000;

export const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const emptyPerson = (): PersonPayload => ({
  entityType: "PERSON",
  firstName: "",
  lastName: "",
  companyName: "",
  identification: "",
  email: "",
  phone: "",
  mobile: "",
  addressLine: "",
  cityId: null,
  cityLabel: "",
  zipCode: "",
  location: "",
});

export const emptyBeneficiary = (): PersonPayload => ({
  ...emptyPerson(),
  relationship: "",
});

export const emptyNewCityForm = () => ({
  label: "",
  country: "",
  postalCode: "",
});

export const normalizePerson = (p: any): PersonPayload => {
  const base = emptyPerson();
  if (!p) return base;

  if (p.entityType) return { ...base, ...p };

  const fullName = (p.name || "").toString().trim();
  const parts = fullName.split(" ").filter(Boolean);

  return {
    ...base,
    entityType: "PERSON",
    firstName: (parts[0] || "").trim(),
    lastName: parts.slice(1).join(" ").trim(),
    companyName: "",
    email: (p.email || "").toString(),
    phone: (p.phone || "").toString(),
    identification: (p.identification || "").toString(),
    addressLine: [p.address?.street || "", p.address?.city || "", p.address?.state || ""]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    zipCode: (p.address?.zipCode || p.zipCode || "").toString(),
    cityLabel: (p.cityLabel || p.address?.city || "").toString(),
    cityId: p.cityId ?? null,
    mobile: (p.mobile || "").toString(),
    location: (p.location || "").toString(),
  };
};

export const normalizeClient = (c: any): Client => {
  if (c?.profile) {
    return {
      ...c,
      profile: normalizePerson(c.profile),
      beneficiaries: Array.isArray(c.beneficiaries) ? c.beneficiaries.map(normalizePerson) : [],
    };
  }

  return {
    ...c,
    profile: normalizePerson(c),
    beneficiaries: Array.isArray(c?.beneficiaries) ? c.beneficiaries.map(normalizePerson) : [],
  };
};

export const displayPersonName = (p?: PersonPayload | null) => {
  if (!p) return "—";
  if (p.entityType === "COMPANY") return (p.companyName || "Company").trim();
  const full = `${p.firstName || ""} ${p.lastName || ""}`.trim();
  return full || "Person";
};

export const displayClientLabel = (c: any) => {
  const client = normalizeClient(c);
  const p = client.profile;
  const main = displayPersonName(p);
  const contact = (p.email || p.phone || p.mobile || "").trim();
  return contact ? `${main} — ${contact}` : main;
};

export const volumetricWeight = (p: PackageRow) => {
  const l = toNum(p.length);
  const w = toNum(p.width);
  const h = toNum(p.height);
  if (!l || !w || !h) return 0;
  return Number(((l * w * h) / VOLUMETRIC_DIVISOR).toFixed(2));
};

export const packageChargeableWeight = (p: PackageRow) => {
  const real = toNum(p.weight);
  const vol = volumetricWeight(p);
  return Math.max(real, vol);
};

export const isPersonNameValid = (p: PersonPayload) => {
  if (p.entityType === "COMPANY") return !!p.companyName?.trim();
  return !!p.firstName?.trim() || !!p.lastName?.trim();
};

export const applyCitySelection = (
  person: PersonPayload,
  cityId: string,
  cityById: Map<string, City>
) => {
  const city = cityById.get(cityId);
  if (!city) {
    return {
      ...person,
      cityId: cityId || null,
      cityLabel: "",
    };
  }

  return {
    ...person,
    cityId: city._id,
    cityLabel: city.label,
    zipCode: (city.postalCode || "").toString(),
  };
};