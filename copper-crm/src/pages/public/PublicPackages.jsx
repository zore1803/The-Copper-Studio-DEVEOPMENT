import { ArrowRight, CheckCircle2, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiGet } from "../../lib/api";

const CATEGORIES = ["CopperBrand", "CopperWeb", "CopperFlow"];

const CATEGORY_META = {
  CopperBrand: { label: "Brand Identity & Design", color: "#884c2d" },
  CopperWeb:   { label: "Website & Web Applications", color: "#2563eb" },
  CopperFlow:  { label: "Automation & Workflows", color: "#059669" },
};

const FALLBACK_PACKAGES = [
  {
    id: "copperbrand-essential", category: "CopperBrand", name: "Essential Package Plan",
    label: "Brand foundation", price: 24999, duration: "15 days delivery",
    includes: ["Logo design (3 concepts)", "Brand colour palette", "Typography selection", "Business card design", "Brand guidelines PDF"],
  },
  {
    id: "copperbrand-advance", category: "CopperBrand", name: "Advance Package Plan",
    label: "Most popular", price: 49999, duration: "25 days delivery",
    includes: ["Everything in Essential", "Extended logo suite", "Social media kit", "Letterhead & stationery", "Brand story document", "2 revision rounds"],
  },
  {
    id: "copperbrand-ultimate", category: "CopperBrand", name: "Ultimate Package Plan",
    label: "Full brand identity", price: 89999, duration: "40 days delivery",
    includes: ["Everything in Advance", "Brand strategy workshop", "Packaging design", "Brand photography direction", "Pitch deck template", "Unlimited revisions"],
  },
  {
    id: "copperweb-essential", category: "CopperWeb", name: "Essential Package Plan",
    label: "Web presence starter", price: 29999, duration: "20 days delivery",
    includes: ["5-page website", "Mobile responsive design", "Contact form integration", "Basic SEO setup", "1 month post-launch support"],
  },
  {
    id: "copperweb-advance", category: "CopperWeb", name: "Advance Package Plan",
    label: "Most popular", price: 59999, duration: "35 days delivery",
    includes: ["Everything in Essential", "Up to 15 pages", "CMS integration", "Blog setup", "Google Analytics & Search Console", "Performance optimisation"],
  },
  {
    id: "copperweb-ultimate", category: "CopperWeb", name: "Ultimate Package Plan",
    label: "Full web platform", price: 119999, duration: "60 days delivery",
    includes: ["Everything in Advance", "Custom web application", "E-commerce / payment gateway", "API integrations", "3 months dedicated support", "Hosting & domain setup"],
  },
  {
    id: "copperflow-essential", category: "CopperFlow", name: "Essential Package Plan",
    label: "Automate the basics", price: 19999, duration: "10 days delivery",
    includes: ["Lead capture automation", "Email welcome sequence", "Basic CRM setup", "Inquiry form integration", "30-day support"],
  },
  {
    id: "copperflow-advance", category: "CopperFlow", name: "Advance Package Plan",
    label: "Most popular", price: 44999, duration: "20 days delivery",
    includes: ["Everything in Essential", "Multi-step sales funnel", "WhatsApp + email automation", "Proposal & invoice workflows", "Payment reminders", "60-day support"],
  },
  {
    id: "copperflow-ultimate", category: "CopperFlow", name: "Ultimate Package Plan",
    label: "End-to-end automation", price: 79999, duration: "35 days delivery",
    includes: ["Everything in Advance", "Custom client portal", "Project milestone notifications", "Advanced analytics dashboard", "Team collaboration setup", "90-day dedicated support"],
  },
];

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function backendUrl(path) {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  if (!base) return path;
  return `${base.replace(/\/api\/?$/, "").replace(/\/$/, "")}${path}`;
}

export default function PublicPackages() {
  const [packages, setPackages] = useState(FALLBACK_PACKAGES);
  const [activeCategory, setActiveCategory] = useState("CopperBrand");

  useEffect(() => {
    apiGet("/api/packages")
      .then((data) => { if (Array.isArray(data) && data.length) setPackages(data); })
      .catch(() => {});
  }, []);

  const visible = packages.filter((p) => p.category === activeCategory);
  const featuredId = visible.find((p) => /most|popular|advance/i.test(`${p.label} ${p.name}`))?.id || visible[1]?.id;
  const meta = CATEGORY_META[activeCategory] || CATEGORY_META.CopperBrand;

  return (
    <main className="min-h-screen bg-[#f7f2ef] text-[#211a17]">
      <header className="border-b border-[#e5d8d1] bg-white/90 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#884c2d]">The Copper Studio</p>
            <h1 className="text-lg font-bold">Pricing Packages</h1>
          </div>
          <Link to="/login" className="inline-flex items-center gap-2 rounded-lg border border-[#d8c2b9] bg-white px-3 py-2 text-xs font-bold text-[#6f381a] hover:bg-[#fff1ec]">
            <LogIn size={14} /> Portal Login
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        {/* Page heading */}
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#884c2d]">Choose a package</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#111827]">Start your journey with us.</h2>
          <p className="mt-3 text-sm leading-6 text-[#6c6355]">
            Select a service category, pick your plan, and get your secure onboarding link after payment.
          </p>
        </div>

        {/* Category switcher */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-xl border border-[#e5d8d1] bg-white p-1 shadow-sm">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
                  activeCategory === cat
                    ? "bg-[#884c2d] text-white shadow-sm"
                    : "text-[#6c6355] hover:text-[#211a17]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Active category label */}
        <p className="mb-5 text-center text-xs font-medium text-[#9ca3af]">{meta.label}</p>

        {/* Package cards */}
        <div className="grid gap-5 lg:grid-cols-3">
          {visible.map((pkg) => {
            const featured = pkg.id === featuredId;
            const checkoutHref = backendUrl(`/checkout?package=${encodeURIComponent(pkg.id)}`);
            return (
              <article
                key={pkg.id}
                className={`flex flex-col rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                  featured ? "border-[#884c2d] ring-2 ring-[#884c2d]/10" : "border-[#e5d8d1]"
                }`}
              >
                {/* Header */}
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#884c2d]">{activeCategory}</p>
                    <h3 className="mt-1 text-lg font-bold text-[#111827]">{pkg.name}</h3>
                  </div>
                  {featured && (
                    <span className="shrink-0 rounded-full bg-[#fff1ec] px-2.5 py-1 text-[11px] font-bold text-[#884c2d]">
                      Popular
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="mb-5">
                  <p className="text-3xl font-bold text-[#111827]">{money(pkg.price)}</p>
                  <p className="mt-1 text-sm text-[#6c6355]">{pkg.duration}</p>
                </div>

                {/* Features */}
                <ul className="mb-6 flex-1 space-y-2.5">
                  {(pkg.includes || []).map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-[#374151]">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href={checkoutHref}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-colors ${
                    featured
                      ? "bg-[#884c2d] text-white hover:bg-[#6f381a]"
                      : "border border-[#d8c2b9] bg-white text-[#6f381a] hover:bg-[#fff1ec]"
                  }`}
                >
                  Continue to Checkout <ArrowRight size={15} />
                </a>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
