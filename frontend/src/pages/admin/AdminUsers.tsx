import { useState } from "react";
import { ChevronLeft, ChevronRight, Search, UserCheck, UserX } from "lucide-react";
import { useI18n } from "../../i18n";
import { useAuth } from "../../context/AuthContext";
import { adminApi } from "../../services/api";
import { useAsync, useDebounced, useErrorText } from "../../hooks";
import { Alert, PageHeader, PageLoader } from "../../components/ui";
import { cn, formatDate } from "../../utils";

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const { t, lang } = useI18n();
  const { user: me } = useAuth();
  const errorText = useErrorText();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const dq = useDebounced(q);
  const { data, setData, loading, error } = useAsync(() => adminApi.users({ q: dq || undefined, page, page_size: PAGE_SIZE }), [dq, page]);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const toggle = async (id: number, active: boolean) => {
    try {
      const u = await adminApi.setUserActive(id, active);
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === id ? { ...x, is_active: u.is_active } : x)) });
    } catch (e) {
      setMsg(await errorText(e));
    }
  };

  return (
    <div>
      <PageHeader title={t("admin.users")} />
      <label className="relative mb-4 block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder={t("admin.searchUsers")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </label>
      {msg && <div className="mb-4"><Alert kind="error" onClose={() => setMsg(null)}>{msg}</Alert></div>}
      {loading && !data ? <PageLoader /> : error ? <Alert kind="error">{error}</Alert> : data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-forest-50 text-xs uppercase tracking-wide text-forest-900">
              <tr>{["name", "role", "scans", "joined"].map((h) => <th key={h} className="px-4 py-3">{t(`admin.${h}`)}</th>)}<th className="px-4 py-3">{t("history.status")}</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3"><p className="font-medium">{u.full_name}</p><p className="text-xs text-gray-500">{u.email} · {u.mobile}</p></td>
                  <td className="px-4 py-3"><span className={cn("badge", u.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-forest-100 text-forest-800")}>{t(`auth.${u.role}`)}</span></td>
                  <td className="px-4 py-3">{u.scan_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(u.created_at, lang)}</td>
                  <td className="px-4 py-3"><span className={cn("badge", u.is_active ? "bg-forest-100 text-forest-800" : "bg-gray-200 text-gray-600")}>{u.is_active ? t("admin.active") : t("admin.inactive")}</span></td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== me?.id && (
                      u.is_active
                        ? <button className="btn-ghost px-2.5 py-1.5 text-red-600 hover:bg-red-50" onClick={() => toggle(u.id, false)}><UserX className="h-4 w-4" /> {t("admin.deactivate")}</button>
                        : <button className="btn-ghost px-2.5 py-1.5 text-forest-700" onClick={() => toggle(u.id, true)}><UserCheck className="h-4 w-4" /> {t("admin.activate")}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
            <span className="text-gray-500">{t("history.page", { page, pages })} · {data.total}</span>
            <div className="flex gap-2">
              <button className="btn-ghost px-3 py-1.5" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></button>
              <button className="btn-ghost px-3 py-1.5" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
