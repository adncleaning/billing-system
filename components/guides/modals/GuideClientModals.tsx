"use client";

import type React from "react";
import Modal from "@/components/Modal";
import NewCityFields from "@/components/guides/shared/NewCityFields";
import type { City, EntityType, PersonPayload } from "@/types/guide";
import { applyCitySelection } from "@/utils/guideHelpers";

type ClientFormState = {
  agency: string;
  profile: PersonPayload;
  beneficiary: PersonPayload;
};

type EditClientFormState = {
  agency: string;
  profile: PersonPayload;
};

type NewCityForm = {
  label: string;
  country: string;
  postalCode: string;
};

type Props = {
  cities: City[];
  cityById: Map<string, City>;
  loadingCities: boolean;
  savingNewCity: boolean;
  emptyNewCityForm: () => NewCityForm;

  showCreateClientModal: boolean;
  setShowCreateClientModal: (value: boolean) => void;
  creatingClient: boolean;
  handleCreateClient: (e: React.FormEvent) => void;
  addBeneficiaryNow: boolean;
  setAddBeneficiaryNow: (value: boolean) => void;
  clientForm: ClientFormState;
  setClientForm: React.Dispatch<React.SetStateAction<ClientFormState>>;
  updateClientProfile: (patch: Partial<PersonPayload>) => void;
  updateClientBeneficiary: (patch: Partial<PersonPayload>) => void;
  createClientNewCity: boolean;
  setCreateClientNewCity: React.Dispatch<React.SetStateAction<boolean>>;
  createClientCityForm: NewCityForm;
  setCreateClientCityForm: React.Dispatch<React.SetStateAction<NewCityForm>>;
  createBeneficiaryNewCity: boolean;
  setCreateBeneficiaryNewCity: React.Dispatch<React.SetStateAction<boolean>>;
  createBeneficiaryCityForm: NewCityForm;
  setCreateBeneficiaryCityForm: React.Dispatch<React.SetStateAction<NewCityForm>>;
  onCreateClientCity: () => Promise<void>;
  onCreateBeneficiaryCityForClient: () => Promise<void>;

  showEditClientModal: boolean;
  setShowEditClientModal: (value: boolean) => void;
  updatingClient: boolean;
  handleUpdateClient: (e: React.FormEvent) => void;
  editClientForm: EditClientFormState;
  setEditClientForm: React.Dispatch<React.SetStateAction<EditClientFormState>>;
  updateEditClientProfile: (patch: Partial<PersonPayload>) => void;
  editClientNewCity: boolean;
  setEditClientNewCity: React.Dispatch<React.SetStateAction<boolean>>;
  editClientCityForm: NewCityForm;
  setEditClientCityForm: React.Dispatch<React.SetStateAction<NewCityForm>>;
  onEditClientCity: () => Promise<void>;

  showAddBeneficiaryModal: boolean;
  setShowAddBeneficiaryModal: (value: boolean) => void;
  savingBeneficiary: boolean;
  handleAddBeneficiaryToSender: (e: React.FormEvent) => void;
  beneficiaryForm: PersonPayload;
  setBeneficiaryForm: React.Dispatch<React.SetStateAction<PersonPayload>>;
  onCreateBeneficiaryCity: () => Promise<void>;

  showEditBeneficiaryModal: boolean;
  setShowEditBeneficiaryModal: (value: boolean) => void;
  updatingBeneficiary: boolean;
  handleUpdateBeneficiary: (e: React.FormEvent) => void;
  editBeneficiaryForm: PersonPayload;
  setEditBeneficiaryForm: React.Dispatch<React.SetStateAction<PersonPayload>>;
  editBeneficiaryNewCity: boolean;
  setEditBeneficiaryNewCity: React.Dispatch<React.SetStateAction<boolean>>;
  editBeneficiaryCityForm: NewCityForm;
  setEditBeneficiaryCityForm: React.Dispatch<React.SetStateAction<NewCityForm>>;
  onEditBeneficiaryCity: () => Promise<void>;
};

export default function GuideClientModals(props: Props) {
  const {
    cities,
    cityById,
    loadingCities,
    savingNewCity,
    emptyNewCityForm,

    showCreateClientModal,
    setShowCreateClientModal,
    creatingClient,
    handleCreateClient,
    addBeneficiaryNow,
    setAddBeneficiaryNow,
    clientForm,
    setClientForm,
    updateClientProfile,
    updateClientBeneficiary,
    createClientNewCity,
    setCreateClientNewCity,
    createClientCityForm,
    setCreateClientCityForm,
    createBeneficiaryNewCity,
    setCreateBeneficiaryNewCity,
    createBeneficiaryCityForm,
    setCreateBeneficiaryCityForm,
    onCreateClientCity,
    onCreateBeneficiaryCityForClient,

    showEditClientModal,
    setShowEditClientModal,
    updatingClient,
    handleUpdateClient,
    editClientForm,
    setEditClientForm,
    updateEditClientProfile,
    editClientNewCity,
    setEditClientNewCity,
    editClientCityForm,
    setEditClientCityForm,
    onEditClientCity,

    showAddBeneficiaryModal,
    setShowAddBeneficiaryModal,
    savingBeneficiary,
    handleAddBeneficiaryToSender,
    beneficiaryForm,
    setBeneficiaryForm,
    onCreateBeneficiaryCity,

    showEditBeneficiaryModal,
    setShowEditBeneficiaryModal,
    updatingBeneficiary,
    handleUpdateBeneficiary,
    editBeneficiaryForm,
    setEditBeneficiaryForm,
    editBeneficiaryNewCity,
    setEditBeneficiaryNewCity,
    editBeneficiaryCityForm,
    setEditBeneficiaryCityForm,
    onEditBeneficiaryCity,
  } = props;

  return (
    <>
      <Modal isOpen={showCreateClientModal} onClose={() => setShowCreateClientModal(false)} title="Create New Client" size="large">
        <form onSubmit={handleCreateClient} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Entity type</label>
                <select
                  className="input"
                  value={clientForm.profile.entityType}
                  onChange={(e) =>
                    updateClientProfile({ entityType: e.target.value as EntityType })
                  }
                >
                  <option value="PERSON">Person</option>
                  <option value="COMPANY">Company</option>
                </select>
              </div>

              {clientForm.profile.entityType === "PERSON" ? (
                <>
                  <div>
                    <label className="label">First name *</label>
                    <input
                      className="input"
                      value={clientForm.profile.firstName || ""}
                      onChange={(e) => updateClientProfile({ firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Last name *</label>
                    <input
                      className="input"
                      value={clientForm.profile.lastName || ""}
                      onChange={(e) => updateClientProfile({ lastName: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="label">Company name *</label>
                  <input
                    className="input"
                    value={clientForm.profile.companyName || ""}
                    onChange={(e) => updateClientProfile({ companyName: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={clientForm.profile.email || ""}
                  onChange={(e) => updateClientProfile({ email: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Identification</label>
                <input
                  className="input"
                  value={clientForm.profile.identification || ""}
                  onChange={(e) => updateClientProfile({ identification: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={clientForm.profile.phone || ""}
                  onChange={(e) => updateClientProfile({ phone: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Mobile</label>
                <input
                  className="input"
                  value={clientForm.profile.mobile || ""}
                  onChange={(e) => updateClientProfile({ mobile: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="label">Address *</label>
                <textarea
                  className="input min-h-[90px]"
                  value={clientForm.profile.addressLine || ""}
                  onChange={(e) => updateClientProfile({ addressLine: e.target.value })}
                />
              </div>

              <div>
                <label className="label">City</label>
                <select
                  className="input"
                  value={clientForm.profile.cityId || ""}
                  disabled={loadingCities}
                  onChange={(e) => {
                    const cityId = e.target.value;
                    setClientForm((p) => ({
                      ...p,
                      profile: applyCitySelection(p.profile, cityId, cityById),
                    }));
                  }}
                >
                  <option value="">Choose...</option>
                  {cities.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.label} {c.country ? `(${c.country})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">ZIP Code</label>
                <input
                  className="input"
                  value={clientForm.profile.zipCode || ""}
                  onChange={(e) => updateClientProfile({ zipCode: e.target.value })}
                />
              </div>

              <NewCityFields
                checked={createClientNewCity}
                setChecked={setCreateClientNewCity}
                form={createClientCityForm}
                setForm={setCreateClientCityForm}
                savingNewCity={savingNewCity}
                emptyNewCityForm={emptyNewCityForm}
                className="col-span-2"
                onSaveCity={onCreateClientCity}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="addBeneficiaryNow"
              type="checkbox"
              checked={addBeneficiaryNow}
              onChange={(e) => setAddBeneficiaryNow(e.target.checked)}
            />
            <label htmlFor="addBeneficiaryNow" className="text-sm text-gray-700">
              Add beneficiary now
            </label>
          </div>

          {addBeneficiaryNow && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Beneficiary</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Entity type</label>
                  <select
                    className="input"
                    value={clientForm.beneficiary.entityType}
                    onChange={(e) =>
                      updateClientBeneficiary({ entityType: e.target.value as EntityType })
                    }
                  >
                    <option value="PERSON">Person</option>
                    <option value="COMPANY">Company</option>
                  </select>
                </div>

                {clientForm.beneficiary.entityType === "PERSON" ? (
                  <>
                    <div>
                      <label className="label">First name *</label>
                      <input
                        className="input"
                        value={clientForm.beneficiary.firstName || ""}
                        onChange={(e) => updateClientBeneficiary({ firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Last name *</label>
                      <input
                        className="input"
                        value={clientForm.beneficiary.lastName || ""}
                        onChange={(e) => updateClientBeneficiary({ lastName: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="label">Company name *</label>
                    <input
                      className="input"
                      value={clientForm.beneficiary.companyName || ""}
                      onChange={(e) => updateClientBeneficiary({ companyName: e.target.value })}
                    />
                  </div>
                )}

                <div>
                  <label className="label">Relationship</label>
                  <input
                    className="input"
                    value={clientForm.beneficiary.relationship || ""}
                    onChange={(e) => updateClientBeneficiary({ relationship: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={clientForm.beneficiary.email || ""}
                    onChange={(e) => updateClientBeneficiary({ email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Phone</label>
                  <input
                    className="input"
                    value={clientForm.beneficiary.phone || ""}
                    onChange={(e) => updateClientBeneficiary({ phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Mobile</label>
                  <input
                    className="input"
                    value={clientForm.beneficiary.mobile || ""}
                    onChange={(e) => updateClientBeneficiary({ mobile: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="label">Identification</label>
                  <input
                    className="input"
                    value={clientForm.beneficiary.identification || ""}
                    onChange={(e) =>
                      updateClientBeneficiary({ identification: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-2">
                  <label className="label">Address *</label>
                  <textarea
                    className="input min-h-[90px]"
                    value={clientForm.beneficiary.addressLine || ""}
                    onChange={(e) => updateClientBeneficiary({ addressLine: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">City</label>
                  <select
                    className="input"
                    value={clientForm.beneficiary.cityId || ""}
                    disabled={loadingCities}
                    onChange={(e) => {
                      const cityId = e.target.value;
                      setClientForm((p) => ({
                        ...p,
                        beneficiary: applyCitySelection(p.beneficiary, cityId, cityById),
                      }));
                    }}
                  >
                    <option value="">Choose...</option>
                    {cities.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">ZIP Code</label>
                  <input
                    className="input"
                    value={clientForm.beneficiary.zipCode || ""}
                    onChange={(e) => updateClientBeneficiary({ zipCode: e.target.value })}
                  />
                </div>

                <NewCityFields
                  checked={createBeneficiaryNewCity}
                  setChecked={setCreateBeneficiaryNewCity}
                  form={createBeneficiaryCityForm}
                  setForm={setCreateBeneficiaryCityForm}
                  savingNewCity={savingNewCity}
                  emptyNewCityForm={emptyNewCityForm}
                  className="col-span-2"
                  onSaveCity={onCreateBeneficiaryCityForClient}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowCreateClientModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={creatingClient} className="btn-primary">
              {creatingClient ? "Saving..." : "Create Client"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditClientModal} onClose={() => setShowEditClientModal(false)} title="Edit Client" size="large">
        <form onSubmit={handleUpdateClient} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Entity type</label>
                <select
                  className="input"
                  value={editClientForm.profile.entityType}
                  onChange={(e) =>
                    updateEditClientProfile({ entityType: e.target.value as EntityType })
                  }
                >
                  <option value="PERSON">Person</option>
                  <option value="COMPANY">Company</option>
                </select>
              </div>

              {editClientForm.profile.entityType === "PERSON" ? (
                <>
                  <div>
                    <label className="label">First name *</label>
                    <input
                      className="input"
                      value={editClientForm.profile.firstName || ""}
                      onChange={(e) => updateEditClientProfile({ firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Last name *</label>
                    <input
                      className="input"
                      value={editClientForm.profile.lastName || ""}
                      onChange={(e) => updateEditClientProfile({ lastName: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="label">Company name *</label>
                  <input
                    className="input"
                    value={editClientForm.profile.companyName || ""}
                    onChange={(e) => updateEditClientProfile({ companyName: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={editClientForm.profile.email || ""}
                  onChange={(e) => updateEditClientProfile({ email: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Identification</label>
                <input
                  className="input"
                  value={editClientForm.profile.identification || ""}
                  onChange={(e) => updateEditClientProfile({ identification: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={editClientForm.profile.phone || ""}
                  onChange={(e) => updateEditClientProfile({ phone: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Mobile</label>
                <input
                  className="input"
                  value={editClientForm.profile.mobile || ""}
                  onChange={(e) => updateEditClientProfile({ mobile: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="label">Address *</label>
                <textarea
                  className="input min-h-[90px]"
                  value={editClientForm.profile.addressLine || ""}
                  onChange={(e) => updateEditClientProfile({ addressLine: e.target.value })}
                />
              </div>

              <div>
                <label className="label">City</label>
                <select
                  className="input"
                  value={editClientForm.profile.cityId || ""}
                  disabled={loadingCities}
                  onChange={(e) => {
                    const cityId = e.target.value;
                    setEditClientForm((p) => ({
                      ...p,
                      profile: applyCitySelection(p.profile, cityId, cityById),
                    }));
                  }}
                >
                  <option value="">Choose...</option>
                  {cities.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">ZIP Code</label>
                <input
                  className="input"
                  value={editClientForm.profile.zipCode || ""}
                  onChange={(e) => updateEditClientProfile({ zipCode: e.target.value })}
                />
              </div>

              <NewCityFields
                checked={editClientNewCity}
                setChecked={setEditClientNewCity}
                form={editClientCityForm}
                setForm={setEditClientCityForm}
                savingNewCity={savingNewCity}
                emptyNewCityForm={emptyNewCityForm}
                className="col-span-2"
                onSaveCity={onEditClientCity}
              />

              <div className="mt-3 text-xs text-gray-500 col-span-2">
                * Nota: Los beneficiarios no se editan aquí. Para editar un beneficiario usa “Edit beneficiary”.
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowEditClientModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={updatingClient} className="btn-primary">
              {updatingClient ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showAddBeneficiaryModal} onClose={() => setShowAddBeneficiaryModal(false)} title="Add Beneficiary" size="large">
        <form onSubmit={handleAddBeneficiaryToSender} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Entity type</label>
              <select
                className="input"
                value={beneficiaryForm.entityType}
                onChange={(e) =>
                  setBeneficiaryForm((p) => ({ ...p, entityType: e.target.value as EntityType }))
                }
              >
                <option value="PERSON">Person</option>
                <option value="COMPANY">Company</option>
              </select>
            </div>

            {beneficiaryForm.entityType === "PERSON" ? (
              <>
                <div>
                  <label className="label">First name *</label>
                  <input
                    className="input"
                    value={beneficiaryForm.firstName || ""}
                    onChange={(e) => setBeneficiaryForm((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Last name *</label>
                  <input
                    className="input"
                    value={beneficiaryForm.lastName || ""}
                    onChange={(e) => setBeneficiaryForm((p) => ({ ...p, lastName: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="label">Company name *</label>
                <input
                  className="input"
                  value={beneficiaryForm.companyName || ""}
                  onChange={(e) => setBeneficiaryForm((p) => ({ ...p, companyName: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="label">Relationship</label>
              <input
                className="input"
                value={beneficiaryForm.relationship || ""}
                onChange={(e) =>
                  setBeneficiaryForm((p) => ({ ...p, relationship: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={beneficiaryForm.email || ""}
                onChange={(e) => setBeneficiaryForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={beneficiaryForm.phone || ""}
                onChange={(e) => setBeneficiaryForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Mobile</label>
              <input
                className="input"
                value={beneficiaryForm.mobile || ""}
                onChange={(e) => setBeneficiaryForm((p) => ({ ...p, mobile: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="label">Identification</label>
              <input
                className="input"
                value={beneficiaryForm.identification || ""}
                onChange={(e) =>
                  setBeneficiaryForm((p) => ({ ...p, identification: e.target.value }))
                }
              />
            </div>

            <div className="col-span-2">
              <label className="label">Address *</label>
              <textarea
                className="input min-h-[90px]"
                value={beneficiaryForm.addressLine || ""}
                onChange={(e) =>
                  setBeneficiaryForm((p) => ({ ...p, addressLine: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="label">City</label>
              <select
                className="input"
                value={beneficiaryForm.cityId || ""}
                disabled={loadingCities}
                onChange={(e) => {
                  const cityId = e.target.value;
                  setBeneficiaryForm((p) => applyCitySelection(p, cityId, cityById));
                }}
              >
                <option value="">Choose...</option>
                {cities.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">ZIP Code</label>
              <input
                className="input"
                value={beneficiaryForm.zipCode || ""}
                onChange={(e) => setBeneficiaryForm((p) => ({ ...p, zipCode: e.target.value }))}
              />
            </div>

            <NewCityFields
              checked={createBeneficiaryNewCity}
              setChecked={setCreateBeneficiaryNewCity}
              form={createBeneficiaryCityForm}
              setForm={setCreateBeneficiaryCityForm}
              savingNewCity={savingNewCity}
              emptyNewCityForm={emptyNewCityForm}
              className="col-span-2"
              onSaveCity={onCreateBeneficiaryCity}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowAddBeneficiaryModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={savingBeneficiary} className="btn-primary">
              {savingBeneficiary ? "Saving..." : "Add Beneficiary"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditBeneficiaryModal} onClose={() => setShowEditBeneficiaryModal(false)} title="Edit Beneficiary" size="large">
        <form onSubmit={handleUpdateBeneficiary} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Entity type</label>
              <select
                className="input"
                value={editBeneficiaryForm.entityType}
                onChange={(e) =>
                  setEditBeneficiaryForm((p) => ({
                    ...p,
                    entityType: e.target.value as EntityType,
                  }))
                }
              >
                <option value="PERSON">Person</option>
                <option value="COMPANY">Company</option>
              </select>
            </div>

            {editBeneficiaryForm.entityType === "PERSON" ? (
              <>
                <div>
                  <label className="label">First name *</label>
                  <input
                    className="input"
                    value={editBeneficiaryForm.firstName || ""}
                    onChange={(e) =>
                      setEditBeneficiaryForm((p) => ({ ...p, firstName: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Last name *</label>
                  <input
                    className="input"
                    value={editBeneficiaryForm.lastName || ""}
                    onChange={(e) =>
                      setEditBeneficiaryForm((p) => ({ ...p, lastName: e.target.value }))
                    }
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="label">Company name *</label>
                <input
                  className="input"
                  value={editBeneficiaryForm.companyName || ""}
                  onChange={(e) =>
                    setEditBeneficiaryForm((p) => ({ ...p, companyName: e.target.value }))
                  }
                />
              </div>
            )}

            <div>
              <label className="label">Relationship</label>
              <input
                className="input"
                value={editBeneficiaryForm.relationship || ""}
                onChange={(e) =>
                  setEditBeneficiaryForm((p) => ({ ...p, relationship: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={editBeneficiaryForm.email || ""}
                onChange={(e) =>
                  setEditBeneficiaryForm((p) => ({ ...p, email: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={editBeneficiaryForm.phone || ""}
                onChange={(e) =>
                  setEditBeneficiaryForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="label">Mobile</label>
              <input
                className="input"
                value={editBeneficiaryForm.mobile || ""}
                onChange={(e) =>
                  setEditBeneficiaryForm((p) => ({ ...p, mobile: e.target.value }))
                }
              />
            </div>

            <div className="col-span-2">
              <label className="label">Identification</label>
              <input
                className="input"
                value={editBeneficiaryForm.identification || ""}
                onChange={(e) =>
                  setEditBeneficiaryForm((p) => ({ ...p, identification: e.target.value }))
                }
              />
            </div>

            <div className="col-span-2">
              <label className="label">Address *</label>
              <textarea
                className="input min-h-[90px]"
                value={editBeneficiaryForm.addressLine || ""}
                onChange={(e) =>
                  setEditBeneficiaryForm((p) => ({ ...p, addressLine: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="label">City</label>
              <select
                className="input"
                value={editBeneficiaryForm.cityId || ""}
                disabled={loadingCities}
                onChange={(e) => {
                  const cityId = e.target.value;
                  setEditBeneficiaryForm((p) => applyCitySelection(p, cityId, cityById));
                }}
              >
                <option value="">Choose...</option>
                {cities.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">ZIP Code</label>
              <input
                className="input"
                value={editBeneficiaryForm.zipCode || ""}
                onChange={(e) =>
                  setEditBeneficiaryForm((p) => ({ ...p, zipCode: e.target.value }))
                }
              />
            </div>

            <NewCityFields
              checked={editBeneficiaryNewCity}
              setChecked={setEditBeneficiaryNewCity}
              form={editBeneficiaryCityForm}
              setForm={setEditBeneficiaryCityForm}
              savingNewCity={savingNewCity}
              emptyNewCityForm={emptyNewCityForm}
              className="col-span-2"
              onSaveCity={onEditBeneficiaryCity}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowEditBeneficiaryModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={updatingBeneficiary} className="btn-primary">
              {updatingBeneficiary ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}