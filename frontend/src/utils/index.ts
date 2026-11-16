import type { Lang } from "../i18n";
import type { Disease } from "../services/types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;

export type FileCheck = { ok: true } | { ok: false; reason: "fileType" | "fileSize" };

export function validateImageFile(file: File): FileCheck {
  const type = file.type.toLowerCase();
  const typeOk = type ? ALLOWED_TYPES.includes(type) : ALLOWED_EXT.test(file.name);
  if (!typeOk) return { ok: false, reason: "fileType" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "fileSize" };
  return { ok: true };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MOBILE_RE = /^\+?[0-9]{10,13}$/;

export function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && pw.length <= 72 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

export interface RegisterForm {
  full_name: string;
  email: string;
  mobile: string;
  password: string;
  confirm_password: string;
}

/** Returns i18n keys (validation.*) per field. */
export function validateRegister(f: RegisterForm): Partial<Record<keyof RegisterForm, string>> {
  const e: Partial<Record<keyof RegisterForm, string>> = {};
  if (!f.full_name.trim()) e.full_name = "validation.required";
  else if (f.full_name.trim().length < 2) e.full_name = "validation.nameShort";
  if (!f.email.trim()) e.email = "validation.required";
  else if (!EMAIL_RE.test(f.email.trim())) e.email = "validation.email";
  const mobile = f.mobile.replace(/[\s-]/g, "");
  if (!mobile) e.mobile = "validation.required";
  else if (!MOBILE_RE.test(mobile)) e.mobile = "validation.mobile";
  if (!f.password) e.password = "validation.required";
  else if (!isStrongPassword(f.password)) e.password = "validation.passwordWeak";
  if (!f.confirm_password) e.confirm_password = "validation.required";
  else if (f.password !== f.confirm_password) e.confirm_password = "validation.passwordMatch";
  return e;
}

export function validateLogin(email: string, password: string) {
  const e: { email?: string; password?: string } = {};
  if (!email.trim()) e.email = "validation.required";
  else if (!EMAIL_RE.test(email.trim())) e.email = "validation.email";
  if (!password) e.password = "validation.required";
  return e;
}

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function formatDateTime(iso: string, lang: Lang) {
  return new Date(iso).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function formatDate(iso: string, lang: Lang) {
  return new Date(iso).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Pick the Hindi field when the UI is in Hindi and a translation exists. */
type BiKey = "disease_name" | "crop_name" | "description" | "environmental_conditions";
type BiListKey = "symptoms" | "causes" | "prevention" | "treatment";

export function pickText(d: Disease, key: BiKey, lang: Lang): string | null {
  const hi = d[`${key}_hi` as keyof Disease] as string | null;
  return lang === "hi" && hi ? hi : (d[key] as string | null);
}

export function pickList(d: Disease, key: BiListKey, lang: Lang): string[] {
  const hi = d[`${key}_hi` as keyof Disease] as string[] | undefined;
  return lang === "hi" && hi && hi.length ? hi : d[key];
}

/** Downscale very large photos in the browser before upload (keeps aspect ratio, JPEG 0.9). */
export async function compressImage(file: File, maxSide = 1600, minBytes = 1.5 * 1024 * 1024): Promise<File> {
  if (file.size < minBytes || typeof createImageBitmap === "undefined") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Disease name of a scan in the current language. */
export const scanDiseaseName = (s: { disease_name: string | null; disease_name_hi?: string | null }, lang: Lang) =>
  lang === "hi" && s.disease_name_hi ? s.disease_name_hi : s.disease_name;

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
