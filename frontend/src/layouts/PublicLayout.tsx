import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Mail, Menu, X } from "lucide-react";
import { useI18n } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { LanguageSwitcher, Logo } from "../components/ui";

export default function PublicLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/#home", label: t("nav.home") },
    { href: "/#features", label: t("nav.features") },
    { href: "/#how-it-works", label: t("nav.howItWorks") },
    { href: "/#about", label: t("nav.about") },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-forest-900/5 bg-cream/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" aria-label="Crop Care AI home"><Logo /></Link>
          <div className="hidden items-center gap-6 md:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-gray-700 transition hover:text-forest-800">{l.label}</a>
            ))}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher />
            {user ? (
              <Link to="/dashboard" className="btn-primary"><LayoutDashboard className="h-4 w-4" /> {t("nav.dashboard")}</Link>
            ) : (
              <NavLink to="/login" className="btn-primary">{t("nav.login")}</NavLink>
            )}
          </div>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label={t("nav.menu")} aria-expanded={open}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>
        {open && (
          <div className="border-t border-forest-900/5 bg-cream px-4 pb-4 md:hidden animate-fade-up">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 font-medium text-gray-700">{l.label}</a>
            ))}
            <div className="mt-2 flex items-center justify-between">
              <LanguageSwitcher />
              <Link to={user ? "/dashboard" : "/login"} onClick={() => setOpen(false)} className="btn-primary">
                {user ? t("nav.dashboard") : t("nav.login")}
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="bg-forest-900 text-forest-100">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <Logo light />
            <p className="mt-3 text-sm text-forest-200">{t("app.tagline")}</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-white">{t("landing.project")}</p>
            <p className="text-sm text-forest-200">{t("landing.footerProject")}</p>
            <p className="text-sm text-forest-200">{t("landing.techStack")}</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-white">{t("landing.contact")}</p>
            <a href="mailto:support@agrovision.example" className="flex items-center gap-2 text-sm text-forest-200 hover:text-white">
              <Mail className="h-4 w-4" /> support@agrovision.example
            </a>
            <p className="mt-2 text-xs text-forest-300">Kisan Call Centre: 1800-180-1551</p>
          </div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs text-forest-300">
          © {new Date().getFullYear()} Crop Care AI. {t("landing.footerRights")}
        </p>
      </footer>
    </div>
  );
}
