import { Activity, Bot, Database, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "../../i18n";
import { adminApi } from "../../services/api";
import { useAsync } from "../../hooks";
import { Alert, PageHeader, PageLoader, StatCard } from "../../components/ui";
import { CHART_COLORS } from "../Dashboard";

export default function AdminDashboard() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(() => adminApi.dashboard(), []);
  if (loading) return <PageLoader />;
  if (error || !data) return <Alert kind="error">{error} <button className="ml-2 underline" onClick={reload}>{t("common.retry")}</button></Alert>;

  const pie = (["healthy", "diseased", "uncertain"] as const).map((k) => ({ key: k, name: t(`result.${k}`), value: data.health_status[k] ?? 0 })).filter((p) => p.value);
  const daily = data.daily.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" }) }));
  const top = data.most_detected_diseases.map((d) => ({ ...d, name: lang === "hi" && d.disease_hi ? d.disease_hi : d.disease }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.title")} subtitle={t("admin.subtitle")} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("admin.totalFarmers")} value={data.total_farmers} icon={<Users className="h-6 w-6" />} />
        <StatCard label={t("admin.totalScans")} value={data.total_scans} icon={<Activity className="h-6 w-6" />} tone="sky" />
        <StatCard label={t("admin.totalDiseases")} value={data.total_diseases} icon={<Database className="h-6 w-6" />} tone="amber" />
        <StatCard label={t("admin.modelStatus")} value={<span className={data.model.ready ? "text-forest-700" : "text-red-600"}>{data.model.ready ? t("admin.ready") : t("admin.notReady")}</span>}
          icon={<Bot className="h-6 w-6" />} tone={data.model.ready ? "green" : "red"} />
      </div>
      {data.model.ready ? (
        <p className="text-xs text-gray-500">Model: <span className="font-mono">{data.model.version}</span> · {data.model.architecture} · {data.model.num_classes} classes</p>
      ) : (
        <Alert kind="warning">{t("detect.modelNotReady")} {data.model.error && <span className="block font-mono text-xs opacity-75">{data.model.error}</span>}</Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">{t("admin.scans30")}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#166534" strokeWidth={2.5} dot={false} name={t("admin.totalScans")} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">{t("admin.healthSplit")}</h2>
          {pie.length === 0 ? <p className="text-sm text-gray-500">{t("admin.noData")}</p> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" outerRadius={80} label>
                    {pie.map((p) => <Cell key={p.key} fill={CHART_COLORS[p.key]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">{t("admin.mostDetected")}</h2>
          {top.length === 0 ? <p className="text-sm text-gray-500">{t("admin.noData")}</p> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#dc2626" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">{t("dashboard.byCrop")}</h2>
          {data.by_crop.length === 0 ? <p className="text-sm text-gray-500">{t("admin.noData")}</p> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.by_crop.map((c) => ({ ...c, name: t(`crops.${c.crop}`) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#166534" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
