"use client";

type GalleryImage = {
  id: string;
  file: File | null;
  previewUrl: string;
  caption: string;
};

type Props = {
  gallery: GalleryImage[];
  setGallery: React.Dispatch<React.SetStateAction<GalleryImage[]>>;
};

export default function GallerySection({ gallery, setGallery }: Props) {
  const addImages = (files: FileList | null) => {
    if (!files?.length) return;

    const newImages = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      caption: "",
    }));

    setGallery((prev) => [...prev, ...newImages]);
  };

  const updateCaption = (id: string, caption: string) => {
    setGallery((prev) =>
      prev.map((img) => (img.id === id ? { ...img, caption } : img))
    );
  };

  const removeImage = (id: string) => {
    setGallery((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Galería</h2>
          <p className="text-sm text-gray-500">
            Agrega imágenes del paquete, evidencia o soporte visual.
          </p>
        </div>

        <label className="btn-primary cursor-pointer">
          Agregar imágenes
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => addImages(e.target.files)}
          />
        </label>
      </div>

      {gallery.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-500">
          No hay imágenes agregadas.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {gallery.map((img) => (
          <div key={img.id} className="rounded-lg border border-gray-200 p-3">
            <img
              src={img.previewUrl}
              alt="Preview"
              className="h-40 w-full rounded-md object-cover"
            />

            <input
              className="input mt-3"
              value={img.caption}
              onChange={(e) => updateCaption(img.id, e.target.value)}
              placeholder="Descripción"
            />

            <button
              type="button"
              onClick={() => removeImage(img.id)}
              className="mt-3 text-sm text-red-600 hover:underline"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}