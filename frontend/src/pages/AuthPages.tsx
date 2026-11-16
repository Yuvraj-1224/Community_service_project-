import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { useI18n, type Lang } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { useErrorText } from "../hooks";
import { Alert, Field, Logo, PasswordField } from "../components/ui";
import { EMAIL_RE, validateLogin, validateRegister, type RegisterForm } from "../utils";

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-6 sm:p-8 animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo compact />
          <h1 className="mt-4 text-2xl font-bold text-forest-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const errorText = useErrorText();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateLogin(email, password);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setApiError(null);
    try {
      const u = await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? (u.role === "admin" ? "/admin" : "/dashboard"), { replace: true });
    } catch (err) {
      setApiError(await errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {apiError && <Alert kind="error">{apiError}</Alert>}
        <Field label={t("auth.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email && t(errors.email)} />
        <PasswordField label={t("auth.password")} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password && t(errors.password)} />
        <div className="flex justify-end"><Link to="/forgot-password" className="text-sm font-medium text-forest-700 hover:underline">{t("auth.forgot")}</Link></div>
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("auth.loginBtn")}</button>
        <p className="text-center text-sm text-gray-600">{t("auth.noAccount")} <Link to="/register" className="font-semibold text-forest-700 hover:underline">{t("nav.register")}</Link></p>
      </form>
    </AuthCard>
  );
}

export function RegisterPage() {
  const { t, lang } = useI18n();
  const { register } = useAuth();
  const navigate = useNavigate();
  const errorText = useErrorText();
  const [form, setForm] = useState<RegisterForm>({ full_name: "", email: "", mobile: "", password: "", confirm_password: "" });
  const [prefLang, setPrefLang] = useState<Lang>(lang);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof RegisterForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateRegister(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setApiError(null);
    try {
      await register({ ...form, full_name: form.full_name.trim(), email: form.email.trim(), mobile: form.mobile.replace(/[\s-]/g, ""), preferred_language: prefLang, role: "farmer" });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setApiError(await errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {apiError && <Alert kind="error">{apiError}</Alert>}
        <Field label={t("auth.fullName")} autoComplete="name" value={form.full_name} onChange={set("full_name")} error={errors.full_name && t(errors.full_name)} />
        <Field label={t("auth.email")} type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email && t(errors.email)} />
        <Field label={t("auth.mobile")} type="tel" inputMode="tel" autoComplete="tel" placeholder="9876543210" value={form.mobile} onChange={set("mobile")} error={errors.mobile && t(errors.mobile)} />
        <PasswordField label={t("auth.password")} autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password && t(errors.password)} hint={t("auth.passwordHint")} />
        <PasswordField label={t("auth.confirmPassword")} autoComplete="new-password" value={form.confirm_password} onChange={set("confirm_password")} error={errors.confirm_password && t(errors.confirm_password)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="role">{t("auth.role")}</label>
            <select id="role" className="input" value="farmer" onChange={() => undefined}>
              <option value="farmer">{t("auth.farmer")}</option>
              <option value="admin" disabled>{t("auth.admin")}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="plang">{t("auth.preferredLanguage")}</label>
            <select id="plang" className="input" value={prefLang} onChange={(e) => setPrefLang(e.target.value as Lang)}>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
        </div>
        <p className="-mt-2 text-xs text-gray-500">{t("auth.adminNote")}</p>
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("auth.registerBtn")}</button>
        <p className="text-center text-sm text-gray-600">{t("auth.haveAccount")} <Link to="/login" className="font-semibold text-forest-700 hover:underline">{t("nav.login")}</Link></p>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError(t("validation.email"));
    setError(null);
    setDone(true);
  };
  return (
    <AuthCard title={t("auth.forgotTitle")} subtitle={t("auth.forgotSubtitle")}>
      {done ? (
        <div className="space-y-4">
          <Alert kind="info">{t("auth.forgotDone", { email: email.trim() })}</Alert>
          <Link to="/login" className="btn-secondary w-full">{t("auth.backToLogin")}</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label={t("auth.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} />
          <button type="submit" className="btn-primary w-full py-3"><Mail className="h-4 w-4" /> {t("auth.forgotBtn")}</button>
          <Link to="/login" className="block text-center text-sm font-medium text-forest-700 hover:underline">{t("auth.backToLogin")}</Link>
        </form>
      )}
    </AuthCard>
  );
}
