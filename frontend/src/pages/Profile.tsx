import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, Save, UserCircle } from "lucide-react";
import { useI18n, type Lang } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { userApi } from "../services/api";
import { useErrorText } from "../hooks";
import { Alert, Field, PageHeader, PasswordField } from "../components/ui";
import { formatDate, isStrongPassword, MOBILE_RE } from "../utils";

type Msg = { kind: "success" | "error"; text: string } | null;

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const { user, setUser } = useAuth();
  const errorText = useErrorText();
  const [name, setName] = useState(user?.full_name ?? "");
  const [mobile, setMobile] = useState(user?.mobile ?? "");
  const [pref, setPref] = useState<Lang>(user?.preferred_language ?? lang);
  const [pErr, setPErr] = useState<{ name?: string; mobile?: string }>({});
  const [pMsg, setPMsg] = useState<Msg>(null);
  const [pBusy, setPBusy] = useState(false);

  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [wErr, setWErr] = useState<{ cur?: string; nw?: string; cf?: string }>({});
  const [wMsg, setWMsg] = useState<Msg>(null);
  const [wBusy, setWBusy] = useState(false);

  if (!user) return null;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof pErr = {};
    if (name.trim().length < 2) errs.name = t("validation.nameShort");
    const m = mobile.replace(/[\s-]/g, "");
    if (!MOBILE_RE.test(m)) errs.mobile = t("validation.mobile");
    setPErr(errs);
    if (Object.keys(errs).length) return;
    setPBusy(true);
    setPMsg(null);
    try {
      const u = await userApi.update({ full_name: name.trim(), mobile: m, preferred_language: pref });
      setUser(u);
      setLang(u.preferred_language);
      setPMsg({ kind: "success", text: t("profile.saved") });
    } catch (err) {
      setPMsg({ kind: "error", text: await errorText(err) });
    } finally {
      setPBusy(false);
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof wErr = {};
    if (!cur) errs.cur = t("validation.required");
    if (!isStrongPassword(nw)) errs.nw = t("validation.passwordWeak");
    if (nw !== cf) errs.cf = t("validation.passwordMatch");
    setWErr(errs);
    if (Object.keys(errs).length) return;
    setWBusy(true);
    setWMsg(null);
    try {
      await userApi.changePassword({ current_password: cur, new_password: nw, confirm_password: cf });
      setCur(""); setNw(""); setCf("");
      setWMsg({ kind: "success", text: t("profile.passwordChanged") });
    } catch (err) {
      setWMsg({ kind: "error", text: await errorText(err) });
    } finally {
      setWBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={t("profile.title")} />
      <div className="card mb-6 flex items-center gap-4 p-5">
        <UserCircle className="h-14 w-14 text-forest-700" />
        <div>
          <p className="text-lg font-semibold">{user.full_name}</p>
          <p className="text-sm text-gray-500">{user.email} · <span className="capitalize">{t(`auth.${user.role}`)}</span></p>
          <p className="text-xs text-gray-400">{t("profile.memberSince", { date: formatDate(user.created_at, lang) })}</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} noValidate className="card space-y-4 p-5">
          <h2 className="font-semibold text-gray-900">{t("profile.details")}</h2>
          {pMsg && <Alert kind={pMsg.kind}>{pMsg.text}</Alert>}
          <Field label={t("auth.fullName")} value={name} onChange={(e) => setName(e.target.value)} error={pErr.name} />
          <Field label={t("auth.email")} value={user.email} disabled readOnly />
          <Field label={t("auth.mobile")} type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} error={pErr.mobile} />
          <div>
            <label className="label" htmlFor="pref">{t("auth.preferredLanguage")}</label>
            <select id="pref" className="input" value={pref} onChange={(e) => setPref(e.target.value as Lang)}>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
          <button className="btn-primary" disabled={pBusy}>{pBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("profile.save")}</button>
        </form>
        <form onSubmit={changePw} noValidate className="card space-y-4 p-5">
          <h2 className="font-semibold text-gray-900">{t("profile.changePassword")}</h2>
          {wMsg && <Alert kind={wMsg.kind}>{wMsg.text}</Alert>}
          <PasswordField label={t("profile.currentPassword")} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} error={wErr.cur} />
          <PasswordField label={t("profile.newPassword")} autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} error={wErr.nw} hint={t("auth.passwordHint")} />
          <PasswordField label={t("auth.confirmPassword")} autoComplete="new-password" value={cf} onChange={(e) => setCf(e.target.value)} error={wErr.cf} />
          <button className="btn-primary" disabled={wBusy}>{wBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} {t("profile.updatePassword")}</button>
        </form>
      </div>
    </div>
  );
}
