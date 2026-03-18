"use client";

type Props = {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
};

export default function FooterActions({ saving, onCancel, onSave }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onCancel} className="btn-outline" type="button">
        Cancel
      </button>
      <button onClick={onSave} className="btn-primary" disabled={saving} type="button">
        {saving ? "Creating..." : "Create"}
      </button>
    </div>
  );
}