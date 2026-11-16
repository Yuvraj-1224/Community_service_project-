import { useEffect, useState } from "react";
import { AlertTriangle, FileDown, ImageOff, Loader2 } from "lucide-react";
import { useI18n, type Lang } from "../i18n";
import { detectionApi } from "../services/api";
import type { ScanDetail } from "../services/types";
import { useAuthImage, useErrorText } from "../hooks";
import { cn, downloadBlob, formatDateTime, pct, pickText } from "../utils";
import { Alert, StatusBadge } from "./ui";
import DiseaseInfo from "./DiseaseInfo";

export function AuthImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const { src, failed } = useAuthImage(url);
  if (failed) return <div className={cn("grid place-items-center bg-gray-100 text-gray-400", className)}><ImageOff className="h-6 w-6" /></div>;
  if (!src) return <div className={cn("animate-pulse bg-gray-100", className)} />;
  return <img src={src} alt={alt} className={cn("object-cover", className)} />;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 0.85 ? "bg-forest-600" : value >= 0.7 ? "bg-lime-500" : "bg-amber-500";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  );
}

export default function ScanResult({ scan }: { scan: ScanDetail }) {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const [reportLang, setReportLang] = useState<Lang>(lang);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setReportLang(lang), [lang]);

  const identified = scan.result_status === "identified";
  const d = scan.disease;
  const cropLabel = scan.crop_name ? (d ? pickText(d, "crop_name", lang) : t(`crops.${scan.crop_name}`)) : t("common.none");
  const diseaseLabel = identified ? (d ? pickText(d, "disease_name", lang) : scan.disease_name) : t("common.none");

  const uncertainMsg =
    scan.result_status === "low_confidence" && scan.crop_name
      ? t("result.low_confidence_crop", { crop: t(`crops.${scan.crop_name}`) })
      : t(`result.${scan.result_status}`);

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      downloadBlob(await detectionApi.report(scan.id, reportLang), `agrovision-scan-${scan.id}-${reportLang}.pdf`);
    } catch (e) {
      setError(await errorText(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="card grid gap-0 overflow-hidden md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <AuthImage url={scan.image_url} alt={diseaseLabel ?? "leaf"} className="h-64 w-full md:h-full" />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-forest-900">{t("result.title")}</h2>
            <StatusBadge status={scan.health_status} />
          </div>

          {!identified && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900 ring-1 ring-amber-200" role="status">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{uncertainMsg}</p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-gray-500">{t("result.crop")}</dt><dd className="font-semibold text-gray-900">{cropLabel}</dd></div>
            <div><dt className="text-gray-500">{t("result.disease")}</dt><dd className="font-semibold text-gray-900">{diseaseLabel}</dd></div>
            <div className="col-span-2">
              <dt className="mb-1 flex justify-between text-gray-500"><span>{t("result.confidence")}</span><span className="font-semibold text-gray-900">{pct(scan.confidence)}</span></dt>
              <dd><ConfidenceBar value={scan.confidence} /></dd>
            </div>
            <div><dt className="text-gray-500">{t("result.health")}</dt><dd className="font-semibold">{t(`result.${scan.health_status}`)}</dd></div>
            <div><dt className="text-gray-500">{t("result.severity")}</dt><dd className="text-gray-600">{t("result.severityNA")}</dd></div>
            <div><dt className="text-gray-500">{t("result.scanId")}</dt><dd>#{scan.id}</dd></div>
            <div><dt className="text-gray-500">{t("result.date")}</dt><dd>{formatDateTime(scan.created_at, lang)}</dd></div>
            <div className="col-span-2"><dt className="text-gray-500">{t("result.modelVersion")}</dt><dd className="font-mono text-xs">{scan.model_version}</dd></div>
          </dl>

          {!identified && scan.top_predictions.length > 0 && scan.result_status !== "not_plant" && (
            <details className="rounded-xl bg-gray-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-gray-700">{t("result.topPredictions")}</summary>
              <ul className="mt-2 space-y-1 text-gray-600">
                {scan.top_predictions.map((p) => (
                  <li key={p.label} className="flex justify-between gap-2"><span>{t(`crops.${p.crop}`)} – {p.disease}</span><span>{pct(p.confidence)}</span></li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              {t("result.reportLanguage")}
              <select className="input w-auto py-1.5" value={reportLang} onChange={(e) => setReportLang(e.target.value as Lang)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </label>
            <button type="button" className="btn-primary sm:ml-auto" onClick={download} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {downloading ? t("result.downloading") : t("result.downloadReport")}
            </button>
          </div>
          {error && <Alert kind="error">{error}</Alert>}
        </div>
      </div>

      {identified && d && (
        <div className="card p-5">
          <DiseaseInfo disease={d} />
        </div>
      )}
    </div>
  );
}
