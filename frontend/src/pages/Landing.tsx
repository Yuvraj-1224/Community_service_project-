import { Link } from "react-router-dom";
import { ArrowRight, Camera, FileDown, History, Languages, ScanLine, ShieldCheck, Sparkles, Stethoscope, Upload, Cpu, Sprout } from "lucide-react";
import { useI18n } from "../i18n";
import HeroIllustration from "../components/HeroIllustration";

const CROPS = [
  { key: "Tomato", emoji: "🍅", n: 10 },
  { key: "Potato", emoji: "🥔", n: 3 },
  { key: "Bell Pepper", emoji: "🫑", n: 2 },
  { key: "Apple", emoji: "🍎", n: 4 },
  { key: "Corn", emoji: "🌽", n: 4 },
  { key: "Grape", emoji: "🍇", n: 4 },
];

export default function Landing() {
  const { t } = useI18n();
  const features = [
    { icon: ScanLine, title: t("landing.f1t"), desc: t("landing.f1d") },
    { icon: Camera, title: t("landing.f2t"), desc: t("landing.f2d") },
    { icon: Stethoscope, title: t("landing.f3t"), desc: t("landing.f3d") },
    { icon: Languages, title: t("landing.f4t"), desc: t("landing.f4d") },
    { icon: History, title: t("landing.f5t"), desc: t("landing.f5d") },
    { icon: FileDown, title: t("landing.f6t"), desc: t("landing.f6d") },
  ];
  const steps = [
    { icon: Camera, title: t("landing.s1t"), desc: t("landing.s1d") },
    { icon: Cpu, title: t("landing.s2t"), desc: t("landing.s2d") },
    { icon: Sparkles, title: t("landing.s3t"), desc: t("landing.s3d") },
    { icon: ShieldCheck, title: t("landing.s4t"), desc: t("landing.s4d") },
  ];

  return (
    <>
      <section id="home" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-forest-100 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div className="animate-fade-up">
            <span className="badge mb-4 bg-forest-100 text-forest-800"><Sprout className="h-3.5 w-3.5" /> {t("landing.badge")}</span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-forest-900 sm:text-5xl">{t("landing.headline")}</h1>
            <p className="mt-4 max-w-lg text-lg text-gray-600">{t("landing.subtitle")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/detect" className="btn-primary px-6 py-3 text-base"><Upload className="h-5 w-5" /> {t("landing.uploadImage")}</Link>
              <a href="#features" className="btn-secondary px-6 py-3 text-base">{t("landing.exploreFeatures")} <ArrowRight className="h-5 w-5" /></a>
            </div>
          </div>
          <div className="animate-fade-up [animation-delay:120ms]"><HeroIllustration /></div>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-forest-900">{t("landing.featuresTitle")}</h2>
          <p className="mt-2 text-center text-gray-600">{t("landing.featuresSubtitle")}</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6 transition hover:-translate-y-1 hover:shadow-lg">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-forest-100 text-forest-800"><Icon className="h-6 w-6" /></div>
                <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
                <p className="mt-1 text-sm text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-forest-900">{t("landing.howTitle")}</h2>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="card relative p-6">
                <span className="absolute -top-3 left-6 grid h-7 w-7 place-items-center rounded-full bg-forest-800 text-sm font-bold text-white">{i + 1}</span>
                <Icon className="h-7 w-7 text-forest-700" />
                <h3 className="mt-3 font-semibold text-gray-900">{title}</h3>
                <p className="mt-1 text-sm text-gray-600">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="crops" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-forest-900">{t("landing.cropsTitle")}</h2>
          <p className="mt-2 text-center text-gray-600">{t("landing.cropsSubtitle")}</p>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {CROPS.map((c) => (
              <div key={c.key} className="card flex flex-col items-center gap-2 p-5 text-center">
                <span className="text-4xl" aria-hidden>{c.emoji}</span>
                <span className="font-semibold text-gray-900">{t(`crops.${c.key}`)}</span>
                <span className="text-xs text-gray-500">{c.n} classes</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-20 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="card overflow-hidden bg-gradient-to-br from-forest-800 to-forest-900 p-8 text-white sm:p-10">
            <h2 className="text-2xl font-bold">{t("landing.aboutTitle")}</h2>
            <p className="mt-3 leading-relaxed text-forest-100">{t("landing.aboutText")}</p>
            <Link to="/register" className="btn mt-6 bg-white text-forest-900 hover:bg-forest-100">{t("landing.cta")} <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
