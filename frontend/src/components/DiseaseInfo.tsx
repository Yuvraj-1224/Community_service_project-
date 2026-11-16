import type { ReactNode } from "react";
import { AlertTriangle, CloudRain, Info, Microscope, ShieldCheck, Stethoscope, Bug } from "lucide-react";
import { useI18n } from "../i18n";
import type { Disease } from "../services/types";
import { pickList, pickText } from "../utils";

function Section({ icon, title, items, tone = "green" }: { icon: ReactNode; title: string; items: string[]; tone?: "green" | "amber" | "sky" | "red" }) {
  if (!items.length) return null;
  const tones = { green: "bg-forest-100 text-forest-800", amber: "bg-amber-100 text-amber-700", sky: "bg-sky-100 text-sky-700", red: "bg-red-100 text-red-700" };
  return (
    <section className="rounded-xl border border-gray-100 p-4">
      <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${tones[tone]}`}>{icon}</span>
        {title}
      </h3>
      <ul className="space-y-1.5 text-sm text-gray-700">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-600" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DiseaseInfo({ disease }: { disease: Disease }) {
  const { t, lang } = useI18n();
  const desc = pickText(disease, "description", lang);
  const env = pickText(disease, "environmental_conditions", lang);
  return (
    <div className="space-y-4">
      {desc && (
        <div className="rounded-xl bg-forest-50 p-4 text-sm text-forest-900">
          <p className="mb-1 flex items-center gap-2 font-semibold"><Info className="h-4 w-4" /> {t("result.overview")}</p>
          <p>{desc}</p>
          {disease.pathogen && (
            <p className="mt-2 flex items-center gap-2 text-xs text-forest-800">
              <Microscope className="h-3.5 w-3.5" /> {t("result.pathogen")}: <em>{disease.pathogen}</em>
            </p>
          )}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={<Bug className="h-4 w-4" />} title={t("result.symptoms")} items={pickList(disease, "symptoms", lang)} tone="red" />
        <Section icon={<Microscope className="h-4 w-4" />} title={t("result.causes")} items={pickList(disease, "causes", lang)} tone="amber" />
        {env && <Section icon={<CloudRain className="h-4 w-4" />} title={t("result.environment")} items={[env]} tone="sky" />}
        <Section icon={<Stethoscope className="h-4 w-4" />} title={t("result.treatment")} items={pickList(disease, "treatment", lang)} />
        <Section icon={<ShieldCheck className="h-4 w-4" />} title={t("result.prevention")} items={pickList(disease, "prevention", lang)} />
      </div>
      {!disease.is_healthy && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("result.expertWarning")}</p>
        </div>
      )}
    </div>
  );
}
