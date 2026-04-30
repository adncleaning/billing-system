"use client";

import React from "react";
import Modal from "@/components/Modal";
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
  country: string;
  department: string;
  city: string;
  postalCode: string;
};

type LocationSelection = {
  country: string;
  department: string;
};

type CountryOption = {
  name: string;
  flag: string;
  dialCode: string;
};

type Props = {
  cities: City[];
  cityById: Map<string, City>;
  loadingCities: boolean;
  savingNewCity: boolean;

  countryOptions: CountryOption[];
  getDepartmentsByCountry: (country: string) => string[];
  getCitiesByCountryAndDepartment: (
    country: string,
    department: string
  ) => City[];

  emptyNewCityForm: () => NewCityForm;
  emptyLocationSelection: () => LocationSelection;

  createClientLocation: LocationSelection;
  setCreateClientLocation: React.Dispatch<
    React.SetStateAction<LocationSelection>
  >;
  createBeneficiaryLocation: LocationSelection;
  setCreateBeneficiaryLocation: React.Dispatch<
    React.SetStateAction<LocationSelection>
  >;
  editClientLocation: LocationSelection;
  setEditClientLocation: React.Dispatch<React.SetStateAction<LocationSelection>>;
  editBeneficiaryLocation: LocationSelection;
  setEditBeneficiaryLocation: React.Dispatch<
    React.SetStateAction<LocationSelection>
  >;

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
  setCreateBeneficiaryCityForm: React.Dispatch<
    React.SetStateAction<NewCityForm>
  >;
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

function parseStoredPhone(
  value: string | undefined,
  countryOptions: CountryOption[]
) {
  const raw = String(value || "").trim();

  for (const option of countryOptions) {
    if (raw.startsWith(option.dialCode)) {
      return {
        dialCode: option.dialCode,
        nationalNumber: raw.slice(option.dialCode.length).trim(),
      };
    }
  }

  return {
    dialCode: countryOptions[0]?.dialCode || "+57",
    nationalNumber: raw,
  };
}

function composeStoredPhone(dialCode: string, nationalNumber: string) {
  const num = String(nationalNumber || "").trim();
  if (!num) return "";
  return `${dialCode} ${num}`.trim();
}

function PhoneField({
  label,
  value,
  onChange,
  countryOptions,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  countryOptions: CountryOption[];
}) {
  const parsed = parseStoredPhone(value, countryOptions);

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <select
          className="input w-[150px]"
          value={parsed.dialCode}
          onChange={(e) =>
            onChange(composeStoredPhone(e.target.value, parsed.nationalNumber))
          }
        >
          {countryOptions.map((option) => (
            <option key={option.name} value={option.dialCode}>
              {option.flag} {option.dialCode}
            </option>
          ))}
        </select>

        <input
          className="input flex-1"
          value={parsed.nationalNumber}
          onChange={(e) =>
            onChange(composeStoredPhone(parsed.dialCode, e.target.value))
          }
          placeholder="Número"
        />
      </div>
    </div>
  );
}

function NewCityBlock({
  checked,
  setChecked,
  form,
  setForm,
  savingNewCity,
  emptyNewCityForm,
  onSaveCity,
  className = "",
  countryOptions,
}: {
  checked: boolean;
  setChecked: React.Dispatch<React.SetStateAction<boolean>>;
  form: NewCityForm;
  setForm: React.Dispatch<React.SetStateAction<NewCityForm>>;
  savingNewCity: boolean;
  emptyNewCityForm: () => NewCityForm;
  onSaveCity: () => Promise<void>;
  className?: string;
  countryOptions: CountryOption[];
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            const enabled = e.target.checked;
            setChecked(enabled);
            if (!enabled) setForm(emptyNewCityForm());
          }}
        />
        <label className="text-sm text-gray-700">
          City not found? Add a new one
        </label>
      </div>

      {checked && (
        <div className="mt-3 border rounded-lg p-4 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Country *</label>
            <select
              className="input w-full"
              value={form.country}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  country: e.target.value,
                }))
              }
            >
              <option value="">Choose...</option>
              {countryOptions.map((country) => (
                <option key={country.name} value={country.name}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Department *</label>
            <input
              className="input w-full"
              value={form.department}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, department: e.target.value }))
              }
              placeholder="e.g. Meta / Pichincha / Madrid / England"
            />
          </div>

          <div>
            <label className="label">City *</label>
            <input
              className="input w-full"
              value={form.city}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, city: e.target.value }))
              }
              placeholder="e.g. Medellín"
            />
          </div>

          <div>
            <label className="label">ZIP Code</label>
            <input
              className="input w-full"
              value={form.postalCode}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, postalCode: e.target.value }))
              }
              placeholder="e.g. 050001"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="button"
              className="btn-outline"
              onClick={onSaveCity}
              disabled={savingNewCity}
            >
              {savingNewCity ? "Saving city..." : "Save city"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationSelector({
  person,
  setPerson,
  location,
  setLocation,
  loadingCities,
  cities = [],
  cityById,
}: {
  person: PersonPayload;
  setPerson: (updater: (prev: PersonPayload) => PersonPayload) => void;
  location: LocationSelection;
  setLocation: React.Dispatch<React.SetStateAction<LocationSelection>>;
  loadingCities: boolean;
  cities?: City[];
  cityById: Map<string, City>;
}) {
  const [query, setQuery] = React.useState(person.cityLabel || "");
  const [open, setOpen] = React.useState(false);

  const filteredCities = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    return [...cities]
      // 🔥 FILTRO NUEVO (solo ciudades válidas)
      .filter((city) => city.city && city.department && city.country)

      // 🔍 filtro de búsqueda
      .filter((city) => {
        if (!q) return true;

        return [
          city.city,
          city.department,
          city.country,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })

      // 📊 orden
      .sort((a, b) => {
        const cityA = `${a.city} ${a.department}`.toLowerCase();
        const cityB = `${b.city} ${b.department}`.toLowerCase();
        return cityA.localeCompare(cityB);
      })

      .slice(0, 30);
  }, [cities, query]);

  const handleSelectCity = (city: City) => {
    setQuery(`${city.city}${city.department ? ` (${city.department})` : ""}`);

    setPerson((prev) => applyCitySelection(prev, city._id, cityById));

    setLocation({
      country: city.country || "",
      department: city.department || "",
    });

    setOpen(false);
  };

  return (
    <>
      <div className="col-span-2 relative">
        <label className="label">City</label>

        <input
          className="input w-full"
          value={query}
          disabled={loadingCities}
          placeholder="Buscar Ciudad"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);

            setPerson((prev) => ({
              ...prev,
              cityId: null,
              cityLabel: "",
              zipCode: "",
            }));

            setLocation({
              country: "",
              department: "",
            });
          }}
        />

        {open && (
          <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg">
            {filteredCities.length ? (
              filteredCities.map((city) => (
                <button
                  key={city._id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-600 hover:text-white"
                  onMouseDown={() => handleSelectCity(city)}
                >
                  {city.city}
                  {city.department ? ` (${city.department}` : ""}
                  {city.country ? `, ${city.country}` : ""}
                  {city.department ? ")" : ""}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No cities found
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="label">Country</label>
        <input
          className="input bg-gray-50"
          value={location.country || ""}
          readOnly
          placeholder="Auto-filled"
        />
      </div>

      <div>
        <label className="label">ZIP Code</label>
        <input
          className="input bg-gray-50"
          value={person.zipCode || ""}
          readOnly
          placeholder="Auto-filled"
        />
      </div>
    </>
  );
}

export default function GuideClientModals(props: Props) {
  const {
    cityById,
    loadingCities,
    savingNewCity,
    countryOptions,
    getDepartmentsByCountry,
    getCitiesByCountryAndDepartment,
    emptyNewCityForm,

    createClientLocation,
    setCreateClientLocation,
    createBeneficiaryLocation,
    setCreateBeneficiaryLocation,
    editClientLocation,
    setEditClientLocation,
    editBeneficiaryLocation,
    setEditBeneficiaryLocation,

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
      <Modal
        isOpen={showCreateClientModal}
        onClose={() => setShowCreateClientModal(false)}
        title="Create New Client"
        size="large"
      >
        <form onSubmit={handleCreateClient} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Client Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Entity type</label>
                <select
                  className="input"
                  value={clientForm.profile.entityType}
                  onChange={(e) =>
                    updateClientProfile({
                      entityType: e.target.value as EntityType,
                    })
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
                      onChange={(e) =>
                        updateClientProfile({ firstName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Last name *</label>
                    <input
                      className="input"
                      value={clientForm.profile.lastName || ""}
                      onChange={(e) =>
                        updateClientProfile({ lastName: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="label">Company name *</label>
                  <input
                    className="input"
                    value={clientForm.profile.companyName || ""}
                    onChange={(e) =>
                      updateClientProfile({ companyName: e.target.value })
                    }
                  />
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={clientForm.profile.email || ""}
                  onChange={(e) =>
                    updateClientProfile({ email: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="label">Identification</label>
                <input
                  className="input"
                  value={clientForm.profile.identification || ""}
                  onChange={(e) =>
                    updateClientProfile({ identification: e.target.value })
                  }
                />
              </div>

              <PhoneField
                label="Phone"
                value={clientForm.profile.phone}
                onChange={(value) => updateClientProfile({ phone: value })}
                countryOptions={countryOptions}
              />

              <PhoneField
                label="Mobile"
                value={clientForm.profile.mobile}
                onChange={(value) => updateClientProfile({ mobile: value })}
                countryOptions={countryOptions}
              />

              <div className="col-span-2">
                <label className="label">Address *</label>
                <textarea
                  className="input min-h-[90px]"
                  value={clientForm.profile.addressLine || ""}
                  onChange={(e) =>
                    updateClientProfile({ addressLine: e.target.value })
                  }
                />
              </div>

              <LocationSelector
                person={clientForm.profile}
                setPerson={(updater) =>
                  setClientForm((prev) => ({
                    ...prev,
                    profile: updater(prev.profile),
                  }))
                }
                location={createClientLocation}
                setLocation={setCreateClientLocation}
                loadingCities={loadingCities}
                cities={props.cities}
                cityById={cityById}
              />

              <NewCityBlock
                checked={createClientNewCity}
                setChecked={setCreateClientNewCity}
                form={createClientCityForm}
                setForm={setCreateClientCityForm}
                savingNewCity={savingNewCity}
                emptyNewCityForm={emptyNewCityForm}
                className="col-span-2"
                onSaveCity={onCreateClientCity}
                countryOptions={countryOptions}
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
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Beneficiary
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Entity type</label>
                  <select
                    className="input"
                    value={clientForm.beneficiary.entityType}
                    onChange={(e) =>
                      updateClientBeneficiary({
                        entityType: e.target.value as EntityType,
                      })
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
                        onChange={(e) =>
                          updateClientBeneficiary({ firstName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Last name *</label>
                      <input
                        className="input"
                        value={clientForm.beneficiary.lastName || ""}
                        onChange={(e) =>
                          updateClientBeneficiary({ lastName: e.target.value })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="label">Company name *</label>
                    <input
                      className="input"
                      value={clientForm.beneficiary.companyName || ""}
                      onChange={(e) =>
                        updateClientBeneficiary({
                          companyName: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                <div>
                  <label className="label">Relationship</label>
                  <input
                    className="input"
                    value={clientForm.beneficiary.relationship || ""}
                    onChange={(e) =>
                      updateClientBeneficiary({ relationship: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={clientForm.beneficiary.email || ""}
                    onChange={(e) =>
                      updateClientBeneficiary({ email: e.target.value })
                    }
                  />
                </div>

                <PhoneField
                  label="Phone"
                  value={clientForm.beneficiary.phone}
                  onChange={(value) =>
                    updateClientBeneficiary({ phone: value })
                  }
                  countryOptions={countryOptions}
                />

                <PhoneField
                  label="Mobile"
                  value={clientForm.beneficiary.mobile}
                  onChange={(value) =>
                    updateClientBeneficiary({ mobile: value })
                  }
                  countryOptions={countryOptions}
                />

                <div className="col-span-2">
                  <label className="label">Identification</label>
                  <input
                    className="input"
                    value={clientForm.beneficiary.identification || ""}
                    onChange={(e) =>
                      updateClientBeneficiary({
                        identification: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="col-span-2">
                  <label className="label">Address *</label>
                  <textarea
                    className="input min-h-[90px]"
                    value={clientForm.beneficiary.addressLine || ""}
                    onChange={(e) =>
                      updateClientBeneficiary({
                        addressLine: e.target.value,
                      })
                    }
                  />
                </div>

                <LocationSelector
                  person={clientForm.profile}
                  setPerson={(updater) =>
                    setClientForm((prev) => ({
                      ...prev,
                      profile: updater(prev.profile),
                    }))
                  }
                  location={createClientLocation}
                  setLocation={setCreateClientLocation}
                  loadingCities={loadingCities}
                  cities={props.cities}
                  cityById={cityById}
                />

                <NewCityBlock
                  checked={createBeneficiaryNewCity}
                  setChecked={setCreateBeneficiaryNewCity}
                  form={createBeneficiaryCityForm}
                  setForm={setCreateBeneficiaryCityForm}
                  savingNewCity={savingNewCity}
                  emptyNewCityForm={emptyNewCityForm}
                  className="col-span-2"
                  onSaveCity={onCreateBeneficiaryCityForClient}
                  countryOptions={countryOptions}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowCreateClientModal(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button type="submit" disabled={creatingClient} className="btn-primary">
              {creatingClient ? "Saving..." : "Create Client"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showEditClientModal}
        onClose={() => setShowEditClientModal(false)}
        title="Edit Client"
        size="large"
      >
        <form onSubmit={handleUpdateClient} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Client Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Entity type</label>
                <select
                  className="input"
                  value={editClientForm.profile.entityType}
                  onChange={(e) =>
                    updateEditClientProfile({
                      entityType: e.target.value as EntityType,
                    })
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
                      onChange={(e) =>
                        updateEditClientProfile({ firstName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Last name *</label>
                    <input
                      className="input"
                      value={editClientForm.profile.lastName || ""}
                      onChange={(e) =>
                        updateEditClientProfile({ lastName: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="label">Company name *</label>
                  <input
                    className="input"
                    value={editClientForm.profile.companyName || ""}
                    onChange={(e) =>
                      updateEditClientProfile({ companyName: e.target.value })
                    }
                  />
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={editClientForm.profile.email || ""}
                  onChange={(e) =>
                    updateEditClientProfile({ email: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="label">Identification</label>
                <input
                  className="input"
                  value={editClientForm.profile.identification || ""}
                  onChange={(e) =>
                    updateEditClientProfile({
                      identification: e.target.value,
                    })
                  }
                />
              </div>

              <PhoneField
                label="Phone"
                value={editClientForm.profile.phone}
                onChange={(value) => updateEditClientProfile({ phone: value })}
                countryOptions={countryOptions}
              />

              <PhoneField
                label="Mobile"
                value={editClientForm.profile.mobile}
                onChange={(value) => updateEditClientProfile({ mobile: value })}
                countryOptions={countryOptions}
              />

              <div className="col-span-2">
                <label className="label">Address *</label>
                <textarea
                  className="input min-h-[90px]"
                  value={editClientForm.profile.addressLine || ""}
                  onChange={(e) =>
                    updateEditClientProfile({ addressLine: e.target.value })
                  }
                />
              </div>

              <LocationSelector
                person={clientForm.profile}
                setPerson={(updater) =>
                  setClientForm((prev) => ({
                    ...prev,
                    profile: updater(prev.profile),
                  }))
                }
                location={createClientLocation}
                setLocation={setCreateClientLocation}
                loadingCities={loadingCities}
                cities={props.cities}
                cityById={cityById}
              />

              <NewCityBlock
                checked={editClientNewCity}
                setChecked={setEditClientNewCity}
                form={editClientCityForm}
                setForm={setEditClientCityForm}
                savingNewCity={savingNewCity}
                emptyNewCityForm={emptyNewCityForm}
                className="col-span-2"
                onSaveCity={onEditClientCity}
                countryOptions={countryOptions}
              />

              <div className="mt-3 text-xs text-gray-500 col-span-2">
                * Nota: Los beneficiarios no se editan aquí. Para editar un
                beneficiario usa “Edit beneficiary”.
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowEditClientModal(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button type="submit" disabled={updatingClient} className="btn-primary">
              {updatingClient ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showAddBeneficiaryModal}
        onClose={() => setShowAddBeneficiaryModal(false)}
        title="Add Beneficiary"
        size="large"
      >
        <form onSubmit={handleAddBeneficiaryToSender} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Entity type</label>
              <select
                className="input"
                value={beneficiaryForm.entityType}
                onChange={(e) =>
                  setBeneficiaryForm((p) => ({
                    ...p,
                    entityType: e.target.value as EntityType,
                  }))
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
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        firstName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Last name *</label>
                  <input
                    className="input"
                    value={beneficiaryForm.lastName || ""}
                    onChange={(e) =>
                      setBeneficiaryForm((p) => ({
                        ...p,
                        lastName: e.target.value,
                      }))
                    }
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="label">Company name *</label>
                <input
                  className="input"
                  value={beneficiaryForm.companyName || ""}
                  onChange={(e) =>
                    setBeneficiaryForm((p) => ({
                      ...p,
                      companyName: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div>
              <label className="label">Relationship</label>
              <input
                className="input"
                value={beneficiaryForm.relationship || ""}
                onChange={(e) =>
                  setBeneficiaryForm((p) => ({
                    ...p,
                    relationship: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={beneficiaryForm.email || ""}
                onChange={(e) =>
                  setBeneficiaryForm((p) => ({ ...p, email: e.target.value }))
                }
              />
            </div>

            <PhoneField
              label="Phone"
              value={beneficiaryForm.phone}
              onChange={(value) =>
                setBeneficiaryForm((p) => ({ ...p, phone: value }))
              }
              countryOptions={countryOptions}
            />

            <PhoneField
              label="Mobile"
              value={beneficiaryForm.mobile}
              onChange={(value) =>
                setBeneficiaryForm((p) => ({ ...p, mobile: value }))
              }
              countryOptions={countryOptions}
            />

            <div className="col-span-2">
              <label className="label">Identification</label>
              <input
                className="input"
                value={beneficiaryForm.identification || ""}
                onChange={(e) =>
                  setBeneficiaryForm((p) => ({
                    ...p,
                    identification: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-span-2">
              <label className="label">Address *</label>
              <textarea
                className="input min-h-[90px]"
                value={beneficiaryForm.addressLine || ""}
                onChange={(e) =>
                  setBeneficiaryForm((p) => ({
                    ...p,
                    addressLine: e.target.value,
                  }))
                }
              />
            </div>

            <LocationSelector
              person={clientForm.profile}
              setPerson={(updater) =>
                setClientForm((prev) => ({
                  ...prev,
                  profile: updater(prev.profile),
                }))
              }
              location={createClientLocation}
              setLocation={setCreateClientLocation}
              loadingCities={loadingCities}
              cities={props.cities}
              cityById={cityById}
            />

            <NewCityBlock
              checked={createBeneficiaryNewCity}
              setChecked={setCreateBeneficiaryNewCity}
              form={createBeneficiaryCityForm}
              setForm={setCreateBeneficiaryCityForm}
              savingNewCity={savingNewCity}
              emptyNewCityForm={emptyNewCityForm}
              className="col-span-2"
              onSaveCity={onCreateBeneficiaryCity}
              countryOptions={countryOptions}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowAddBeneficiaryModal(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingBeneficiary}
              className="btn-primary"
            >
              {savingBeneficiary ? "Saving..." : "Add Beneficiary"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showEditBeneficiaryModal}
        onClose={() => setShowEditBeneficiaryModal(false)}
        title="Edit Beneficiary"
        size="large"
      >
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
                      setEditBeneficiaryForm((p) => ({
                        ...p,
                        firstName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Last name *</label>
                  <input
                    className="input"
                    value={editBeneficiaryForm.lastName || ""}
                    onChange={(e) =>
                      setEditBeneficiaryForm((p) => ({
                        ...p,
                        lastName: e.target.value,
                      }))
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
                    setEditBeneficiaryForm((p) => ({
                      ...p,
                      companyName: e.target.value,
                    }))
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
                  setEditBeneficiaryForm((p) => ({
                    ...p,
                    relationship: e.target.value,
                  }))
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
                  setEditBeneficiaryForm((p) => ({
                    ...p,
                    email: e.target.value,
                  }))
                }
              />
            </div>

            <PhoneField
              label="Phone"
              value={editBeneficiaryForm.phone}
              onChange={(value) =>
                setEditBeneficiaryForm((p) => ({ ...p, phone: value }))
              }
              countryOptions={countryOptions}
            />

            <PhoneField
              label="Mobile"
              value={editBeneficiaryForm.mobile}
              onChange={(value) =>
                setEditBeneficiaryForm((p) => ({ ...p, mobile: value }))
              }
              countryOptions={countryOptions}
            />

            <div className="col-span-2">
              <label className="label">Identification</label>
              <input
                className="input"
                value={editBeneficiaryForm.identification || ""}
                onChange={(e) =>
                  setEditBeneficiaryForm((p) => ({
                    ...p,
                    identification: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-span-2">
              <label className="label">Address *</label>
              <textarea
                className="input min-h-[90px]"
                value={editBeneficiaryForm.addressLine || ""}
                onChange={(e) =>
                  setEditBeneficiaryForm((p) => ({
                    ...p,
                    addressLine: e.target.value,
                  }))
                }
              />
            </div>

            <LocationSelector
              person={editBeneficiaryForm}
              setPerson={(updater) =>
                setEditBeneficiaryForm((prev) => updater(prev))
              }
              location={editBeneficiaryLocation}
              setLocation={setEditBeneficiaryLocation}
              loadingCities={loadingCities}
              cities={props.cities}
              cityById={cityById}
            />

            <NewCityBlock
              checked={editBeneficiaryNewCity}
              setChecked={setEditBeneficiaryNewCity}
              form={editBeneficiaryCityForm}
              setForm={setEditBeneficiaryCityForm}
              savingNewCity={savingNewCity}
              emptyNewCityForm={emptyNewCityForm}
              className="col-span-2"
              onSaveCity={onEditBeneficiaryCity}
              countryOptions={countryOptions}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowEditBeneficiaryModal(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updatingBeneficiary}
              className="btn-primary"
            >
              {updatingBeneficiary ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}