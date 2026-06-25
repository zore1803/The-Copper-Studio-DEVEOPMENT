import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SidePanel from "../../components/SidePanel";
import {
  CalendarDays, Clock3, Copy, FileDown,
  Minus, PackageCheck, Plus, ReceiptText, Send,
  Tag, Users, WalletCards, Table2, Info, ChevronLeft, ChevronRight, Search,
  RefreshCcw, AlertTriangle, Activity
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart as RePieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { Button } from "../../components/ui";
import { useToast } from "../../components/useToast";
import { useCrmRecords } from "../../hooks/useCrmRecords";
function Card({ children, className = "" }) {
  return <section className={`rounded-xl border border-[#E1E4EA] bg-[#ffffff] shadow-sm shadow-gray-100/60 ${className}`}>{children}</section>;
}

function PageShell({ title, subtitle, action, children }) {
  return (
    <div className="min-h-full bg-[#F1F1F5] p-5 xl:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">Admin</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1F2937]">{title}</h1>
          <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}


function moneyValue(value) {
  return Number(String(value ?? "").replace(/[^\d.-]/g, "")) || 0;
}

function formatMoney(value) {
  return `Rs ${Math.round(value || 0).toLocaleString("en-IN")}`;
}

function formatMoneyCompact(value) {
  const amount = Math.round(value || 0);
  if (Math.abs(amount) >= 100000) return `Rs ${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `Rs ${(amount / 1000).toFixed(1)}k`;
  return `Rs ${amount}`;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#E1E4EA] bg-[#ffffff] px-3 py-2 text-xs shadow-lg shadow-gray-200/60">
      {label && <p className="mb-1 font-bold text-[#6B7280]">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 font-semibold text-[#1F2937]">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color || entry.payload?.color }} />
          {entry.name}: {typeof entry.value === "number" && entry.name === "Revenue" ? formatMoney(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

const ANALYTICS = {
  copper: "#884c2d",
  copperLight: "#c98a63",
  green: "#10b981",
  amber: "#f59e0b",
  grid: "#f0e6e1",
};

function isPaidStatus(status) {
  return ["paid", "completed", "success", "received"].includes(String(status || "").toLowerCase());
}

function isDoneStatus(status) {
  return ["completed", "delivered"].includes(String(status || "").toLowerCase());
}

function EarningsCard({ records, filterType, filterYear, filterMonth, filterBiMonth, filterQuarter }) {
  const currentYear = new Date().getFullYear();
  const [localYear, setLocalYear] = useState(null);
  
  let year = localYear !== null ? localYear : (filterType === "All Time" ? currentYear : filterYear);
  
  const [localQuarter, setLocalQuarter] = useState(null);
  
  let defaultQIndex = 3; // Default to Q4
  if (filterType === "Quarterly") defaultQIndex = filterQuarter;
  else if (filterType === "Monthly") defaultQIndex = Math.floor(filterMonth / 3);
  else if (filterType === "Bi-Monthly") defaultQIndex = Math.floor((filterBiMonth * 2) / 3);
  
  let qIndex = localQuarter !== null ? localQuarter : defaultQIndex;
  
  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  const quarter = quarters[qIndex];
  
  const fallbackDate = useMemo(() => new Date(), []);

  const yearRecords = useMemo(() => {
    return records.filter(record => {
      const stamp = record.paidAt || record.date || record.generatedAt || record.createdAt;
      const d = stamp ? new Date(stamp) : fallbackDate;
      const parsed = Number.isNaN(d.getTime()) ? fallbackDate : d;
      return parsed.getFullYear() === year;
    });
  }, [records, year, fallbackDate]);

  const monthRows = useMemo(() => {
    const acc = {};
    for(let i=0; i<12; i++) {
        const tempD = new Date(year, i, 1);
        acc[i] = { month: tempD.toLocaleDateString("en-IN", { month: "short" }), revenue: 0 };
    }
    yearRecords.forEach((record) => {
      const rawDate = record.paidAt || record.date || record.generatedAt || record.createdAt;
      const parsedDate = rawDate ? new Date(rawDate) : fallbackDate;
      const date = Number.isNaN(parsedDate.getTime()) ? fallbackDate : parsedDate;
      const monthIndex = date.getMonth();
      acc[monthIndex].revenue += moneyValue(record.amount ?? record.total ?? record.value ?? record.package?.total ?? record.finalAmount ?? record.budget);
    });
    return acc;
  }, [yearRecords, year, fallbackDate]);

  const revenue = Object.entries(monthRows)
    .filter(([monthIndex]) => Math.floor(Number(monthIndex) / 3) === qIndex)
    .map(([, row]) => row);
  const totalRevenue = revenue.reduce((sum, m) => sum + m.revenue, 0);
  const profit = Math.round(totalRevenue * 0.35);

  const prevRevenue = Object.entries(monthRows)
    .filter(([monthIndex]) => Math.floor(Number(monthIndex) / 3) === qIndex - 1)
    .reduce((s, [, row]) => s + row.revenue, 0);
  const growth = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : (totalRevenue > 0 ? 100 : 0);
  const maxR = Math.max(...revenue.map(m => m.revenue), 1);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-[#EAECF0] px-5 py-4">
        <select 
          value={qIndex}
          onChange={(e) => setLocalQuarter(Number(e.target.value))}
          className="text-sm font-bold text-[#1F2937] bg-transparent outline-none cursor-pointer hover:bg-[#f9fafb] rounded"
        >
          <option value={0}>Q1 Earnings</option>
          <option value={1}>Q2 Earnings</option>
          <option value={2}>Q3 Earnings</option>
          <option value={3}>Q4 Earnings</option>
        </select>
        <select 
          value={year}
          onChange={(e) => setLocalYear(Number(e.target.value))}
          className="h-8 rounded-lg border border-[#E1E4EA] bg-[#F5F7FA] px-2 flex items-center text-xs font-bold text-[#525866] outline-none cursor-pointer hover:bg-[#f3f4f6]"
        >
          {[currentYear - 3, currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="p-5">
        <p className="text-xl font-bold text-[#1F2937]">{formatMoneyCompact(totalRevenue)}</p>
        <p className="text-xs text-[#6B7280]">{Math.abs(growth)}% {growth >= 0 ? "↑" : "↓"} from last quarter</p>
        {growth > 0 && <p className="text-xs font-semibold text-[#10b981] mt-1">Outperforming previous quarter</p>}
        
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#6B7280] border-t border-[#EAECF0] pt-4">
          <div>
            <p>Revenue</p>
            <p className="font-bold text-[#1F2937] text-sm">{formatMoneyCompact(totalRevenue)}</p>
          </div>
          <div>
            <p>Profit (est.)</p>
            <p className="font-bold text-[#1F2937] text-sm">{formatMoneyCompact(profit)}</p>
          </div>
        </div>
        <div className="mt-4 flex items-end gap-1 h-12">
          {revenue.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-[#884c2d]/80 transition-all duration-300"
                style={{ height: `${Math.max(Math.round((m.revenue / maxR) * 40), m.revenue > 0 ? 2 : 0)}px` }}
              />
              <span className="text-[9px] text-[#9CA3AF]">{m.month}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ChartDrillDownPanel({ data, onClose, navigate }) {
  if (!data) return null;
  const { date, orders = [], payments = [], projects = [], users = [] } = data;
  const moneyValue = (val) => {
    if (val === null || val === undefined) return 0;
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  const safeString = (val, fallback = "") => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <SidePanel title={`Analytics Detail`} subtitle={`Records for ${safeString(date)}`} onClose={onClose} width="max-w-2xl">
      <div className="space-y-6">
        {orders.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-[#1F2937] mb-3 border-b border-[#EAECF0] pb-2">Orders ({orders.length})</h3>
            <div className="flex flex-col gap-2">
              {orders.map((o, i) => (
                <div key={o._id || o.id || i} onClick={() => navigate(`/admin/companies/${o.companyId || o.customer?.companyId || o.client || ''}`)} className="cursor-pointer p-3 border border-[#E1E4EA] rounded-lg hover:border-[#cda88f] hover:shadow-sm bg-[#ffffff] transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-[#1F2937]">{safeString(o.customer?.customerName || o.client || o.companyName || "Unknown Client")}</p>
                      <p className="text-xs text-[#6B7280]">{safeString(o.customer?.customerEmail || o.contactName || o.email)}</p>
                      <p className="text-xs text-[#884c2d] mt-1 font-medium">Package: {safeString(o.package?.name || o.packageId || o.projectType || "Custom")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#1F2937]">Rs {moneyValue(o.amount ?? o.package?.total ?? o.total).toLocaleString("en-IN")}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold uppercase tracking-wider ${safeString(o.status) === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{safeString(o.status)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {payments.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-[#1F2937] mb-3 border-b border-[#EAECF0] pb-2">Payments ({payments.length})</h3>
            <div className="flex flex-col gap-2">
              {payments.map((p, i) => (
                <div key={p._id || p.id || i} onClick={() => navigate('/admin/payments')} className="cursor-pointer p-3 border border-[#E1E4EA] rounded-lg hover:border-[#cda88f] hover:shadow-sm bg-[#ffffff] transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-[#1F2937]">{safeString(p.companyName || p.clientName || p.client || "Unknown Client")}</p>
                      <p className="text-xs text-[#6B7280]">ID: {safeString(p._id || p.id)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#1F2937]">Rs {moneyValue(p.amount ?? p.value).toLocaleString("en-IN")}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold uppercase tracking-wider ${safeString(p.status) === "paid" || safeString(p.status) === "success" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{safeString(p.status)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {users.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-[#1F2937] mb-3 border-b border-[#EAECF0] pb-2">Users Created ({users.length})</h3>
            <div className="flex flex-col gap-2">
              {users.map((u, i) => (
                <div key={u._id || u.id || i} onClick={() => navigate(`/admin/companies/${u._id || u.id}`)} className="cursor-pointer p-3 border border-[#E1E4EA] rounded-lg hover:border-[#cda88f] hover:shadow-sm bg-[#ffffff] transition-all">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-[#1F2937]">{safeString(u.name || u.company || "Unknown")}</p>
                      <p className="text-xs text-[#6B7280]">{safeString(u.email)}</p>
                    </div>
                    <span className="text-[10px] font-bold text-[#9CA3AF] bg-[#F1F1F5] px-2 py-1 rounded">CLIENT</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-[#1F2937] mb-3 border-b border-[#EAECF0] pb-2">Projects Created ({projects.length})</h3>
            <div className="flex flex-col gap-2">
              {projects.map((p, i) => (
                <div key={p._id || p.id || i} onClick={() => navigate(`/admin/companies/${p.companyId || p.client}/projects/${p._id || p.id}`)} className="cursor-pointer p-3 border border-[#E1E4EA] rounded-lg hover:border-[#cda88f] hover:shadow-sm bg-[#ffffff] transition-all">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-[#1F2937]">{safeString(p.name || p.projectName || "Unknown Project")}</p>
                      <p className="text-xs text-[#6B7280]">{safeString(p.companyName || p.clientName || "Unknown Client")}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded uppercase">{safeString(p.status || p.clientStatus || "active")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {orders.length === 0 && payments.length === 0 && users.length === 0 && projects.length === 0 && (
          <div className="text-center py-10 text-[#6B7280]">
            No detailed records found for this period.
          </div>
        )}
      </div>
    </SidePanel>
  );
}

function KpiDrillDownPanel({ kpi, data, onClose }) {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  if (!kpi) return null;

  let content;

  if (kpi === "Pending Dues") {
    const pendingOrders = (data.filteredOrders || []).filter(o => !isPaidStatus(o.status));
    const pendingPayments = (data.filteredPayments || []).filter(p => !isPaidStatus(p.status));
    const pendingProjects = (data.filteredProjects || []).filter(p => !isPaidStatus(p.paymentStatus) && !p.linkedInvoiceId && moneyValue(p.finalAmount ?? p.budget) > 0);
    
    if (pendingOrders.length === 0 && pendingPayments.length === 0 && pendingProjects.length === 0) {
      content = <div className="text-center py-10 text-[#6B7280]">No pending dues for this period.</div>;
    } else {
      content = (
        <div className="flex flex-col gap-2">
          {pendingOrders.map((o, i) => (
            <div key={`o-${o._id || i}`} className="p-3 border border-[#E1E4EA] rounded-lg bg-[#ffffff]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-[#1F2937]">{String(o.customer?.customerCompany || o.company || "Unknown Company")}</p>
                  <p className="text-xs text-[#6B7280]">{String(o.customer?.customerName || o.client || "Unknown Contact")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">Rs {moneyValue(o.amount ?? o.package?.total ?? o.total).toLocaleString("en-IN")}</p>
                  <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">{String(o.status)}</span>
                </div>
              </div>
            </div>
          ))}
          {pendingPayments.map((p, i) => (
            <div key={`p-${p._id || i}`} className="p-3 border border-[#E1E4EA] rounded-lg bg-[#ffffff]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-[#1F2937]">{String(p.companyName || p.client || "Unknown Company")}</p>
                  <p className="text-xs text-[#6B7280]">{String(p.clientName || "Unknown Contact")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">Rs {moneyValue(p.amount ?? p.value).toLocaleString("en-IN")}</p>
                  <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">{String(p.status)}</span>
                </div>
              </div>
            </div>
          ))}
          {pendingProjects.map((p, i) => (
            <div key={`proj-${p._id || i}`} className="p-3 border border-[#E1E4EA] rounded-lg bg-[#ffffff]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-[#1F2937]">{String(p.companyName || p.clientName || "Unknown Company")}</p>
                  <p className="text-xs text-[#6B7280]">{String(p.name || p.projectName || "Project")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">Rs {moneyValue(p.finalAmount ?? p.budget).toLocaleString("en-IN")}</p>
                  <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">{String(p.paymentStatus || "Pending")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
  } else if (kpi === "Avg Completion Time") {
    const completedList = data.completedProjectsList || [];
    if (completedList.length === 0) {
      content = <div className="text-center py-10 text-[#6B7280]">No completed projects found.</div>;
    } else {
      content = (
        <div className="flex flex-col gap-2">
          {completedList.map((p, i) => {
            const start = new Date(p.startDate || p.createdAt || now);
            const end = new Date(p.actualEndDate || p.expectedEndDate || p.updatedAt || now);
            const diffDays = Math.max(Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), 0);
            return (
              <div key={`cp-${p._id || i}`} className="p-3 border border-[#E1E4EA] rounded-lg bg-[#ffffff]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-[#1F2937]">{String(p.name || p.projectName || "Unknown Project")}</p>
                    <p className="text-xs text-[#6B7280]">{String(p.companyName || p.clientName || "Unknown Company")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#1F2937]">{diffDays} Days</p>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-[#9CA3AF] flex justify-between">
                  <span>Start: {start.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                  <span>End: {end.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  } else if (kpi === "On-Time Delivery %") {
    const completedList = data.completedProjectsList || [];
    const onTimeProjects = [];
    const delayedProjects = [];
    completedList.forEach(p => {
      const end = new Date(p.updatedAt || p.date || now).getTime();
      const expected = new Date(p.expectedCompletion || p.dueDate || p.updatedAt || now).getTime();
      if (end <= expected) onTimeProjects.push(p);
      else delayedProjects.push(p);
    });

    content = (
      <div className="flex flex-col gap-5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-green-600 mb-2">Delivered On Time ({onTimeProjects.length})</h4>
          <div className="flex flex-col gap-2">
            {onTimeProjects.length === 0 ? <p className="text-xs text-[#9CA3AF]">None</p> : onTimeProjects.map((p, i) => (
              <div key={`on-${p._id || i}`} className="p-2 border border-green-100 bg-green-50 rounded-lg text-sm font-medium text-[#1F2937]">
                {String(p.name || p.projectName || "Unknown Project")}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">Delayed ({delayedProjects.length})</h4>
          <div className="flex flex-col gap-2">
            {delayedProjects.length === 0 ? <p className="text-xs text-[#9CA3AF]">None</p> : delayedProjects.map((p, i) => (
              <div key={`dl-${p._id || i}`} className="p-2 border border-red-100 bg-red-50 rounded-lg text-sm font-medium text-[#1F2937]">
                {String(p.name || p.projectName || "Unknown Project")}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  } else {
    content = <div className="text-center py-10 text-[#6B7280]">Drill down not available for this metric.</div>;
  }

  return (
    <SidePanel title={`${kpi} Drill Down`} onClose={onClose}>
      <div className="p-5 bg-[#F5F7FA] min-h-full">
        {content}
      </div>
    </SidePanel>
  );
}
export function AnalyticsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedChartDate, setSelectedChartDate] = useState(null);
  const [filterType, setFilterType] = useState("All Time");
  const [metricFilter, setMetricFilter] = useState("All");
  const [selectedPackage, setSelectedPackage] = useState(null);
  
  // Table states
  const [projectPage, setProjectPage] = useState(1);
  const [projectSearch, setProjectSearch] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentSearch, setPaymentSearch] = useState("");

  const [now] = useState(() => Date.now());
  const currentD = new Date(now);
  const [filterYear, setFilterYear] = useState(currentD.getFullYear());
  const [filterMonth, setFilterMonth] = useState(currentD.getMonth());
  const [filterBiMonth, setFilterBiMonth] = useState(Math.floor(currentD.getMonth() / 2));
  const [filterQuarter, setFilterQuarter] = useState(Math.floor(currentD.getMonth() / 3));
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const { records: orders } = useCrmRecords("orders");
  const { records: payments } = useCrmRecords("payments");
  const { records: projects } = useCrmRecords("projects");
  const { records: companies } = useCrmRecords("companies");
  const { records: contacts } = useCrmRecords("contacts");

  const [selectedKpiDrillDown, setSelectedKpiDrillDown] = useState(null);

  const data = useMemo(() => {
    let startDate = 0;
    let endDate = Infinity;

    if (filterType === "Monthly") {
      startDate = new Date(filterYear, filterMonth, 1).getTime();
      endDate = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59, 999).getTime();
    } else if (filterType === "Bi-Monthly") {
      startDate = new Date(filterYear, filterBiMonth * 2, 1).getTime();
      endDate = new Date(filterYear, filterBiMonth * 2 + 2, 0, 23, 59, 59, 999).getTime();
    } else if (filterType === "Quarterly") {
      startDate = new Date(filterYear, filterQuarter * 3, 1).getTime();
      endDate = new Date(filterYear, filterQuarter * 3 + 3, 0, 23, 59, 59, 999).getTime();
    } else if (filterType === "Annually") {
      startDate = new Date(filterYear, 0, 1).getTime();
      endDate = new Date(filterYear, 11, 31, 23, 59, 59, 999).getTime();
    } else if (filterType === "Custom Range") {
      startDate = customStartDate ? new Date(customStartDate).setHours(0, 0, 0, 0) : 0;
      endDate = customEndDate ? new Date(customEndDate).setHours(23, 59, 59, 999) : Infinity;
    }

    const isWithinRange = (item, isCreated = false) => {
      const stamp = isCreated ? (item.createdAt || item.date) : (item.paidAt || item.date || item.generatedAt || item.createdAt);
      if (!stamp) return true;
      const t = new Date(stamp).getTime();
      return t >= startDate && t <= endDate;
    };

    const filteredOrders = orders.filter(i => isWithinRange(i, false));
    const filteredPayments = payments.filter(i => isWithinRange(i, false));
    const filteredProjects = projects.filter(i => isWithinRange(i, true));
    const filteredCompanies = companies.filter(i => isWithinRange(i, true));
    const filteredContacts = contacts.filter(i => isWithinRange(i, true));

    const paidOrders = filteredOrders.filter((order) => isPaidStatus(order.payment?.status || order.status));
    
    // Calculate pending dues (Unpaid items)
    // Only count unpaid payments and unpaid standalone orders/projects
    const pendingOrdersAmt = filteredOrders
      .filter(o => !isPaidStatus(o.payment?.status || o.status))
      .reduce((sum, o) => sum + moneyValue(o.amount ?? o.package?.total ?? o.total), 0);
    
    // A standalone project has neither a linked invoice nor an order.
    // If it has an order, the amount is already counted in pendingOrdersAmt above.
    const standaloneProjects = filteredProjects.filter(p => !p.linkedInvoiceId && !p.orderId);
    
    const pendingProjectsAmt = standaloneProjects
      .filter(p => !isPaidStatus(p.paymentStatus))
      .reduce((sum, p) => sum + moneyValue(p.finalAmount ?? p.budget), 0);
      
    // Include pending payments too if they exist and are not already orders (fallback deduplication)
    const pendingPaymentsAmt = filteredPayments
      .filter(p => !isPaidStatus(p.status) && !p.orderId && !p.sourceOrderId)
      .reduce((sum, p) => sum + moneyValue(p.amount ?? p.value ?? p.total), 0);

    const pendingDues = pendingOrdersAmt + pendingProjectsAmt + pendingPaymentsAmt;

    const pendingPaymentsCount = 
      filteredOrders.filter(o => !isPaidStatus(o.payment?.status || o.status)).length + 
      standaloneProjects.filter(p => !isPaidStatus(p.paymentStatus)).length + 
      filteredPayments.filter(p => !isPaidStatus(p.status) && !p.orderId && !p.sourceOrderId).length;

    // Calculate revenue (Paid items)
    const paidPayments = filteredPayments.filter(p => isPaidStatus(p.status));
    const revenueFromPayments = paidPayments.reduce((sum, item) => sum + moneyValue(item.amount ?? item.value ?? item.package?.total ?? item.total), 0);
    
    // Only add revenue from projects that are PAID and STANDALONE (no invoice, no order)
    const paidProjects = standaloneProjects.filter(p => isPaidStatus(p.paymentStatus));
    const revenueFromProjects = paidProjects.reduce((sum, p) => sum + moneyValue(p.finalAmount ?? p.budget), 0);
    const revenue = revenueFromPayments + revenueFromProjects;
    const paymentRate = Math.round((paidOrders.length / Math.max(filteredOrders.length, 1)) * 100);
    
    // KPI: Average Project Value
    const avgProjectValue = Math.round(revenue / Math.max(filteredProjects.length, 1));
    
    const completedProjectsList = filteredProjects.filter((project) => isDoneStatus(project.status || project.clientStatus));
    const completedProjects = completedProjectsList.length;
    
    const delayedProjectsList = filteredProjects.filter((project) => {
      const dueRaw = project.dueDate || project.expectedCompletion || project.expectedEndDate;
      const due = dueRaw ? new Date(dueRaw).getTime() : NaN;
      return Number.isFinite(due) && due < now && !isDoneStatus(project.status || project.clientStatus);
    });
    const delayedProjects = delayedProjectsList.length;
    
    const onTrack = Math.max(filteredProjects.length - completedProjects - delayedProjects, 0);

    // KPI: Avg Project Completion Time
    const totalCompletionDays = completedProjectsList.reduce((sum, p) => {
      const start = new Date(p.startDate || p.createdAt || now).getTime();
      const end = new Date(p.actualEndDate || p.expectedEndDate || p.updatedAt || now).getTime();
      const diffDays = Math.max((end - start) / (1000 * 60 * 60 * 24), 0);
      return sum + diffDays;
    }, 0);
    const avgCompletionTime = completedProjects > 0 ? Math.round(totalCompletionDays / completedProjects) : 0;

    // KPI: On-Time Delivery %
    const onTimeProjects = completedProjectsList.filter(p => {
      const end = new Date(p.actualEndDate || p.expectedEndDate || p.updatedAt || now).getTime();
      const start = new Date(p.startDate || p.createdAt || now).getTime();
      const expectedDateStr = p.expectedEndDate || p.expectedCompletion || p.dueDate;
      const expected = expectedDateStr ? new Date(expectedDateStr).getTime() : start + 45 * 24 * 60 * 60 * 1000;
      return end <= expected;
    }).length;
    const onTimeDeliveryPercent = completedProjects > 0 ? Math.round((onTimeProjects / completedProjects) * 100) : 0;

    // KPI: Total Contacts & Clients
    const contactsPerClient = filteredCompanies.length > 0 ? (filteredContacts.length / filteredCompanies.length).toFixed(1) : 0;

    // Priority Projects List
    const priorityProjectsList = filteredProjects.map(p => {
      const isCompleted = isDoneStatus(p.status || p.clientStatus);
      const start = new Date(p.createdAt || p.date || now).getTime();
      const expectedDateStr = p.expectedCompletion || p.dueDate || p.expectedEndDate;
      const expected = expectedDateStr ? new Date(expectedDateStr).getTime() : start + 45 * 24 * 60 * 60 * 1000;
      const diffDays = Math.ceil((expected - now) / (1000 * 60 * 60 * 24));
      
      let priorityLevel = "Low";
      let priorityScore = 5;
      let progress;
      
      if (isCompleted) {
        priorityLevel = "Completed";
        priorityScore = 6;
        progress = 100;
      } else {
        const totalDuration = expected - start;
        progress = totalDuration > 0 ? Math.min(Math.max(Math.round(((now - start) / totalDuration) * 100), 0), 99) : 0;
        
        if (diffDays < 0) {
          priorityLevel = "High";
          priorityScore = 1; // Overdue
        } else if (diffDays <= 7) {
          priorityLevel = "Highest";
          priorityScore = 2; // Due within 7 days
        } else if (diffDays <= 14 || progress >= 75) {
          priorityLevel = "Medium";
          priorityScore = 3;
        } else if (diffDays <= 30) {
          priorityLevel = "Low";
          priorityScore = 4;
        }
      }
      
      return { ...p, priorityLevel, priorityScore, progress, daysRemaining: diffDays, expected, start };
    }).sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) return a.priorityScore - b.priorityScore;
      return a.expected - b.expected;
    });

    // Recent Payments List
    const recentPaymentsList = filteredPayments.map(p => ({
      id: p._id || p.id,
      date: new Date(p.date || p.createdAt || now).getTime(),
      companyName: p.companyName || p.client || "Unknown",
      contactName: p.clientName || "-",
      email: p.email || "-",
      package: p.package?.name || p.packageName || "-",
      amount: moneyValue(p.amount ?? p.value),
      status: p.status || "pending",
      orderId: p.orderId || p.paymentId || "-",
      type: "payment",
      raw: p
    })).sort((a, b) => b.date - a.date);

    const statusData = [
      { name: "On track", value: onTrack, color: ANALYTICS.green },
      { name: "Delayed", value: delayedProjects, color: ANALYTICS.amber },
      { name: "Completed", value: completedProjects, color: ANALYTICS.copper },
    ].filter((item) => item.value > 0);
    const statusTotal = statusData.reduce((sum, item) => sum + item.value, 0) || 1;

    const packageRevenueMap = filteredOrders.reduce((acc, order) => {
      const name = order.package?.name || order.packageName || order.projectType || "Unassigned";
      acc[name] = acc[name] || { name, revenue: 0, count: 0 };
      acc[name].revenue += moneyValue(order.amount ?? order.value ?? order.package?.total ?? order.total);
      acc[name].count += 1;
      return acc;
    }, {});
    
    filteredProjects.filter(p => !p.linkedInvoiceId && !p.orderId).forEach(p => {
      const name = p.packageName || p.template || "Unassigned";
      packageRevenueMap[name] = packageRevenueMap[name] || { name, revenue: 0, count: 0 };
      packageRevenueMap[name].revenue += moneyValue(p.finalAmount ?? p.budget);
      packageRevenueMap[name].count += 1;
    });
    
    const packageRevenue = Object.values(packageRevenueMap).sort((a, b) => b.revenue - a.revenue);

    const formatKey = (created) => created.toISOString().slice(0, 10);
    const formatDay = (created) => created.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

    const revenueGraph = Object.values([...paidOrders, ...paidPayments, ...paidProjects].reduce((acc, item) => {
      const stamp = item.paidAt || item.date || item.generatedAt || item.createdAt;
      const created = stamp ? new Date(stamp) : new Date(now);
      const key = formatKey(created);
      acc[key] = acc[key] || { key, day: formatDay(created), value: 0 };
      acc[key].value += moneyValue(item.amount ?? item.value ?? item.package?.total ?? item.total ?? item.finalAmount ?? item.budget);
      return acc;
    }, {})).sort((a, b) => a.key.localeCompare(b.key));

    const usersGraph = Object.values(filteredCompanies.reduce((acc, item) => {
      const stamp = item.createdAt || item.date;
      const created = stamp ? new Date(stamp) : new Date(now);
      const key = formatKey(created);
      acc[key] = acc[key] || { key, day: formatDay(created), value: 0 };
      acc[key].value += 1;
      return acc;
    }, {})).sort((a, b) => a.key.localeCompare(b.key));

    const projectsGraph = Object.values(filteredProjects.reduce((acc, item) => {
      const stamp = item.createdAt || item.date;
      const created = stamp ? new Date(stamp) : new Date(now);
      const key = formatKey(created);
      acc[key] = acc[key] || { key, day: formatDay(created), value: 0 };
      acc[key].value += 1;
      return acc;
    }, {})).sort((a, b) => a.key.localeCompare(b.key));

    let finalChartData;
    if (metricFilter === "All") {
      const mergedMap = {};
      const addData = (arr, keyName) => {
        arr.forEach(item => {
          mergedMap[item.key] = mergedMap[item.key] || { key: item.key, day: item.day, revenue: 0, users: 0, projects: 0 };
          mergedMap[item.key][keyName] = item.value;
        });
      };
      addData(revenueGraph, "revenue");
      addData(usersGraph, "users");
      addData(projectsGraph, "projects");
      finalChartData = Object.values(mergedMap).sort((a, b) => a.key.localeCompare(b.key));
      if (finalChartData.length === 0) finalChartData = [{ day: "No data", revenue: 0, users: 0, projects: 0 }];
    } else {
      const activeChartData = metricFilter === "Revenue" ? revenueGraph : metricFilter === "Users" ? usersGraph : projectsGraph;
      finalChartData = activeChartData.length > 0 ? activeChartData : [{ day: "No data", value: 0 }];
    }

    const allActivities = [
      ...orders.map(o => ({
        id: `ord-${o._id || Math.random()}`,
        type: "order",
        title: o.package?.name || o.packageName || "Package purchased",
        date: new Date(o.createdAt || o.date || now).getTime(),
        desc: `Order by ${o.customer?.customerName || 'Client'} (${o.customer?.customerCompany || 'Company'})`
      })),
      ...payments.map(p => ({
        id: `pay-${p._id || Math.random()}`,
        type: "payment",
        title: "Payment received",
        date: new Date(p.paidAt || p.date || p.generatedAt || p.createdAt || now).getTime(),
        desc: `${formatMoney(p.amount || 0)} from ${p.client || 'Client'} (${p.company || 'Company'})`
      })),
      ...projects.map(p => ({
        id: `proj-${p._id || Math.random()}`,
        type: "project",
        title: isDoneStatus(p.status || p.clientStatus) ? "Project completed" : "Project started",
        date: new Date(p.createdAt || p.date || now).getTime(),
        desc: p.projectName || p.name || 'Website Design'
      })),
      ...companies.map(c => ({
        id: `comp-${c._id || Math.random()}`,
        type: "company",
        title: "New client registered",
        date: new Date(c.createdAt || c.date || now).getTime(),
        desc: c.name || c.company || 'Client'
      }))
    ].sort((a, b) => b.date - a.date).slice(0, 10);

    const formatKeySafe = (created) => created ? created.toISOString().slice(0, 10) : null;
    let drillDownData = null;
    if (selectedChartDate) {
      const matchDate = (stamp) => {
        if (!stamp) return false;
        const d = new Date(stamp);
        return formatKeySafe(d) === selectedChartDate;
      };
      
      const ddOrders = filteredOrders.filter(o => matchDate(o.createdAt || o.date));
      const ddPayments = filteredPayments.filter(p => matchDate(p.paidAt || p.date || p.generatedAt || p.createdAt));
      const ddProjects = filteredProjects.filter(p => matchDate(p.createdAt || p.date));
      const ddUsers = filteredCompanies.filter(c => matchDate(c.createdAt || c.date));
      
      let displayDate = selectedChartDate;
      try {
        displayDate = new Date(selectedChartDate).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      } catch { /* ignore */ }
      
      drillDownData = {
        date: displayDate,
        orders: ddOrders,
        payments: ddPayments,
        projects: ddProjects,
        users: ddUsers
      };
    }

    // KPI: Client Repeat Rate
    const clientProjectCounts = {};
    filteredProjects.forEach(p => {
      const clientId = p.clientId || p.companyId || p.clientCompany || p.client;
      if (clientId) {
        clientProjectCounts[clientId] = (clientProjectCounts[clientId] || 0) + 1;
      }
    });
    filteredOrders.forEach(o => {
      const clientId = o.customerId || o.companyId || o.client;
      if (clientId) {
        clientProjectCounts[clientId] = (clientProjectCounts[clientId] || 0) + 1;
      }
    });
    const totalUniqueClients = Object.keys(clientProjectCounts).length;
    const repeatClients = Object.values(clientProjectCounts).filter(count => count > 1).length;
    const clientRepeatRate = totalUniqueClients > 0 ? Math.round((repeatClients / totalUniqueClients) * 100) : 0;

    // KPI: Current Bottleneck
    const activeProjects = filteredProjects.filter(p => !isDoneStatus(p.status || p.clientStatus));
    const phaseCounts = {};
    activeProjects.forEach(p => {
      let phase = p.currentPhase;
      if (!phase) {
        const activeStage = (p.stages || []).find(s => s.status === "in_progress");
        if (activeStage) phase = activeStage.name;
        else phase = "Not Started";
      }
      phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
    });
    let bottleneckPhase = "None";
    let maxCount = 0;
    Object.entries(phaseCounts).forEach(([phase, count]) => {
      if (count > maxCount) {
        maxCount = count;
        bottleneckPhase = phase;
      }
    });
    const currentBottleneck = maxCount > 0 ? `${bottleneckPhase} (${maxCount})` : "No bottlenecks";

    const delayedProjectsPercent = filteredProjects.length > 0 ? Math.round((delayedProjects / filteredProjects.length) * 100) : 0;

    return { 
      revenue, paymentRate, avgProjectValue, completedProjects, delayedProjects, onTrack, 
      statusData, statusTotal, packageRevenue, pendingPaymentsCount, finalChartData, allActivities,
      filteredOrders,
      filteredPayments,
      filteredCompanies,
      filteredProjects,
      filteredContacts,
      filteredCompaniesLength: filteredCompanies.length,
      filteredProjectsLength: filteredProjects.length,
      pendingDues,
      filteredContactsLength: filteredContacts.length,
      avgCompletionTime,
      onTimeDeliveryPercent,
      delayedProjectsPercent,
      contactsPerClient,
      completedProjectsList,
      delayedProjectsList,
      priorityProjectsList,
      recentPaymentsList,
      drillDownData,
      clientRepeatRate,
      currentBottleneck
    };
  }, [orders, payments, projects, companies, contacts, now, metricFilter, filterType, filterYear, filterMonth, filterBiMonth, filterQuarter, customStartDate, customEndDate, selectedChartDate]);

  const topMetrics = [
    { label: "Total Revenue", value: formatMoney(data.revenue), icon: WalletCards, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", tooltip: "Total revenue from paid orders and payments." },
    { label: "Avg Revenue", value: formatMoney(data.avgProjectValue), icon: Tag, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-100", tooltip: "Calculated as: Total Revenue ÷ Total Projects." },
    { label: "Pending Dues", value: formatMoney(data.pendingDues), icon: ReceiptText, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", tooltip: "Sum of all pending and overdue payments." },
    { label: "Active Clients", value: data.filteredCompaniesLength, icon: Users, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", tooltip: "Total number of unique companies." },
    { label: "Client Repeat Rate", value: `${data.clientRepeatRate}%`, icon: RefreshCcw, color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-100", tooltip: "Percentage of clients with more than one project or order." },
    { label: "Total Projects", value: data.filteredProjectsLength, icon: PackageCheck, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100", tooltip: "Total number of created projects." },
    { label: "Current Bottleneck", value: data.currentBottleneck, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100", tooltip: "Phase where most active projects are currently stuck." },
    { label: "Delayed Projects %", value: `${data.delayedProjectsPercent}%`, icon: Clock3, color: "text-red-600", bg: "bg-red-50", border: "border-red-100", tooltip: "Percentage of total projects that have missed their deadline and are currently delayed." },
    { label: "Avg Completion Time", value: `${data.avgCompletionTime} Days`, icon: Clock3, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", tooltip: "Average days from start to completion for delivered projects." },
    { label: "Total Contacts", value: data.filteredContactsLength, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100", tooltip: "Count of all contact persons.", subtext: `${data.contactsPerClient} Contacts per Client` },
    { label: "On-Time Delivery %", value: `${data.onTimeDeliveryPercent}%`, icon: CalendarDays, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-100", tooltip: "(Projects Delivered On Time ÷ Total Completed Projects) × 100" }
  ];

  return (
    <>
    <PageShell
      title="Analytics"
      subtitle="Revenue, projects, payments, product performance, and delivery health."
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">

          <div className="flex items-center gap-2 rounded-xl border border-[#E1E4EA] bg-[#ffffff] p-1">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-8 rounded-lg bg-transparent px-2 text-xs font-bold text-[#525866] outline-none hover:bg-[#f9fafb] focus:bg-[#F5F7FA]">
              {["Monthly", "Bi-Monthly", "Quarterly", "Annually", "Custom Range", "All Time"].map((item) => <option key={item}>{item}</option>)}
            </select>
            
            {filterType !== "All Time" && filterType !== "Custom Range" && (
              <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="h-8 rounded-lg bg-transparent px-2 text-xs font-bold text-[#525866] outline-none border-l border-[#E1E4EA] hover:bg-[#f9fafb] focus:bg-[#F5F7FA]">
                {[currentD.getFullYear() - 3, currentD.getFullYear() - 2, currentD.getFullYear() - 1, currentD.getFullYear(), currentD.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}

            {filterType === "Monthly" && (
              <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="h-8 rounded-lg bg-transparent px-2 text-xs font-bold text-[#525866] outline-none border-l border-[#E1E4EA] hover:bg-[#f9fafb] focus:bg-[#F5F7FA]">
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            )}

            {filterType === "Bi-Monthly" && (
              <select value={filterBiMonth} onChange={(e) => setFilterBiMonth(Number(e.target.value))} className="h-8 rounded-lg bg-transparent px-2 text-xs font-bold text-[#525866] outline-none border-l border-[#E1E4EA] hover:bg-[#f9fafb] focus:bg-[#F5F7FA]">
                {["Jan-Feb", "Mar-Apr", "May-Jun", "Jul-Aug", "Sep-Oct", "Nov-Dec"].map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            )}

            {filterType === "Quarterly" && (
              <select value={filterQuarter} onChange={(e) => setFilterQuarter(Number(e.target.value))} className="h-8 rounded-lg bg-transparent px-2 text-xs font-bold text-[#525866] outline-none border-l border-[#E1E4EA] hover:bg-[#f9fafb] focus:bg-[#F5F7FA]">
                {["Q1 (Jan-Mar)", "Q2 (Apr-Jun)", "Q3 (Jul-Sep)", "Q4 (Oct-Dec)"].map((q, i) => <option key={i} value={i}>{q}</option>)}
              </select>
            )}

            {filterType === "Custom Range" && (
              <div className="flex items-center gap-1 border-l border-[#E1E4EA] px-2">
                <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-8 rounded-lg bg-transparent px-1 text-xs font-bold text-[#525866] outline-none hover:bg-[#f9fafb]" />
                <span className="text-[#9CA3AF] text-xs">to</span>
                <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-8 rounded-lg bg-transparent px-1 text-xs font-bold text-[#525866] outline-none hover:bg-[#f9fafb]" />
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="grid gap-5 2xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <div className="relative group">
            <button 
              onClick={() => { document.getElementById('kpi-scroll-container').scrollBy({ left: -300, behavior: 'smooth' }) }} 
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-[#ffffff] border border-[#E1E4EA] rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#f9fafb] hidden md:block"
            >
              <ChevronLeft size={18} className="text-[#525866]" />
            </button>
            
            <div id="kpi-scroll-container" className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {topMetrics.map((item) => (
                <Card 
                  key={item.label} 
                  onClick={() => setSelectedKpiDrillDown(item.label)}
                  className={`p-4 border-l-4 ${item.border} flex-shrink-0 w-[85vw] sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)] snap-start cursor-pointer hover:shadow-md transition-all relative group/card`}
                >
                  <div className="flex justify-between items-start">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>
                      <item.icon size={17} />
                    </div>
                    {item.tooltip && (
                      <div className="relative">
                        <Info size={14} className="text-gray-300 hover:text-[#6B7280] transition-colors" />
                        <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] leading-tight rounded shadow-lg opacity-0 pointer-events-none group-hover/card:opacity-100 transition-opacity z-20">
                          {item.tooltip}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-2xl font-bold text-[#1F2937]">{item.value}</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{item.label}</p>
                  {item.subtext && <p className="text-[10px] text-[#6B7280] mt-1 font-medium">{item.subtext}</p>}
                </Card>
              ))}
            </div>

            <button 
              onClick={() => { document.getElementById('kpi-scroll-container').scrollBy({ left: 300, behavior: 'smooth' }) }} 
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-[#ffffff] border border-[#E1E4EA] rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#f9fafb] hidden md:block"
            >
              <ChevronRight size={18} className="text-[#525866]" />
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAECF0] px-5 py-4 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1F2937]">{metricFilter} over time</h3>
                  <p className="text-xs text-[#9CA3AF]">{filterType}</p>
                </div>
                <div className="flex gap-2">
                  {["All", "Revenue", "Users", "Projects"].map(m => (
                    <button key={m} onClick={() => setMetricFilter(m)} className={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${metricFilter === m ? 'bg-[#884c2d] text-white' : 'bg-[#F1F1F5] text-[#6B7280] hover:bg-gray-200'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-80 p-4 relative">
                <ResponsiveContainer width="100%" height="100%" className="animate-in fade-in duration-500">
                  <AreaChart data={data.finalChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={(e) => {
                    if (e && e.activePayload && e.activePayload.length > 0) {
                      const clickedKey = e.activePayload[0].payload.key;
                      if (clickedKey) {
                        showToast({ title: "Chart Clicked", message: "Key: " + clickedKey });
                        setSelectedChartDate(clickedKey);
                      }
                    } else if (e && e.activeLabel) {
                      showToast({ title: "Chart Clicked", message: "Label: " + e.activeLabel });
                      const matchedItem = data.finalChartData.find(item => item.day === e.activeLabel);
                      if (matchedItem) setSelectedChartDate(matchedItem.key);
                    } else {
                      showToast({ title: "Chart Clicked", message: "No data point registered." });
                    }
                  }}>
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ANALYTICS.copper} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={ANALYTICS.copper} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={ANALYTICS.grid} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} minTickGap={24} />
                    {metricFilter === "All" ? (
                      <>
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={24} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={formatMoneyCompact} width={64} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke={ANALYTICS.copper} strokeWidth={2.5} fill="url(#chartFill)" activeDot={{ r: 4 }} />
                        <Area yAxisId="left" type="monotone" dataKey="users" name="Users" stroke="#3b82f6" strokeWidth={2.5} fill="none" activeDot={{ r: 4 }} />
                        <Area yAxisId="left" type="monotone" dataKey="projects" name="Projects" stroke="#8b5cf6" strokeWidth={2.5} fill="none" activeDot={{ r: 4 }} />
                      </>
                    ) : (
                      <>
                        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={metricFilter === "Revenue" ? formatMoneyCompact : (v) => v} width={64} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="value" name={metricFilter} stroke={ANALYTICS.copper} strokeWidth={2.5} fill="url(#chartFill)" activeDot={{ r: 4 }} />
                      </>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div className="border-b border-[#EAECF0] px-5 py-4">
                <h3 className="text-sm font-bold text-[#1F2937]">Project status</h3>
              </div>
              <div className="h-56 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={data.statusData.length ? data.statusData : [{ name: "No data", value: 1, color: "#e5e7eb" }]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={84}
                      paddingAngle={4}
                      stroke="#ffffff"
                      strokeWidth={2}
                      labelLine={false}
                    >
                      {(data.statusData.length ? data.statusData : [{ name: "No data", color: "#e5e7eb" }]).map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                {(data.statusData.length ? data.statusData : [{ name: "No data", value: 0, color: "#e5e7eb" }]).map((item) => (
                  <div key={item.name} className="rounded-xl bg-[#F5F7FA] p-3">
                    <span className="block h-2 w-2 rounded-full" style={{ background: item.color }} />
                    <p className="mt-2 text-[10px] font-bold text-[#374151]">{item.name}</p>
                    <p className="text-sm font-bold text-[#1F2937]">{item.value}<span className="ml-1 text-[11px] font-semibold text-[#9CA3AF]">({Math.round((item.value / data.statusTotal) * 100)}%)</span></p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">Top products by revenue</h3>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.packageRevenue.length ? data.packageRevenue : [{ name: "No orders", revenue: 0 }]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ANALYTICS.copper} stopOpacity={1} />
                          <stop offset="100%" stopColor={ANALYTICS.copperLight} stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={ANALYTICS.grid} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={formatMoneyCompact} width={56} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: ANALYTICS.copper, opacity: 0.06 }} />
                      <Bar dataKey="revenue" name="Revenue" fill="url(#barFill)" radius={[8, 8, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">Orders per package</h3>
                <div className="mt-4 space-y-3">
                  {(data.packageRevenue.length ? data.packageRevenue : [{ name: "No packages yet", revenue: 0, count: 0 }]).map((item) => (
                    <div 
                      key={item.name} 
                      className={`rounded-xl border bg-[#F5F7FA] p-3 transition-all ${item.count > 0 ? "cursor-pointer hover:border-[#cda88f] hover:shadow-sm" : "border-[#E1E4EA]"}`}
                      onClick={() => item.count > 0 && setSelectedPackage(item.name)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-[#1F2937]">{item.name}</p>
                        <p className={`text-xs font-bold ${item.count > 0 ? "text-[#884c2d] underline decoration-[#884c2d]/30 underline-offset-2" : "text-[#9CA3AF]"}`}>
                          {item.count} {item.count === 1 ? "order" : "orders"}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-[#6B7280]">{formatMoney(item.revenue)} revenue</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <PriorityProjectsTable 
            projects={data.priorityProjectsList} 
            page={projectPage} 
            setPage={setProjectPage} 
            search={projectSearch} 
            setSearch={setProjectSearch} 
            navigate={navigate} 
          />
          <RecentPaymentsTable 
            payments={data.recentPaymentsList} 
            page={paymentPage} 
            setPage={setPaymentPage} 
            search={paymentSearch} 
            setSearch={setPaymentSearch} 
            navigate={navigate} 
          />
        </div>

        <div className="flex flex-col gap-5">
          <EarningsCard 
            records={[...data.filteredPayments.filter(p => isPaidStatus(p.status)), ...data.filteredProjects.filter(p => isPaidStatus(p.paymentStatus) && !p.linkedInvoiceId && !p.orderId)]} 
            filterType={filterType}
            filterYear={filterYear}
            filterMonth={filterMonth}
            filterBiMonth={filterBiMonth}
            filterQuarter={filterQuarter}
          />
          
          <Card>
            <div className="border-b border-[#EAECF0] px-5 py-4">
              <h3 className="text-sm font-bold text-[#1F2937]">Recent Activity</h3>
            </div>
            <div className="p-5">
              {data.allActivities.length > 0 ? (
                <div className="relative border-l border-[#E1E4EA] ml-3 space-y-6">
                  {data.allActivities.map((activity) => (
                    <div key={activity.id} className="relative pl-5">
                      <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white bg-[#cda88f]" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                        {new Date(activity.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-[#1F2937]">{activity.title}</p>
                      <p className="text-xs text-[#6B7280]">{activity.desc}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6B7280] text-center py-4">No recent activity</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#ffffff] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#EAECF0] p-5">
              <div>
                <h3 className="text-lg font-bold text-[#1F2937]">{selectedPackage} Orders</h3>
                <p className="mt-1 text-xs text-[#6B7280]">Detailed list of clients who purchased this package</p>
              </div>
              <button 
                onClick={() => setSelectedPackage(null)} 
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#f3f4f6] hover:text-[#525866] transition-colors"
              >
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-[#F5F7FA]/50">
              <div className="space-y-3">
                {data.filteredOrders
                  .filter(o => (o.package?.name || o.packageName || o.projectType || "Unassigned") === selectedPackage)
                  .sort((a, b) => new Date(b.createdAt || b.date || now) - new Date(a.createdAt || a.date || now))
                  .map((o, i) => (
                  <div key={o._id || i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#E1E4EA] bg-[#ffffff] p-4 shadow-sm transition-shadow hover:shadow">
                    <div>
                      <p className="text-sm font-bold text-[#1F2937]">{o.customer?.customerName || o.client || 'Unknown Client'}</p>
                      <p className="mt-1 text-xs font-medium text-[#6B7280]">{o.customer?.customerCompany || o.company || 'Unknown Company'}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-sm font-bold text-emerald-600">{formatMoney(o.amount ?? o.value ?? o.package?.total ?? o.total)}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                        {new Date(o.createdAt || o.date || now).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
    {selectedChartDate && data.drillDownData && (
      <ChartDrillDownPanel data={data.drillDownData} onClose={() => setSelectedChartDate(null)} navigate={navigate} />
    )}
    {selectedKpiDrillDown && (
      <KpiDrillDownPanel kpi={selectedKpiDrillDown} data={data} onClose={() => setSelectedKpiDrillDown(null)} navigate={navigate} />
    )}
    </>
  );
}

function PriorityProjectsTable({ projects, page, setPage, search, setSearch, navigate }) {
  const itemsPerPage = 5;
  
  const filtered = projects.filter(p => 
    (p.projectName || p.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.company || p.clientCompany || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.client || "").toLowerCase().includes(search.toLowerCase())
  );
  
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const displayed = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const getBadgeColor = (level) => {
    switch (level) {
      case "High": return "bg-red-100 text-red-700 border-red-200";
      case "Highest": return "bg-orange-100 text-orange-700 border-orange-200";
      case "Medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "Low": return "bg-green-100 text-green-700 border-green-200";
      case "Completed": return "bg-[#F1F1F5] text-[#374151] border-[#E1E4EA]";
      default: return "bg-[#F1F1F5] text-[#374151] border-[#E1E4EA]";
    }
  };

  const getStatusLabel = (level) => {
    switch (level) {
      case "High": return "Overdue";
      case "Highest": return "Due Soon";
      case "Medium": return "In Progress";
      case "Low": return "On Track";
      case "Completed": return "Completed";
      default: return level;
    }
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAECF0] px-5 py-4 gap-4">
        <div>
          <h3 className="text-base font-bold text-[#1F2937]">Priority Projects</h3>
          <p className="text-xs text-[#6B7280] mt-1">Projects requiring attention based on deadlines</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={14} />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-4 py-1.5 text-sm border border-[#E1E4EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#884c2d]/20 focus:border-[#884c2d] w-full sm:w-64 transition-all"
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#525866]">Project Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#525866]">Company / Contact</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#525866]">Package</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#525866]">Timeline</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#525866]">Progress</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#525866]">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-[#ffffff]">
            {displayed.length > 0 ? displayed.map(p => (
              <tr 
                key={p._id || p.id} 
                className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                onClick={() => navigate(`/admin/companies/${p.companyId || 'company'}/projects/${p._id || p.id}`)}
              >
                <td className="px-5 py-4">
                  <p className="font-bold text-[#1F2937]">{String(p.projectName || p.name || 'Unknown Project')}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{String(p.status || p.clientStatus || 'Pending')}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="font-medium text-[#1F2937]">{String(p.company || p.clientCompany || '-')}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{String(p.client || p.contactName || '-')}</p>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#F1F1F5] text-[#1F2937]">
                    {String(p.package?.name || p.packageName || p.projectType || 'Custom')}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] text-[#6B7280]">
                      <span className="font-medium text-[#1F2937]">Start:</span> {new Date(p.start).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-[11px] text-[#6B7280]">
                      <span className="font-medium text-[#1F2937]">Due:</span> {new Date(p.expected).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {p.priorityLevel !== "Completed" && (
                      <p className={`text-[10px] font-bold ${p.daysRemaining < 0 ? "text-red-600" : "text-[#884c2d]"}`}>
                        {p.daysRemaining < 0 ? `${Math.abs(p.daysRemaining)} days late` : `${p.daysRemaining} days left`}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-full max-w-[100px] bg-gray-200 rounded-full h-1.5">
                      <div className="bg-[#884c2d] h-1.5 rounded-full" style={{ width: `${p.progress}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-[#374151]">{p.progress}%</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getBadgeColor(p.priorityLevel)}`}>
                    {getStatusLabel(p.priorityLevel)}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" className="px-5 py-8 text-center text-sm text-[#6B7280]">
                  No priority projects found for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#EAECF0] px-5 py-3">
          <p className="text-xs text-[#6B7280]">Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filtered.length)} of {filtered.length} entries</p>
          <div className="flex gap-1">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="p-1 rounded text-[#6B7280] hover:bg-[#f3f4f6] disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="p-1 rounded text-[#6B7280] hover:bg-[#f3f4f6] disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function RecentPaymentsTable({ payments, page, setPage, search, setSearch, navigate }) {
  const itemsPerPage = 5;
  
  const filtered = payments.filter(p => 
    (p.companyName || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.contactName || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.orderId || "").toLowerCase().includes(search.toLowerCase())
  );
  
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const displayed = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    if (s.includes("paid") || s.includes("success")) return "bg-green-100 text-green-700 border-green-200";
    if (s.includes("pending")) return "bg-orange-100 text-orange-700 border-orange-200";
    if (s.includes("overdue") || s.includes("late")) return "bg-red-100 text-red-700 border-red-200";
    if (s.includes("fail") || s.includes("decline")) return "bg-red-50 text-red-900 border-red-200";
    if (s.includes("refund")) return "bg-[#F1F1F5] text-[#374151] border-[#E1E4EA]";
    return "bg-[#F1F1F5] text-[#374151] border-[#E1E4EA]";
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAECF0] px-5 py-4 gap-4">
        <div>
          <h3 className="text-base font-bold text-[#1F2937]">Recent Payments</h3>
          <p className="text-xs text-[#6B7280] mt-1">Latest transactions and order payments</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={14} />
            <input 
              type="text" 
              placeholder="Search payments..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-4 py-1.5 text-sm border border-[#E1E4EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#884c2d]/20 focus:border-[#884c2d] w-full sm:w-64 transition-all"
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#525866]">Date</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#525866]">Company / Contact</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#525866]">Package / Order ID</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-[#525866]">Amount</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#525866]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-[#ffffff]">
            {displayed.length > 0 ? displayed.map(p => (
              <tr 
                key={`${p.type}-${p.id}`} 
                className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                onClick={() => navigate('/admin/payments')}
              >
                <td className="px-5 py-4">
                  <p className="font-medium text-[#1F2937]">
                    {new Date(p.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="text-[10px] uppercase text-[#9CA3AF] mt-0.5">
                    {new Date(p.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <p className="font-bold text-[#1F2937]">{String(p.companyName || 'Unknown')}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-[#6B7280]">{String(p.contactName || '-')}</span>
                    {p.email !== "-" && <span className="text-xs text-[#9CA3AF]">({String(p.email)})</span>}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="font-medium text-[#1F2937]">{String(p.package || '-')}</p>
                  <p className="text-xs font-mono text-[#6B7280] mt-0.5">{String(p.orderId || '-')}</p>
                </td>
                <td className="px-5 py-4 text-right">
                  <p className="font-bold text-[#1F2937]">{formatMoney(p.amount)}</p>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${getStatusColor(p.status)}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="px-5 py-8 text-center text-sm text-[#6B7280]">
                  No payments found for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#EAECF0] px-5 py-3">
          <p className="text-xs text-[#6B7280]">Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filtered.length)} of {filtered.length} entries</p>
          <div className="flex gap-1">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="p-1 rounded text-[#6B7280] hover:bg-[#f3f4f6] disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="p-1 rounded text-[#6B7280] hover:bg-[#f3f4f6] disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

