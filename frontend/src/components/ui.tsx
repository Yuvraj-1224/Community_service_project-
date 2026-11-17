import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Info, Languages, Leaf, Loader2, X } from "lucide-react";
import { useI18n, type Lang } from "../i18n";
import type { HealthStatus } from "../services/types";
import { cn } from "../utils";

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight">
      <span className={cn("grid h-9 w-9 place-items-center rounded-xl", light ? "bg-white/15" : "bg-forest-800")}>
        <Leaf className="h-5 w-5 text-forest-100" aria-hidden />
      </span>
      {!compact && (
        <span className={cn("text-lg", light ? "text-white" : "text-forest-900")}>
          Crop Care <span className={light ? "text-forest-200" : "text-forest-600"}>AI</span>
        </span>
      )}
    </span>
  );
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const opts: Lang[] = ["en", "hi"];
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-xl bg-forest-50 p-1 ring-1 ring-forest-100", className)} role="group" aria-label={t("nav.language")}>
      <Languages className="ml-1 h-4 w-4 text-forest-700" aria-hidden />
      {opts.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
            lang === l ? "bg-forest-800 text-white shadow-sm" : "text-forest-800 hover:bg-forest-100",
          )}
        >
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-forest-800" role="status">
      <Loader2 className={cn("h-5 w-5 animate-spin", className)} aria-hidden />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}

export function PageLoader() {
  const { t } = useI18n();
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="h-8 w-8" label={t("common.loading")} />
    </div>
  );
}

type AlertKind = "error" | "success" | "info" | "warning";
export function Alert({ kind = "info", children, onClose }: { kind?: AlertKind; children: ReactNode; onClose?: () => void }) {
  const styles: Record<AlertKind, string> = {
    error: "bg-red-50 text-red-800 ring-red-200",
    success: "bg-forest-50 text-forest-900 ring-forest-200",
    info: "bg-sky-50 text-sky-900 ring-sky-200",
    warning: "bg-amber-50 text-amber-900 ring-amber-200",
  };
  const Icon = kind === "success" ? CheckCircle2 : kind === "info" ? Info : AlertTriangle;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-xl p-3.5 text-sm ring-1 animate-fade-up", styles[kind])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="close">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: HealthStatus }) {
  const { t } = useI18n();
  const cls = {
    healthy: "bg-forest-100 text-forest-800",
    diseased: "bg-red-100 text-red-700",
    uncertain: "bg-amber-100 text-amber-800",
  }[status];
  return <span className={cn("badge", cls)}>{t(`result.${status}`)}</span>;
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-forest-50 text-forest-700">{icon}</div>
      <p className="font-semibold text-gray-800">{title}</p>
      {hint && <p className="max-w-sm text-sm text-gray-500">{hint}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-gray-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}
export function Field({ label, error, hint, className, ...rest }: FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className={cn("input", error && "input-error")} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {error ? <p id={`${id}-err`} className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, "type">) {
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  const id = useId();
  const { label, error, hint, className, ...rest } = props;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input id={id} type={show ? "text" : "password"} className={cn("input pr-10", error && "input-error")} aria-invalid={!!error} {...rest} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-gray-400 hover:text-gray-600"
          aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn("card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 animate-fade-up sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-md")}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-forest-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, message, onConfirm, onCancel, busy }: { open: boolean; message: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onCancel} title={t("common.confirm")}>
      <p className="text-gray-700">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>{t("common.cancel")}</button>
        <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("common.delete")}
        </button>
      </div>
    </Modal>
  );
}

export function StatCard({ label, value, icon, tone = "green" }: { label: string; value: ReactNode; icon: ReactNode; tone?: "green" | "red" | "amber" | "sky" }) {
  const tones = {
    green: "bg-forest-100 text-forest-800",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <div className="card flex items-center gap-4 p-4 sm:p-5">
      <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
