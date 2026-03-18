"use client";

import type React from "react";

type NewCityForm = {
  label: string;
  country: string;
  postalCode: string;
};

type Props = {
  checked: boolean;
  setChecked: React.Dispatch<React.SetStateAction<boolean>>;
  form: NewCityForm;
  setForm: React.Dispatch<React.SetStateAction<NewCityForm>>;
  onSaveCity: () => Promise<void> | void;
  savingNewCity: boolean;
  emptyNewCityForm: () => NewCityForm;
  className?: string;
};

export default function NewCityFields({
  checked,
  setChecked,
  form,
  setForm,
  onSaveCity,
  savingNewCity,
  emptyNewCityForm,
  className = "mt-3",
}: Props) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <input
          id={`new-city-${Math.random()}`}
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            const enabled = e.target.checked;
            setChecked(enabled);
            if (!enabled) {
              setForm(emptyNewCityForm());
            }
          }}
        />
        <label className="text-sm text-gray-700">City not found? Add a new one</label>
      </div>

      {checked && (
        <div className="mt-3 border rounded-lg p-4 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">City name *</label>
            <input
              className="input w-full"
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="e.g. Medellín"
            />
          </div>

          <div>
            <label className="label">Country *</label>
            <input
              className="input w-full"
              value={form.country}
              onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
              placeholder="e.g. Colombia"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">ZIP Code</label>
            <input
              className="input w-full"
              value={form.postalCode}
              onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))}
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