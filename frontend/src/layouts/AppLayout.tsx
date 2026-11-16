import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Database, History, LayoutDashboard, LogOut, Menu, ScanLine, Shield, User, Users, X } from "lucide-react";
import { useI18n } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { LanguageSwitcher, Logo } from "../components/ui";
import { cn } from "../utils";

export default function AppLayout() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);

  const items = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/detect", label: t("nav.detect"), icon: ScanLine },
    { to: "/history", label: t("nav.history"), icon: History },
    { to: "/diseases", label: t("nav.diseases"), icon: BookOpen },
    { to: "/profile", label: t("nav.profile"), icon: User },
  ];
  const adminItems = [
    { to: "/admin", label: t("nav.admin"), icon: Shield },
    { to: "/admin/users", label: t("nav.adminUsers"), icon: Users },
    { to: "/admin/diseases", label: t("nav.adminDiseases"), icon: Database },
  ];

  const doLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
      isActive ? "bg-forest-800 text-white shadow-sm" : "text-gray-700 hover:bg-forest-50 hover:text-forest-900");

  const nav = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <Link to="/" className="mb-6 px-2"><Logo /></Link>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={linkCls} end={to === "/dashboard"}><Icon className="h-5 w-5" /> {label}</NavLink>
      ))}
      {user?.role === "admin" && (
        <>
          <p className="mt-5 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Admin</p>
          {adminItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkCls} end={to === "/admin"}><Icon className="h-5 w-5" /> {label}</NavLink>
          ))}
        </>
      )}
      <div className="mt-auto space-y-3 border-t border-gray-100 pt-4">
        <div className="px-3">
          <p className="truncate text-sm font-semibold text-gray-900">{user?.full_name}</p>
          <p className="truncate text-xs text-gray-500">{user?.email}</p>
        </div>
        <button onClick={doLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
          <LogOut className="h-5 w-5" /> {t("nav.logout")}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-forest-900/5 bg-white lg:block">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-3 rounded-lg p-2 text-gray-500" onClick={() => setOpen(false)} aria-label="close"><X className="h-5 w-5" /></button>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-forest-900/5 bg-cream/85 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label={t("nav.menu")}><Menu className="h-6 w-6" /></button>
            <span className="lg:hidden"><Logo compact /></span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/detect" className="btn-primary hidden sm:inline-flex"><ScanLine className="h-4 w-4" /> {t("dashboard.quickScan")}</Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
