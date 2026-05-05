"use client";

type BookingDocument = {
  id: string;
  name: string;
  type: string;
  file: File | null;
  notes: string;
};

type Props = {
  documents: BookingDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<BookingDocument[]>>;
};

export default function DocumentsSection({ documents, setDocuments }: Props) {
  const addDocument = () => {
    setDocuments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        type: "",
        file: null,
        notes: "",
      },
    ]);
  };

  const updateDocument = (
    id: string,
    patch: Partial<BookingDocument>
  ) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc))
    );
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Documentos</h2>
          <p className="text-sm text-gray-500">
            Agrega documentos relacionados al booking o guía.
          </p>
        </div>

        <button type="button" onClick={addDocument} className="btn-primary">
          Agregar documento
        </button>
      </div>

      {documents.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-500">
          No hay documentos agregados.
        </div>
      )}

      <div className="space-y-4">
        {documents.map((doc) => (
          <div key={doc.id} className="rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Nombre</label>
                <input
                  className="input"
                  value={doc.name}
                  onChange={(e) =>
                    updateDocument(doc.id, { name: e.target.value })
                  }
                  placeholder="Ej: Factura, comprobante, ID"
                />
              </div>

              <div>
                <label className="label">Tipo</label>
                <select
                  className="input"
                  value={doc.type}
                  onChange={(e) =>
                    updateDocument(doc.id, { type: e.target.value })
                  }
                >
                  <option value="">Seleccione</option>
                  <option value="invoice">Factura</option>
                  <option value="receipt">Comprobante</option>
                  <option value="identity">Identificación</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="label">Archivo</label>
                <input
                  className="input"
                  type="file"
                  onChange={(e) =>
                    updateDocument(doc.id, {
                      file: e.target.files?.[0] || null,
                    })
                  }
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="label">Notas</label>
              <textarea
                className="input min-h-[80px]"
                value={doc.notes}
                onChange={(e) =>
                  updateDocument(doc.id, { notes: e.target.value })
                }
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => removeDocument(doc.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}