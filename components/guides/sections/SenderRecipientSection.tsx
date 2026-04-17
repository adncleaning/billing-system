"use client";

import { Plus, Search, Pencil, MapPin } from "lucide-react";
import type { Client, PersonPayload } from "@/types/guide";
import { displayClientLabel, displayPersonName } from "@/utils/guideHelpers";

type Props = {
  senderSearch: string;
  setSenderSearch: (value: string) => void;
  senderClientId: string;
  setSenderClientId: (value: string) => void;
  senderClient: Client | null;
  filteredClients: Client[];
  loadingClients: boolean;

  beneficiaryIndex: number;
  setBeneficiaryIndex: (value: number) => void;
  beneficiaryPreview: PersonPayload | null;

  useClientAsBeneficiary: boolean;
  setUseClientAsBeneficiary: (value: boolean) => void;
  beneficiaryFromClientId: string;
  setBeneficiaryFromClientId: (value: string) => void;
  beneficiaryClientSearch: string;
  setBeneficiaryClientSearch: (value: string) => void;
  filteredBeneficiaryClients: Client[];

  onOpenEditClient: () => void;
  onOpenCreateClient: () => void;
  onOpenEditBeneficiary: () => void;
  onOpenAddBeneficiary: () => void;
};

function renderAddress(person?: PersonPayload | null) {
  if (!person) return "—";

  const parts = [
    (person.addressLine || "").trim(),
    (person.cityLabel || "").trim(),
    (person.zipCode || "").trim(),
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : "—";
}

export default function SenderRecipientSection({
  senderSearch,
  setSenderSearch,
  senderClientId,
  setSenderClientId,
  senderClient,
  filteredClients,
  loadingClients,

  beneficiaryIndex,
  setBeneficiaryIndex,
  beneficiaryPreview,

  useClientAsBeneficiary,
  setUseClientAsBeneficiary,
  beneficiaryFromClientId,
  setBeneficiaryFromClientId,
  beneficiaryClientSearch,
  setBeneficiaryClientSearch,
  filteredBeneficiaryClients,

  onOpenEditClient,
  onOpenCreateClient,
  onOpenEditBeneficiary,
  onOpenAddBeneficiary,
}: Props) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900">Remitente *</h2>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenEditClient}
              className="btn-outline text-sm flex items-center"
              disabled={!senderClientId || !senderClient}
              title="Edit selected client"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit client
            </button>

            <button
              type="button"
              onClick={onOpenCreateClient}
              className="btn-outline text-sm flex items-center"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add client
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative w-full">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={senderSearch}
              onChange={(e) => setSenderSearch(e.target.value)}
              className="input pl-9"
              placeholder="Search client by name, email, phone..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select client
          </label>
          <select
            className="input"
            value={senderClientId}
            onChange={(e) => setSenderClientId(e.target.value)}
            disabled={loadingClients}
          >
            <option value="">Choose...</option>
            {filteredClients.map((c) => (
              <option key={c._id} value={c._id}>
                {displayClientLabel(c)}
              </option>
            ))}
          </select>
        </div>

        {senderClient && (
          <div className="mt-4 text-sm text-gray-700 space-y-1">
            <div className="font-medium text-base">
              {displayPersonName(senderClient.profile)}
            </div>

            {!!senderClient.profile.email && <div>{senderClient.profile.email}</div>}
            {!!senderClient.profile.phone && <div>{senderClient.profile.phone}</div>}
            {!!senderClient.profile.mobile && <div>{senderClient.profile.mobile}</div>}
            {!!senderClient.profile.identification && (
              <div>ID: {senderClient.profile.identification}</div>
            )}

            <div className="text-gray-500 flex items-start gap-2 pt-1">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{renderAddress(senderClient.profile)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900">Destinatario *</h2>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenEditBeneficiary}
              className="btn-outline text-sm flex items-center"
              disabled={
                !senderClientId ||
                !beneficiaryPreview ||
                useClientAsBeneficiary
              }
              title={
                useClientAsBeneficiary
                  ? "Edit beneficiary is only available for sender beneficiaries"
                  : "Edit selected beneficiary"
              }
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit beneficiary
            </button>

            <button
              type="button"
              onClick={onOpenAddBeneficiary}
              className="btn-outline text-sm flex items-center"
              disabled={!senderClientId || useClientAsBeneficiary}
              title={
                useClientAsBeneficiary
                  ? "Disable this option to add a beneficiary to the sender"
                  : "Add beneficiary"
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Add beneficiary
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <input
            id="use-client-as-beneficiary"
            type="checkbox"
            checked={useClientAsBeneficiary}
            onChange={(e) => {
              const checked = e.target.checked;
              setUseClientAsBeneficiary(checked);
              if (!checked) {
                setBeneficiaryFromClientId("");
                setBeneficiaryClientSearch("");
              }
            }}
            disabled={!senderClientId}
          />
          <label
            htmlFor="use-client-as-beneficiary"
            className="text-sm text-gray-700"
          >
            Use another client record as beneficiary
          </label>
        </div>

        {useClientAsBeneficiary ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-full">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={beneficiaryClientSearch}
                  onChange={(e) => setBeneficiaryClientSearch(e.target.value)}
                  className="input pl-9"
                  placeholder="Search beneficiary client by name, email, phone..."
                  disabled={!senderClientId}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select client as beneficiary
              </label>
              <select
                className="input"
                value={beneficiaryFromClientId}
                onChange={(e) => setBeneficiaryFromClientId(e.target.value)}
                disabled={!senderClientId || loadingClients}
              >
                <option value="">Choose...</option>
                {filteredBeneficiaryClients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {displayClientLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beneficiary
            </label>
            <select
              className="input"
              value={beneficiaryIndex}
              onChange={(e) => setBeneficiaryIndex(Number(e.target.value))}
              disabled={!senderClient || !(senderClient.beneficiaries?.length > 0)}
            >
              {(senderClient?.beneficiaries || []).map((b, idx) => (
                <option key={idx} value={idx}>
                  #{idx + 1} — {displayPersonName(b)}{" "}
                  {b.relationship ? `(${b.relationship})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {beneficiaryPreview ? (
          <div className="mt-4 text-sm text-gray-700 space-y-1">
            <div className="font-medium text-base">
              {displayPersonName(beneficiaryPreview)}
            </div>
            {beneficiaryPreview.relationship && (
              <div>{beneficiaryPreview.relationship}</div>
            )}
            {beneficiaryPreview.phone && <div>{beneficiaryPreview.phone}</div>}
            {beneficiaryPreview.mobile && <div>{beneficiaryPreview.mobile}</div>}
            {beneficiaryPreview.email && <div>{beneficiaryPreview.email}</div>}
            {beneficiaryPreview.identification && (
              <div>ID: {beneficiaryPreview.identification}</div>
            )}

            <div className="text-gray-500 flex items-start gap-2 pt-1">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{renderAddress(beneficiaryPreview)}</span>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-gray-500">
            {useClientAsBeneficiary
              ? "Select another client as beneficiary."
              : "Select a sender with beneficiaries."}
          </div>
        )}
      </div>
    </div>
  );
}