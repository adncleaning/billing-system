"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

type Props = {
  agency: string;
  setAgency: (value: string) => void;
  observations: string;
  setObservations: (value: string) => void;
  tariffHeading: string;
  setTariffHeading: (value: string) => void;
  internalComments: string;
  setInternalComments: (value: string) => void;
  internalCommentsMax: number;
  senderCountry?: string;
};

const COLOMBIA_TARIFF_OPTIONS = [
  {
    value: "9807200000",
    label: "General (Varias cosas)",
  },
  {
    value: "8471300000",
    label: "Tablet/ IPAD (viaja solo)",
  },
  {
    value: "8471300000",
    label: "Laptop (Portátil)(viaja solo)",
  },
  {
    value: "8517130000",
    label: "Celular (Debe ir solo + colocar IMEI guia)",
  },
  {
    value: "8473300000",
    label: "Screen Touch (Pantalla táctil) (viaja solo)",
  },
  {
    value: "9807200000",
    label: "ELECTRONIC SPARE PART (Pieza repuesto electrónico)",
  },
  {
    value: "8714200000",
    label:
      "Vehículos automóviles, tractores, Motocicletas, triciclos y sillas de ruedas equipados con motor o sus partes (pieza repuesto automotriz)",
  },
  {
    value: "9006910000",
    label: "Instrumentos y aparatos de óptica, fotografía o cinematografía",
  },
];

const AGENCY_OPTIONS = ["Via logistics"];

function AgencySelect({
  agency,
  setAgency,
}: {
  agency: string;
  setAgency: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredAgencies = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return AGENCY_OPTIONS;

    return AGENCY_OPTIONS.filter((item) =>
      item.toLowerCase().includes(term)
    );
  }, [search]);

  return (
    <div className="relative">
      <label className="label">Agencia</label>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="input w-full flex items-center justify-between text-left"
      >
        <span className={agency ? "text-gray-900" : "text-gray-400"}>
          {agency || "--Seleccione una agencia--"}
        </span>

        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <input
                className="input pr-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar agencia"
                autoFocus
              />

              <Search className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setAgency("");
              setSearch("");
              setOpen(false);
            }}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${!agency ? "bg-blue-600 text-white hover:bg-blue-600" : "text-gray-700"
              }`}
          >
            --Seleccione una agencia--
          </button>

          {filteredAgencies.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setAgency(item);
                setSearch("");
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${agency === item
                ? "bg-blue-600 text-white hover:bg-blue-600"
                : "text-gray-700"
                }`}
            >
              {item}
            </button>
          ))}

          {filteredAgencies.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No se encontraron agencias
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BasicInfoSection({
  agency,
  setAgency,
  observations,
  setObservations,
  tariffHeading,
  setTariffHeading,
  internalComments,
  setInternalComments,
  internalCommentsMax,
  senderCountry,
}: Props) {
  const isColombiaSender = String(senderCountry || "")
    .toLowerCase()
    .includes("colombia");
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Básicos</h2>

      <div className="grid grid-cols-3 gap-4">
        <AgencySelect agency={agency} setAgency={setAgency} />

        <div>
          <label className="label">Partida Arancelaria</label>

          {isColombiaSender ? (
            <select
              className="input"
              value={tariffHeading}
              onChange={(e) => setTariffHeading(e.target.value)}
            >
              <option value="">Seleccione una partida</option>

              {COLOMBIA_TARIFF_OPTIONS.map((option, index) => (
                <option key={`${option.value}-${index}`} value={option.value}>
                  {option.value} — {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value={tariffHeading}
              onChange={(e) => setTariffHeading(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="label">Observaciones</label>
          <input
            className="input"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="label">Bitácora interna (comentarios)</label>

        <textarea
          className="input min-h-[90px]"
          value={internalComments}
          onChange={(e) =>
            setInternalComments(e.target.value.slice(0, internalCommentsMax))
          }
          placeholder="Notas internas para el equipo (no se muestran al cliente). Ej: validaciones, incidencias, acuerdos, etc."
        />

        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
          <span>Solo uso interno.</span>
          <span>
            {internalComments.length}/{internalCommentsMax}
          </span>
        </div>
      </div>
    </div>
  );
}