import { useMemo, useState } from "react";
import { BarChart2, Copy, Plus, Search, Tag, TrendingUp } from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-[#ffffff] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff1ec] text-[#884c2d]"><Icon size={17} /></div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
          <p className="mt-0.5 text-lg font-bold text-[#111827]">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function Coupons() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [copied, setCopied] = useState("");
  const { records: coupons } = useCrmRecords("coupons");

  const filtered = useMemo(() => coupons.filter((coupon) => {
    const couponStatus = coupon.status || "Draft";
    const matchesStatus = status === "All" || couponStatus === status;
    const haystack = `${coupon.code || ""} ${coupon.assignedCompany || coupon.companyName || ""} ${coupon.assignedContact || coupon.clientName || ""} ${couponStatus}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [coupons, query, status]);

  const metrics = useMemo(() => ({
    active: coupons.filter((coupon) => coupon.status === "Active").length,
    redeemed: coupons.filter((coupon) => coupon.status === "Redeemed").length,
    expired: coupons.filter((coupon) => coupon.status === "Expired").length,
    revenue: coupons.reduce((sum, coupon) => sum + Number(coupon.revenueGenerated || 0), 0),
  }), [coupons]);

  async function copy(code) {
    if (!code) return;
    await navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 1200);
  }

  return (
    <div className="min-h-full bg-[#f5f6fa] p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9ca3af]">Finance / Sales Tools</p>
          <h1 className="mt-1 text-2xl font-bold text-[#111827]">Coupons</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">Marketing discounts with assignment, validity, usage limits, related orders, and revenue impact.</p>
        </div>
        <Button><Plus size={14} /> Create Coupon</Button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Active Coupons" value={metrics.active} icon={Tag} />
        <Metric label="Redeemed" value={metrics.redeemed} icon={TrendingUp} />
        <Metric label="Expired" value={metrics.expired} icon={Tag} />
        <Metric label="Revenue Influenced" value={money(metrics.revenue)} icon={BarChart2} />
        <Metric label="Conversion Rate" value="0%" icon={TrendingUp} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#ffffff]">
        <div className="flex flex-col gap-3 border-b border-[#f3f4f6] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {["All", "Draft", "Active", "Redeemed", "Expired", "Cancelled", "Revoked"].map((item) => (
              <button key={item} onClick={() => setStatus(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === item ? "bg-[#884c2d] text-white" : "bg-[#f3f4f6] text-[#6b7280]"}`}>{item}</button>
            ))}
          </div>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3">
            <Search size={14} className="text-[#9ca3af]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search coupons" className="w-64 bg-transparent text-sm outline-none" />
          </div>
        </div>

        {filtered.length ? (
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            {filtered.map((coupon) => (
              <div key={coupon._id || coupon.id || coupon.code} className="rounded-xl border border-[#e5e7eb] bg-[#ffffff] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-bold text-[#111827]">{coupon.code || "NO-CODE"}</p>
                      <button onClick={() => copy(coupon.code)} className="text-[#9ca3af] hover:text-[#884c2d]"><Copy size={13} /></button>
                      {copied === coupon.code && <span className="text-xs font-semibold text-emerald-600">Copied</span>}
                    </div>
                    <p className="mt-1 text-xs text-[#6b7280]">{coupon.type || coupon.amountType || "Discount"} · {coupon.value || coupon.amount || "Value not set"}</p>
                  </div>
                  <Status value={coupon.status || "Draft"} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Detail label="Company" value={coupon.assignedCompany || coupon.companyName} />
                  <Detail label="Contact" value={coupon.assignedContact || coupon.clientName} />
                  <Detail label="Validity" value={coupon.validUntil || coupon.validity} />
                  <Detail label="Usage" value={`${coupon.usageCount || 0} / ${coupon.usageLimit || "Unlimited"}`} />
                  <Detail label="Orders Generated" value={coupon.ordersGenerated || 0} />
                  <Detail label="Revenue Generated" value={money(coupon.revenueGenerated)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#111827]">No coupons yet.</p>
            <p className="mt-1 text-sm text-[#6b7280]">Coupons should be assigned to a company, contact, lead, or deal and tracked through order conversion.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-1 text-[#374151]">{value || "Not added"}</p>
    </div>
  );
}

function Status({ value }) {
  const tone = value === "Active" ? "bg-emerald-50 text-emerald-700" : value === "Redeemed" ? "bg-blue-50 text-blue-700" : /expired|cancel|revoked/i.test(value) ? "bg-red-50 text-red-600" : "bg-[#f3f4f6] text-[#6b7280]";
  return <span className={`h-fit rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}
