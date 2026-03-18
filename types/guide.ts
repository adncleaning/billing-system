export type EntityType = "PERSON" | "COMPANY";

export type PersonPayload = {
  entityType: EntityType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  identification?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  addressLine?: string;
  cityId?: string | null;
  cityLabel?: string;
  zipCode?: string;
  location?: string;
  relationship?: string;
};

export interface Client {
  _id: string;
  agency?: string;
  profile: PersonPayload;
  beneficiaries: PersonPayload[];
  isActive: boolean;
}

export interface City {
  _id: string;
  label: string;
  country: string;
  postalCode?: string | null;
  isActive: boolean;
}

export interface TariffRange {
  min: number;
  max: number;
  price: number;
  cost: number;
  applyDeclaredValue?: boolean;
}

export interface Tariff {
  _id: string;
  name: string;
  country?: string;
  type?: string;
  measure?: string;
  ranges?: TariffRange[];
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  client: string | { _id: string; name?: string; email?: string };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  status?: string;
  itemsCount?: number;
  totalDeclaredValue?: number;
  guide?: string | null;
  guideId?: string | null;
  guideRef?: string | null;
}

export type ServiceRow = {
  id: string;
  included: boolean;
  name: string;
  measure: string;
  price: number;
  quantity: number;
};

export type PackageRow = {
  id: string;
  invoiceId?: string | null;
  description: string;
  value: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  pcs: number;
  items?: InvoiceItem[];
};

export type InvoiceMode = "ECUADOR" | "COLOMBIA";