"use client";

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
};

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
}: Props) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Básicos</h2>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Agencia</label>
          <input className="input" value={agency} onChange={(e) => setAgency(e.target.value)} />
        </div>

        <div>
          <label className="label">Partida Arancelaria</label>
          <input
            className="input"
            value={tariffHeading}
            onChange={(e) => setTariffHeading(e.target.value)}
          />
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
          onChange={(e) => setInternalComments(e.target.value.slice(0, internalCommentsMax))}
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