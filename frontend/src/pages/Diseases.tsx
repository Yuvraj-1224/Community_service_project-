import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { useI18n } from "../i18n";
import { diseaseApi } from "../services/api";
import type { Disease } from "../services/types";
import { useAsync, useDebounced } from "../hooks";
import { Alert, EmptyState, Modal, PageHeader, PageLoader } from "../components/ui";
import DiseaseInfo from "../components/DiseaseInfo";
import { cn, pickList, pickText } from "../utils";

const TYPE_STYLE: Record<string, string> = {
  fungal: "bg-amber-100 text-amber-800", bacterial: "bg-sky-100 text-sky-800", viral: "bg-purple-100 text-purple-800",
  pest: "bg-orange-100 text-orange-800", oomycete: "bg-cyan-100 text-cyan-800", healthy: "bg-forest-100 text-forest-800",
  other: "bg-gray-100 text-gray-700",
};

export default function Diseases() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [crop, setCrop] = useState("");
  const [type, setType] = useState("");
  const [showHealthy, setShowHealthy] = useState(false);
  const [open, setOpen] = useState<Disease | null>(null);
  const dq = useDebounced(q.trim());

  const params = { crop: crop || undefined, disease_type: type || undefined, healthy: showHealthy ? undefined : false };
  const all = useAsync(() => diseaseApi.list(), []);
  const { data, loading, error } = useAsync(
    () => (dq ? diseaseApi.search(dq, params) : diseaseApi.list(params)),
    [dq, crop, type, showHealthy],
  );
  const filters = all.data?.filters;
  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <div>
      <PageHeader title={t("diseases.title")} subtitle={t("diseases.subtitle")} />
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">{t("common.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder={t("diseases.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="input" aria-label={t("diseases.allCrops")} value={crop} onChange={(e) => setCrop(e.target.value)}>
          <option value="">{t("diseases.allCrops")}</option>
          {filters?.crops.map((c) => <option key={c} value={c}>{t(`crops.${c}`)}</option>)}
        </select>
        <select className="input" aria-label={t("diseases.allTypes")} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t("diseases.allTypes")}</option>
          {filters?.disease_types.filter((x) => x !== "healthy").map((x) => <option key={x} value={x}>{t(`diseases.types.${x}`)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4 accent-forest-800" checked={showHealthy} onChange={(e) => setShowHealthy(e.target.checked)} />
          {t("diseases.healthyOnly")}
        </label>
      </div>

      {loading && !data ? <PageLoader /> : error ? <Alert kind="error">{error}</Alert> : items.length === 0 ? (
        <div className="card"><EmptyState icon={<BookOpen className="h-7 w-7" />} title={t("diseases.empty")} /></div>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-500">{t("diseases.count", { n: items.length })}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((d) => (
              <button key={d.id} onClick={() => setOpen(d)} className="card flex flex-col p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="badge bg-forest-50 text-forest-800 ring-1 ring-forest-100">{pickText(d, "crop_name", lang)}</span>
                  <span className={cn("badge", TYPE_STYLE[d.disease_type] ?? TYPE_STYLE.other)}>{t(`diseases.types.${d.disease_type}`)}</span>
                </div>
                <h3 className="font-semibold text-gray-900">{pickText(d, "disease_name", lang)}</h3>
                {d.pathogen && <p className="text-xs italic text-gray-500">{d.pathogen}</p>}
                <ul className="mt-3 flex-1 space-y-1 text-sm text-gray-600">
                  {pickList(d, "symptoms", lang).slice(0, 2).map((s, i) => <li key={i} className="line-clamp-2">• {s}</li>)}
                </ul>
                <span className="mt-3 text-sm font-semibold text-forest-700">{t("diseases.readMore")} →</span>
              </button>
            ))}
          </div>
        </>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${pickText(open, "disease_name", lang)} · ${pickText(open, "crop_name", lang)}` : ""} wide>
        {open && <DiseaseInfo disease={open} />}
      </Modal>
    </div>
  );
}
