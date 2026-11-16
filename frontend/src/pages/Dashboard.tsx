import { Link } from "react-router-dom";
import { Activity, AlertTriangle, CircleHelp, HeartPulse, Leaf, ScanLine } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { dashboardApi } from "../services/api";
import { useAsync } from "../hooks";
import { Alert, EmptyState, PageLoader, StatCard, StatusBadge } from "../components/ui";
import { AuthImage } from "../components/ScanResult";
import { formatDateTime, pct, scanDiseaseName } from "../utils";

export const CHART_COLORS = { healthy: "#16a34a", diseased: "#dc2626", uncertain: "#d97706" };

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => Promise.all([dashboardApi.stats(), dashboardApi.recent(5)]), []);

  if (loading) return <PageLoader />;
  if (error || !data) return <Alert kind="error">{error} <button className="ml-2 underline" onClick={reload}>{t("common.retry")}</button></Alert>;
  const [stats, recent] = data;
  const pie = (["healthy", "diseased", "uncertain"] as const).map((k) => ({ name: t(`result.${k}`), key: k, value: stats[k] })).filter((x) => x.value > 0);
  const daily = stats.daily.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" }) }));

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="card flex flex-col gap-4 bg-gradient-to-br from-forest-800 to-forest-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("dashboard.welcome", { name: user?.full_name.split(" ")[0] ?? "" })}</h1>
          <p className="mt-1 text-forest-100">{t("dashboard.subtitle")}</p>
        </div>
        <Link to="/detect" className="btn bg-white px-5 py-3 text-forest-900 hover:bg-forest-100"><ScanLine className="h-5 w-5" /> {t("dashboard.quickScan")}</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("dashboard.totalScans")} value={stats.total_scans} icon={<Activity className="h-6 w-6" />} tone="sky" />
        <StatCard label={t("dashboard.healthy")} value={stats.healthy} icon={<HeartPulse className="h-6 w-6" />} />
        <StatCard label={t("dashboard.diseased")} value={stats.diseased} icon={<AlertTriangle className="h-6 w-6" />} tone="red" />
        <StatCard label={t("dashboard.uncertain")} value={stats.uncertain} icon={<CircleHelp className="h-6 w-6" />} tone="amber" />
      </div>

      {stats.total_scans === 0 ? (
        <div className="card">
          <EmptyState icon={<Leaf className="h-7 w-7" />} title={t("dashboard.noScans")} hint={t("dashboard.noScansHint")}
            action={<Link to="/detect" className="btn-primary"><ScanLine className="h-4 w-4" /> {t("dashboard.quickScan")}</Link>} />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h2 className="mb-4 font-semibold text-gray-900">{t("dashboard.scansLast14")}</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip cursor={{ fill: "#f0fdf4" }} />
                    <Bar dataKey="count" fill="#166534" radius={[6, 6, 0, 0]} name={t("dashboard.totalScans")} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-gray-900">{t("dashboard.statistics")}</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={pie.length > 1 ? 3 : 0}>
                      {pie.map((p) => <Cell key={p.key} fill={CHART_COLORS[p.key]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {pie.map((p) => (
                  <li key={p.key} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[p.key] }} />{p.name}</span>
                    <span className="font-semibold">{p.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{t("dashboard.recentScans")}</h2>
                <Link to="/history" className="text-sm font-medium text-forest-700 hover:underline">{t("dashboard.viewAll")}</Link>
              </div>
              <ul className="divide-y divide-gray-100">
                {recent.map((s) => (
                  <li key={s.id}>
                    <Link to={`/history/${s.id}`} className="flex items-center gap-3 py-3 transition hover:bg-forest-50/50">
                      <AuthImage url={s.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">
                          {s.crop_name ? t(`crops.${s.crop_name}`) : t("common.none")} · {scanDiseaseName(s, lang) ?? t(`result.${s.health_status}`)}
                        </p>
                        <p className="text-xs text-gray-500">{formatDateTime(s.created_at, lang)} · {pct(s.confidence)}</p>
                      </div>
                      <StatusBadge status={s.health_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="mb-3 font-semibold text-gray-900">{t("dashboard.topDiseases")}</h2>
              {stats.top_diseases.length === 0 ? (
                <p className="text-sm text-gray-500">{t("admin.noData")}</p>
              ) : (
                <ul className="space-y-3">
                  {stats.top_diseases.map((d) => (
                    <li key={d.disease}>
                      <div className="flex justify-between text-sm"><span className="truncate">{lang === "hi" && d.disease_hi ? d.disease_hi : d.disease}</span><span className="font-semibold">{d.count}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-red-50"><div className="h-2 rounded-full bg-red-500" style={{ width: `${(d.count / stats.diseased) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
              <h2 className="mt-6 mb-3 font-semibold text-gray-900">{t("dashboard.recentActivity")}</h2>
              <ol className="relative space-y-3 border-l border-forest-200 pl-4 text-sm">
                {recent.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-forest-600" />
                    <p className="text-gray-800">{t("dashboard.scannedOn", { crop: s.crop_name ? t(`crops.${s.crop_name}`) : "?", result: t(`result.${s.health_status}`) })}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(s.created_at, lang)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
