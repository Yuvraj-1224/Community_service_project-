import { useEffect, useRef, useState, type DragEvent } from "react";
import { Camera, ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useI18n } from "../i18n";
import { cn, formatBytes, validateImageFile } from "../utils";

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
}

export default function ImageUploader({ file, onChange, onError, disabled }: Props) {
  const { t } = useI18n();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const accept = (f: File | undefined | null) => {
    if (!f) return;
    const check = validateImageFile(f);
    if (!check.ok) {
      onError(t(`validation.${check.reason}`));
      return;
    }
    onError(null);
    onChange(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) accept(e.dataTransfer.files?.[0]);
  };

  const inputs = (
    <>
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid="file-input"
        onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ""; }} />
      {/* capture="environment" opens the rear camera directly on mobile browsers */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="camera-input"
        onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );

  if (file && preview) {
    return (
      <div className="card overflow-hidden animate-fade-up">
        {inputs}
        <div className="relative bg-gray-900/5">
          <img src={preview} alt="preview" className="mx-auto max-h-[420px] w-full object-contain" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-gray-800">{file.name}</p>
            <p className="text-gray-500">{formatBytes(file.size)}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => galleryRef.current?.click()} disabled={disabled}>
              <RefreshCw className="h-4 w-4" /> {t("detect.replace")}
            </button>
            <button type="button" className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => onChange(null)} disabled={disabled}>
              <Trash2 className="h-4 w-4" /> {t("detect.remove")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "card flex flex-col items-center gap-4 border-2 border-dashed px-6 py-12 text-center transition",
        dragging ? "border-forest-600 bg-forest-50" : "border-forest-200",
      )}
    >
      {inputs}
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-forest-100 text-forest-800">
        <ImagePlus className="h-8 w-8" />
      </div>
      <div>
        <p className="font-semibold text-gray-800">{t("detect.dropHere")}</p>
        <p className="mt-1 text-sm text-gray-500">{t("detect.formats")}</p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <button type="button" className="btn-primary" onClick={() => galleryRef.current?.click()} disabled={disabled}>
          <Upload className="h-4 w-4" /> {t("detect.browse")}
        </button>
        <button type="button" className="btn-secondary" onClick={() => cameraRef.current?.click()} disabled={disabled}>
          <Camera className="h-4 w-4" /> {t("detect.camera")}
        </button>
      </div>
    </div>
  );
}
