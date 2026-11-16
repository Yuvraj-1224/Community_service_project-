import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, History as HistoryIcon, Search, Trash2 } from "lucide-react";
import { useI18n } from "../i18n";
import { detectionApi, diseaseApi } from "../services/api";
import { useAsync, useDebounced, useErrorText } from "../hooks";
import { Alert, ConfirmDialog, EmptyState, PageHeader, PageLoader, StatusBadge } from "../components/ui";
import ScanResult, { AuthImage } from "../components/ScanResult";
import { formatDateTime, pct, scanDiseaseName } from "../utils";

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [disease, setDisease] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const dq = useDebounced(q);

  const diseases = useAsync(() => diseaseApi.list(), []);
  const { data, loading, error, reload } = useAsync(
    () => detectionApi.history({ q: dq || undefined, health_status: status || undefined, disease: disease || undefined,
      date_from: from || undefined, date_to: to || undefined, page, page_size: PAGE_SIZE }),
    [dq, status, disease, from, to, page],
  );

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const clear = () => { setQ(""); setStatus(""); setDisease(""); setFrom(""); setTo(""); setPage(1); };

  const confirmDelete = async () => {
    if (toDelete == null) return;
    setDeleting(true);
    try {
      await detectionApi.remove(toDelete);
      setMsg({ kind: "success", text: t("history.deleted") });
      if (data && data.items.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (e) {
      setMsg({ kind: "error", text: await errorText(e) });
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <div>
      <PageHeader title={t("history.title")} subtitle={t("history.subtitle")} />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="relative lg:col-span-2">
          <span className="sr-only">{t("common.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder={t("history.search")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </label>
        <select className="input" aria-label={t("history.status")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t("history.allStatus")}</option>
          <option value="healthy">{t("result.healthy")}</option>
          <option value="diseased">{t("result.diseased")}</option>
          <option value="uncertain">{t("result.uncertain")}</option>
        </select>
        <select className="input" aria-label={t("history.disease")} value={disease} onChange={(e) => { setDisease(e.target.value); setPage(1); }}>
          <option value="">{t("history.allDiseases")}</option>
          {diseases.data?.items.map((d) => <option key={d.id} value={d.disease_name}>{lang === "hi" && d.disease_name_hi ? d.disease_name_hi : d.disease_name}</option>)}
        </select>
        <label className="text-xs text-gray-500">{t("history.from")}<input type="date" className="input mt-0.5 py-2" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label>
        <label className="text-xs text-gray-500">{t("history.to")}<input type="date" className="input mt-0.5 py-2" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>
        {(q || status || disease || from || to) && <button className="btn-ghost justify-self-start text-sm lg:col-span-6" onClick={clear}>{t("history.clear")}</button>}
      </div>

      {msg && <div className="mb-4"><Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert></div>}

      {loading && !data ? <PageLoader /> : error ? <Alert kind="error">{error}</Alert> : !data || data.items.length === 0 ? (
        <div className="card"><EmptyState icon={<HistoryIcon className="h-7 w-7" />} title={t("history.empty")} /></div>
      ) : (
        <div className="card overflow-hidden">
          {/* Desktop table */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-forest-50 text-xs uppercase tracking-wide text-forest-900">
              <tr>
                {["image", "date", "crop", "disease", "confidence", "status", "actions"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{t(`history.${h}`)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((s) => (
                <tr key={s.id} className="hover:bg-forest-50/40">
                  <td className="px-4 py-2"><AuthImage url={s.image_url} alt="" className="h-12 w-12 rounded-lg" /></td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">{formatDateTime(s.created_at, lang)}</td>
                  <td className="px-4 py-2">{s.crop_name ? t(`crops.${s.crop_name}`) : t("common.none")}</td>
                  <td className="px-4 py-2 font-medium">{scanDiseaseName(s, lang) ?? t("common.none")}</td>
                  <td className="px-4 py-2">{pct(s.confidence)}</td>
                  <td className="px-4 py-2"><StatusBadge status={s.health_status} /></td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <Link to={`/history/${s.id}`} className="btn-ghost px-2.5 py-1.5" aria-label={t("history.view")}><Eye className="h-4 w-4" /></Link>
                      <button className="btn-ghost px-2.5 py-1.5 text-red-600 hover:bg-red-50" onClick={() => setToDelete(s.id)} aria-label={t("history.delete")}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile cards */}
          <ul className="divide-y divide-gray-100 md:hidden">
            {data.items.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <Link to={`/history/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <AuthImage url={s.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.crop_name ? t(`crops.${s.crop_name}`) : t("common.none")} · {scanDiseaseName(s, lang) ?? t(`result.${s.health_status}`)}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(s.created_at, lang)} · {pct(s.confidence)}</p>
                    <div className="mt-1"><StatusBadge status={s.health_status} /></div>
                  </div>
                </Link>
                <button className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setToDelete(s.id)} aria-label={t("history.delete")}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
            <span className="text-gray-500">{t("history.page", { page, pages })}</span>
            <div className="flex gap-2">
              <button className="btn-ghost px-3 py-1.5" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /> {t("history.prev")}</button>
              <button className="btn-ghost px-3 py-1.5" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("history.next")} <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog open={toDelete != null} message={t("history.confirmDelete")} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} busy={deleting} />
    </div>
  );
}

export function ScanDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const errorText = useErrorText();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data, loading, error } = useAsync(() => detectionApi.get(Number(id)), [id]);

  const del = async () => {
    setBusy(true);
    try {
      await detectionApi.remove(Number(id));
      navigate("/history", { replace: true });
    } catch (e) {
      setErr(await errorText(e));
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <div>
      <PageHeader title={t("result.title")}
        action={
          <div className="flex gap-2">
            <Link to="/history" className="btn-ghost"><ArrowLeft className="h-4 w-4" /> {t("history.back")}</Link>
            {data && <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> {t("history.delete")}</button>}
          </div>
        } />
      {err && <div className="mb-4"><Alert kind="error">{err}</Alert></div>}
      {loading ? <PageLoader /> : error || !data ? <Alert kind="error">{error}</Alert> : <ScanResult scan={data} />}
      <ConfirmDialog open={confirm} message={t("history.confirmDelete")} onConfirm={del} onCancel={() => setConfirm(false)} busy={busy} />
    </div>
  );
}
