import { useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useI18n } from "../../i18n";
import { adminApi, diseaseApi } from "../../services/api";
import type { Disease, DiseaseInput } from "../../services/types";
import { useAsync, useErrorText } from "../../hooks";
import { Alert, ConfirmDialog, Modal, PageHeader, PageLoader } from "../../components/ui";

const TYPES = ["fungal", "bacterial", "viral", "pest", "oomycete", "healthy", "other"];
const LIST_FIELDS = ["symptoms", "causes", "treatment", "prevention"] as const;

type FormState = Record<string, string | boolean>;

function toForm(d?: Disease): FormState {
  const f: FormState = {
    class_label: d?.class_label ?? "", disease_name: d?.disease_name ?? "", disease_name_hi: d?.disease_name_hi ?? "",
    crop_name: d?.crop_name ?? "", crop_name_hi: d?.crop_name_hi ?? "", disease_type: d?.disease_type ?? "fungal",
    is_healthy: d?.is_healthy ?? false, pathogen: d?.pathogen ?? "", description: d?.description ?? "",
    description_hi: d?.description_hi ?? "", environmental_conditions: d?.environmental_conditions ?? "",
    environmental_conditions_hi: d?.environmental_conditions_hi ?? "",
  };
  for (const k of LIST_FIELDS) {
    f[k] = (d?.[k] ?? []).join("\n");
    f[`${k}_hi`] = (d?.[`${k}_hi`] ?? []).join("\n");
  }
  return f;
}

function fromForm(f: FormState): Partial<DiseaseInput> {
  const s = (k: string) => (String(f[k] ?? "").trim() || null);
  const lines = (k: string) => String(f[k] ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const out: Record<string, unknown> = {
    class_label: s("class_label"), disease_name: String(f.disease_name).trim(), disease_name_hi: s("disease_name_hi"),
    crop_name: String(f.crop_name).trim(), crop_name_hi: s("crop_name_hi"), disease_type: f.disease_type, is_healthy: !!f.is_healthy,
    pathogen: s("pathogen"), description: s("description"), description_hi: s("description_hi"),
    environmental_conditions: s("environmental_conditions"), environmental_conditions_hi: s("environmental_conditions_hi"),
  };
  for (const k of LIST_FIELDS) {
    out[k] = lines(k);
    out[`${k}_hi`] = lines(`${k}_hi`);
  }
  return out as Partial<DiseaseInput>;
}

export default function AdminDiseases() {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Disease | "new" | null>(null);
  const [form, setForm] = useState<FormState>(toForm());
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<Disease | null>(null);
  const { data, loading, error, reload } = useAsync(() => diseaseApi.list(), []);

  const items = (data?.items ?? []).filter((d) => {
    const s = q.trim().toLowerCase();
    return !s || [d.disease_name, d.disease_name_hi, d.crop_name, d.class_label].some((x) => x?.toLowerCase().includes(s));
  });

  const openForm = (d: Disease | "new") => {
    setEditing(d);
    setForm(toForm(d === "new" ? undefined : d));
    setFormErr(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (String(form.disease_name).trim().length < 2 || String(form.crop_name).trim().length < 2) {
      setFormErr(t("validation.required"));
      return;
    }
    setBusy(true);
    try {
      const body = fromForm(form);
      if (editing === "new") await adminApi.createDisease(body);
      else if (editing) await adminApi.updateDisease(editing.id, body);
      setMsg({ kind: "success", text: editing === "new" ? t("admin.created") : t("admin.updated") });
      setEditing(null);
      reload();
    } catch (err) {
      setFormErr(await errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await adminApi.deleteDisease(toDelete.id);
      setMsg({ kind: "success", text: t("admin.deleted") });
      reload();
    } catch (err) {
      setMsg({ kind: "error", text: await errorText(err) });
    } finally {
      setBusy(false);
      setToDelete(null);
    }
  };

  const input = (k: string, label: string, opts: { area?: boolean; hint?: boolean } = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      {opts.area ? (
        <textarea className="input min-h-24" value={String(form[k] ?? "")} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      ) : (
        <input className="input" value={String(form[k] ?? "")} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      )}
      {opts.hint && <span className="mt-1 block text-xs text-gray-500">{t("admin.listHint")}</span>}
    </label>
  );

  return (
    <div>
      <PageHeader title={t("admin.diseaseMgmt")} action={<button className="btn-primary" onClick={() => openForm("new")}><Plus className="h-4 w-4" /> {t("admin.addDisease")}</button>} />
      <label className="relative mb-4 block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder={t("diseases.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {msg && <div className="mb-4"><Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert></div>}
      {loading && !data ? <PageLoader /> : error ? <Alert kind="error">{error}</Alert> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-forest-50 text-xs uppercase tracking-wide text-forest-900">
              <tr><th className="px-4 py-3">{t("result.disease")}</th><th className="px-4 py-3">{t("diseases.affectedCrop")}</th><th className="px-4 py-3">{t("admin.type")}</th><th className="px-4 py-3">Class label</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium">{lang === "hi" && d.disease_name_hi ? d.disease_name_hi : d.disease_name}</td>
                  <td className="px-4 py-3">{lang === "hi" && d.crop_name_hi ? d.crop_name_hi : d.crop_name}</td>
                  <td className="px-4 py-3">{t(`diseases.types.${d.disease_type}`)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.class_label ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost px-2.5 py-1.5" onClick={() => openForm(d)} aria-label={t("common.edit")}><Pencil className="h-4 w-4" /></button>
                      <button className="btn-ghost px-2.5 py-1.5 text-red-600 hover:bg-red-50" onClick={() => setToDelete(d)} aria-label={t("common.delete")}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? t("admin.addDisease") : t("admin.editDisease")} wide>
        <form onSubmit={save} className="space-y-4">
          {formErr && <Alert kind="error">{formErr}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            {input("disease_name", t("admin.nameEn") + " *")}
            {input("disease_name_hi", t("admin.nameHi"))}
            {input("crop_name", t("admin.cropEn") + " *")}
            {input("crop_name_hi", t("admin.cropHi"))}
            <label className="block">
              <span className="label">{t("admin.type")}</span>
              <select className="input" value={String(form.disease_type)} onChange={(e) => setForm({ ...form, disease_type: e.target.value, is_healthy: e.target.value === "healthy" })}>
                {TYPES.map((x) => <option key={x} value={x}>{t(`diseases.types.${x}`)}</option>)}
              </select>
            </label>
            {input("pathogen", t("result.pathogen"))}
            {input("class_label", t("admin.classLabel"))}
            <label className="flex items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-forest-800" checked={!!form.is_healthy} onChange={(e) => setForm({ ...form, is_healthy: e.target.checked })} /> {t("admin.isHealthy")}
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {input("description", t("admin.descEn"), { area: true })}
            {input("description_hi", t("admin.descHi"), { area: true })}
            {input("environmental_conditions", t("admin.envEn"), { area: true })}
            {input("environmental_conditions_hi", t("admin.envHi"), { area: true })}
            {LIST_FIELDS.map((k) => (
              <div key={k} className="contents">
                {input(k, `${t(`result.${k}`)} (${t("admin.english")})`, { area: true, hint: true })}
                {input(`${k}_hi`, `${t(`result.${k}`)} (${t("admin.hindi")})`, { area: true, hint: true })}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>{t("admin.cancel")}</button>
            <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("admin.save")}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!toDelete} message={t("admin.confirmDeleteDisease", { name: toDelete?.disease_name ?? "" })} onConfirm={del} onCancel={() => setToDelete(null)} busy={busy} />
    </div>
  );
}
