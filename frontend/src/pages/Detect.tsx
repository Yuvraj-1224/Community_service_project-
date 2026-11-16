import { useEffect, useState } from "react";
import { Camera, Leaf, RefreshCw, ScanLine, Sun, Focus, Crop } from "lucide-react";
import { useI18n } from "../i18n";
import { detectionApi } from "../services/api";
import type { ModelInfo, ScanDetail } from "../services/types";
import { useErrorText } from "../hooks";
import ImageUploader from "../components/ImageUploader";
import ScanResult from "../components/ScanResult";
import { Alert, PageHeader } from "../components/ui";
import { compressImage, formatBytes } from "../utils";

export default function Detect() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ScanDetail | null>(null);
  const [model, setModel] = useState<ModelInfo | null>(null);

  useEffect(() => {
    detectionApi.modelInfo().then(setModel).catch(() => setModel(null));
  }, []);

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const upload = await compressImage(file);
      if (upload !== file) setNote(t("detect.compressed", { from: formatBytes(file.size), to: formatBytes(upload.size) }));
      setResult(await detectionApi.predict(upload, setProgress));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(await errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setFile(null);
    setNote(null);
    setError(null);
  };

  if (result) {
    return (
      <div>
        <PageHeader title={t("result.title")} action={<button className="btn-secondary" onClick={reset}><RefreshCw className="h-4 w-4" /> {t("detect.newScan")}</button>} />
        <ScanResult scan={result} />
      </div>
    );
  }

  const tips = [
    { icon: Leaf, text: t("detect.tip1") },
    { icon: Sun, text: t("detect.tip2") },
    { icon: Focus, text: t("detect.tip3") },
    { icon: Crop, text: t("detect.tip4") },
  ];

  return (
    <div>
      <PageHeader title={t("detect.title")} subtitle={t("detect.subtitle")}
        action={model?.ready ? <span className="badge bg-forest-100 text-forest-800">{t("detect.modelVersion")}: {model.version}</span> : undefined} />
      {model && !model.ready && <div className="mb-4"><Alert kind="warning">{t("detect.modelNotReady")}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <ImageUploader file={file} onChange={(f) => { setFile(f); setNote(null); }} onError={setError} disabled={busy} />
          {error && <Alert kind="error" onClose={() => setError(null)}>{error}</Alert>}
          {note && <Alert kind="info">{note}</Alert>}
          {file && (
            <button className="btn-primary w-full py-3.5 text-base" onClick={analyze} disabled={busy}>
              <ScanLine className="h-5 w-5" /> {t("detect.analyze")}
            </button>
          )}
          {busy && (
            <div className="card flex flex-col items-center gap-3 p-6 text-center animate-fade-up" role="status" aria-live="polite">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 animate-ping rounded-full bg-forest-200" />
                <div className="relative grid h-16 w-16 place-items-center rounded-full bg-forest-800 text-white"><Leaf className="h-8 w-8 animate-pulse" /></div>
              </div>
              <p className="font-semibold text-forest-900">{t("detect.analyzing")}</p>
              <p className="text-sm text-gray-500">{t("detect.analyzingHint")}</p>
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-forest-100">
                <div className="h-full bg-forest-600 transition-all" style={{ width: `${progress < 100 ? progress : 100}%` }} />
              </div>
            </div>
          )}
        </div>
        <aside className="card h-fit p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><Camera className="h-5 w-5 text-forest-700" /> {t("detect.tipsTitle")}</h2>
          <ul className="space-y-3 text-sm text-gray-700">
            {tips.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" /> {text}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
