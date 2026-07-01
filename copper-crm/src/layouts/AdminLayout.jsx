import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, BarChart2, Building2, ChevronDown,
  ChevronsLeft, ChevronsRight, ChevronRight, CreditCard, FileSignature,
  FolderKanban, FolderOpen, LayoutDashboard,
  LogOut, Plus, ReceiptText, Search, Settings,
  ShoppingCart, UserRound, Wallet, Package,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { storeGet } from "../lib/store";
import { useCrmRecords } from "../hooks/useCrmRecords";
import { useToast } from "../components/useToast";

const NAV_SECTIONS = [
  {
    label: "CRM",
    items: [
      { icon: BarChart2, to: "/admin/analytics", label: "Analytics" },
      { icon: Building2, to: "/admin/companies", label: "Companies" },
      { icon: UserRound, to: "/admin/contacts", label: "Contacts" },
    ],
  },
  {
    label: "Business",
    items: [
      {
        icon: ShoppingCart, label: "Sales",
        children: [
          { icon: ReceiptText, to: "/admin/invoices", label: "Invoices" },
          { icon: CreditCard, to: "/admin/payments", label: "Payments" },
        ],
      },
      {
        icon: Package, label: "Products & Services",
        children: [
          { icon: FileSignature, to: "/admin/services/proposal-generator", label: "Proposal Generator" },
          { icon: Wallet, to: "/admin/coupons", label: "Coupons" },
        ],
      },
      {
        icon: FolderKanban, label: "Projects",
        children: [
          { icon: FolderKanban, to: "/admin/projects", label: "Projects" },
          { icon: LayoutDashboard, to: "/admin/kanban", label: "Kanban Board" },
          { icon: BarChart2, to: "/admin/timeline", label: "Timeline" },
        ],
      },
      { icon: FolderOpen, label: "Documents", to: "/admin/documents" },
    ],
  },
];

const pageNames = {
  "/admin": "Analytics",
  "/admin/analytics": "Analytics",
  "/admin/timeline": "Timeline",
  "/admin/payments": "Payments",
  "/admin/companies": "Companies",
  "/admin/contacts": "Contacts",
  "/admin/projects": "Projects",
  "/admin/kanban": "Kanban Board",
  "/admin/tasks": "Tasks",
  "/admin/invoices": "Invoices",
  "/admin/coupons": "Coupons",
  "/admin/services/coupon-generator": "Coupon Generator",
  "/admin/services/proposal-generator": "Proposal Generator",
  "/admin/services/communications": "Communication",
  "/admin/communication/email-templates": "Email Templates",
  "/admin/communication/whatsapp-templates": "WhatsApp Templates",
  "/admin/documents": "Documents",
  "/admin/database": "Database",
  "/admin/settings": "Settings",
};

const searchablePages = [
  { label: "Analytics", to: "/admin/analytics", keywords: "revenue orders graph payment analytics" },
  { label: "Companies", to: "/admin/companies", keywords: "accounts gstin company industry client business" },
  { label: "Contacts", to: "/admin/contacts", keywords: "people email phone designation client contact" },
  { label: "Projects", to: "/admin/projects", keywords: "project delivery timeline active orders" },
  { label: "Kanban Board", to: "/admin/kanban", keywords: "tasks board drag status todo progress done" },
  { label: "Timeline", to: "/admin/timeline", keywords: "project timeline gantt schedule milestones" },
  { label: "Tasks", to: "/admin/tasks", keywords: "tasks meetings activities reminders" },
  { label: "Payments", to: "/admin/payments", keywords: "payments collection transaction gateway" },
  { label: "Invoices", to: "/admin/invoices", keywords: "billing invoice gst payment" },
  { label: "Coupons", to: "/admin/coupons", keywords: "coupons discount codes finance" },
  { label: "Coupon Generator", to: "/admin/services/coupon-generator", keywords: "coupon code discount" },
  { label: "Proposal Generator", to: "/admin/services/proposal-generator", keywords: "proposal pdf client" },
  { label: "Documents", to: "/admin/documents", keywords: "documents company project folders files" },
  { label: "Email Templates", to: "/admin/communication/email-templates", keywords: "email templates communication" },
  { label: "WhatsApp Templates", to: "/admin/communication/whatsapp-templates", keywords: "whatsapp templates communication" },
  { label: "Settings", to: "/admin/settings", keywords: "profile password admin settings" },
];

// Friendly labels for project sub-page segments (the route says "tasks" but the
// tab/label is "Timeline").
const SUBPAGE_LABELS = { tasks: "Timeline", files: "Files" };

function getBreadcrumbs(pathname, companies = [], projects = [], contacts = []) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "Analytics", to: "/admin" }];
  let path = "";
  const rest = segments.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const seg = rest[i];
    path += "/" + seg;
    const fullPath = "/admin" + path;
    // ".../projects/:id" routes require the id — the bare ".../projects" segment isn't navigable on its own, so skip its link.
    if (seg === "projects" && rest[i + 1] && !pageNames[fullPath]) continue;
    let name = pageNames[fullPath] || SUBPAGE_LABELS[seg];
    if (!name) {
      const company = companies.find((c) => String(c.id) === seg || String(c._id) === seg);
      const project = projects.find((p) => String(p.id) === seg || String(p._id) === seg);
      const contact = contacts.find((c) => String(c.id) === seg || String(c._id) === seg);
      const contactName = contact ? (contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim()) : null;
      name = company?.name || project?.name || contactName || (seg.length > 8 ? seg.slice(0, 8) + "â€¦" : seg.charAt(0).toUpperCase() + seg.slice(1));
    }
    crumbs.push({ label: name, to: fullPath });
  }
  return crumbs;
}

function initialsOf(name) {
  return (name || "").trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "â€”";
}

function isLeafActive(item, pathname) {
  if (item.to === "/admin/analytics" && pathname === "/admin") return true;
  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}

function isGroupActive(item, pathname) {
  return (item.children || []).some((child) => isLeafActive(child, pathname));
}

function NavLeaf({ item, collapsed, active, onNavigate, indent = false }) {
  // Collapsed leaves use the same fixed boxed icon as NavGroup so every item in
  // the rail shares one consistent square covering (instead of a thinner,
  // full-width hit area for the top-level links).
  if (collapsed) {
    return (
      <button
        onClick={() => onNavigate(item.to)}
        title={item.label}
        className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
          active ? "bg-white border-[#E5E5E5] text-[#C57E5B] shadow-sm" : "border-transparent text-[#374151] hover:bg-white/70"
        }`}
      >
        <item.icon size={20} strokeWidth={1.8} className="shrink-0" />
      </button>
    );
  }
  return (
    <button
      onClick={() => onNavigate(item.to)}
      className={`group relative flex w-full items-center gap-3 rounded-lg transition-colors py-2 ${indent ? "pl-9 pr-3" : "px-3"} ${active ? "bg-white border border-[#E5E5E5] text-[#C57E5B] shadow-sm" : "text-[#374151] hover:bg-white/70"}`}
    >
      <item.icon size={16} strokeWidth={1.8} className="shrink-0" />
      <span className="truncate text-sm font-medium">{item.label}</span>
    </button>
  );
}

function NavGroup({ item, collapsed, active, onNavigate, location }) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const open = hoverOpen || active;
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const closeTimer = useRef(null);

  function openFlyout() {
    clearTimeout(closeTimer.current);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setFlyoutPos({ top: rect.top, left: rect.right + 8 });
    setFlyoutOpen(true);
  }

  function scheduleCloseFlyout() {
    closeTimer.current = setTimeout(() => setFlyoutOpen(false), 150);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  if (collapsed) {
    return (
      <div ref={triggerRef} className="relative" onMouseEnter={openFlyout} onMouseLeave={scheduleCloseFlyout}>
        <button
          title={item.label}
          className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
            active ? "bg-white border-[#E5E5E5] text-[#C57E5B]" : "border-transparent text-[#374151] hover:bg-white/70"
          }`}
        >
          <item.icon size={20} strokeWidth={1.8} />
        </button>
        {flyoutOpen && createPortal(
          <div
            style={{ position: "fixed", top: flyoutPos.top, left: flyoutPos.left }}
            className="w-56 rounded-xl border border-[#E5E5E5] bg-white shadow-lg py-1.5 z-[100]"
            onMouseEnter={openFlyout}
            onMouseLeave={scheduleCloseFlyout}
          >
            <p className="px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{item.label}</p>
            {item.children.map((child) => (
              <button
                key={child.to}
                onClick={() => { setFlyoutOpen(false); onNavigate(child.to); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#f9fafb] ${isLeafActive(child, location) ? "text-[#C57E5B] font-semibold" : "text-[#374151]"}`}
              >
                <child.icon size={15} className="shrink-0" />
                <span className="truncate">{child.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div onMouseEnter={() => setHoverOpen(true)} onMouseLeave={() => setHoverOpen(false)}>
      <button
        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors ${active ? "text-[#C57E5B]" : "text-[#374151] hover:bg-white/70"}`}
      >
        <span className="flex items-center gap-3">
          <item.icon size={16} strokeWidth={1.8} />
          <span className="text-sm font-medium">{item.label}</span>
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <NavLeaf key={child.to} item={child} collapsed={false} active={isLeafActive(child, location)} onNavigate={onNavigate} indent />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { records: companies } = useCrmRecords("companies");
  const { records: contacts } = useCrmRecords("contacts");
  const { records: projects } = useCrmRecords("projects");
  const { records: tasks } = useCrmRecords("tasks");
  const { records: invoices } = useCrmRecords("invoices");
  const { notifHistory, unreadCount, markAllRead, clearHistory } = useToast();
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const collapsed = !pinnedOpen && !hovered;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [recordIndex, setRecordIndex] = useState([]);
  const searchRef = useRef(null);
  const quickAddRef = useRef(null);
  const notifRef = useRef(null);
  const avatarRef = useRef(null);

  useEffect(() => {
    function onOutside(e) {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target)) setQuickAddOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const notifications = useMemo(() => {
    const today = new Date();
    const overdueTasks = tasks.filter((t) => {
      const due = t.dueDate || t.deadline;
      if (!due) return false;
      const d = new Date(due);
      return !Number.isNaN(d.getTime()) && d < today && !["completed", "done"].includes(String(t.status || "").toLowerCase());
    });
    const outstandingInvoices = invoices.filter((i) => String(i.status || "").toLowerCase() !== "paid");
    return [
      ...overdueTasks.slice(0, 5).map((t) => ({
        id: `task-${t.id || t._id}`,
        text: `Task overdue: ${t.title || t.taskName || "Untitled task"}`,
        time: t.dueDate || t.deadline,
        to: "/admin/tasks",
      })),
      ...outstandingInvoices.slice(0, 5).map((i) => ({
        id: `invoice-${i.id || i._id}`,
        text: `Invoice ${i.invoiceNumber || i.id || i._id} is unpaid`,
        time: i.dueDate ? `Due ${i.dueDate}` : "Pending",
        to: "/admin/invoices",
      })),
    ];
  }, [tasks, invoices]);

  const QUICK_ADD = [
    { icon: Building2, label: "New Company", to: "/admin/companies" },
    { icon: UserRound, label: "New Contact", to: "/admin/contacts" },
    { icon: FolderKanban, label: "New Project", to: "/admin/projects" },
    { icon: ReceiptText, label: "New Invoice", to: "/admin/invoices" },
  ];

  const name = auth.user?.name || "Admin";
  const initials = initialsOf(name);
  const breadcrumbs = getBreadcrumbs(location.pathname, companies, projects, contacts);

  useEffect(() => {
    function buildIndex() {
      const companyRecords = storeGet("companies");
      const contacts = storeGet("contacts");
      const projects = storeGet("projects");
      const invoices = storeGet("invoices");
      const documents = storeGet("documents");
      setRecordIndex([
        ...companyRecords.map((c) => ({ type: "Company", label: c.companyName || c.name, sublabel: c.industry, to: `/admin/companies/${c.id || c._id}` })),
        ...contacts.map((c) => ({ type: "Contact", label: c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim(), sublabel: c.company, to: `/admin/contacts/${c.id || c._id}` })),
        ...projects.map((p) => ({ type: "Project", label: p.name || p.projectName, sublabel: p.client, to: `/admin/companies/${p.companyId}/projects/${p.id || p._id}` })),
        ...invoices.map((i) => ({ type: "Invoice", label: i.invoiceNumber || i.id || i._id, sublabel: i.company || i.client, to: "/admin/invoices" })),
        ...documents.map((d) => ({ type: "Document", label: d.fileName || d.name, sublabel: d.visibility || d.fileType, to: "/admin/documents" })),
      ].filter((item) => item.label));
    }
    buildIndex();
    function onUpdate() { buildIndex(); }
    window.addEventListener("cs-store", onUpdate);
    return () => window.removeEventListener("cs-store", onUpdate);
  }, []);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const recordMatches = recordIndex
      .filter((r) => `${r.label} ${r.sublabel || ""}`.toLowerCase().includes(query))
      .slice(0, 5);
    const pageMatches = searchablePages
      .filter((p) => `${p.label} ${p.keywords}`.toLowerCase().includes(query))
      .map((p) => ({ type: "Page", label: p.label, to: p.to }))
      .slice(0, 5 - recordMatches.length);
    return [...recordMatches, ...pageMatches];
  }, [searchQuery, recordIndex]);

  function openResult(result) {
    navigate(result.to);
    setSearchQuery("");
    setSearchFocused(false);
  }

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function quickAdd(item) {
    setQuickAddOpen(false);
    navigate(item.to, { state: { openCreate: true } });
  }

  const sidebarW = collapsed ? 66 : 264;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F1F1F5]">
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 flex flex-col bg-[#FAFAFA] border-r border-[#ECECEC] transition-all duration-200"
        style={{ width: sidebarW }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Logo */}
        <div className={`flex items-center justify-center border-b border-[#ECECEC] ${collapsed ? "px-1 py-3" : "px-4 py-5"}`}>
          <img
            src="/copper-studio-wordmark.png"
            alt="Copper Studio"
            className={`object-contain ${collapsed ? "h-8 w-auto" : "h-9 w-auto max-w-full"}`}
          />
        </div>

        <nav className={`flex-1 overflow-y-auto py-3 ${collapsed ? "flex flex-col items-center gap-2.5" : "space-y-4 px-3"}`}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className={collapsed ? "flex flex-col items-center gap-2.5" : "space-y-0.5"}>
              {section.items.map((item) =>
                item.children ? (
                  <NavGroup
                    key={item.label}
                    item={item}
                    collapsed={collapsed}
                    active={isGroupActive(item, location.pathname)}
                    onNavigate={navigate}
                    location={location.pathname}
                  />
                ) : (
                  <NavLeaf
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    active={isLeafActive(item, location.pathname)}
                    onNavigate={navigate}
                  />
                )
              )}
            </div>
          ))}
        </nav>

        <div className={`border-t border-[#ECECEC] ${collapsed ? "flex flex-col items-center py-3" : "p-3"}`}>
          <button
            onClick={() => setPinnedOpen((v) => !v)}
            title={pinnedOpen ? "Unpin sidebar" : "Pin sidebar open"}
            className={`flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white text-sm font-semibold text-[#525252] hover:bg-[#f9fafb] transition-colors ${collapsed ? "h-9 w-9 justify-center" : "w-full px-3 py-2"}`}
          >
            {pinnedOpen ? <ChevronsLeft size={15} /> : <ChevronsRight size={15} />}
            {!collapsed && (pinnedOpen ? "Unpin" : "Pin open")}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden" style={{ marginLeft: sidebarW }}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#E1E4EA] bg-white px-6 gap-4">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-sm min-w-0 flex-shrink-0">
            {breadcrumbs.map((crumb, i) => (
              <div key={crumb.to} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={13} className="text-[#9ca3af] shrink-0" />}
                {i < breadcrumbs.length - 1 ? (
                  <button
                    onClick={() => navigate(crumb.to)}
                    className="text-[#525252] hover:text-black font-medium transition-colors whitespace-nowrap"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-black font-medium whitespace-nowrap">{crumb.label}</span>
                )}
              </div>
            ))}
          </nav>

          {/* Right: Search + actions */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            {/* Search */}
            <div className="relative w-72">
              <div className="flex h-8 items-center gap-2 rounded-full border border-[#E1E4EA] px-3">
                <Search size={14} className="text-[#525866] shrink-0" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openResult(searchResults[0]);
                    if (e.key === "Escape") { setSearchQuery(""); setSearchFocused(false); }
                  }}
                  placeholder="Search Companies, Deals, Contacts"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#525866]"
                />
              </div>
              {searchFocused && searchQuery.trim() && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-lg">
                  {searchResults.length ? (
                    <div className="py-1">
                      {searchResults.map((r) => (
                        <button
                          key={`${r.type}-${r.label}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => openResult(r)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[#f9fafb]"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[#111827] truncate">{r.label}</span>
                            {r.sublabel && <span className="block text-xs text-[#6b7280] truncate">{r.sublabel}</span>}
                          </span>
                          <span className="shrink-0 rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#6b7280]">{r.type}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-3 text-xs text-[#6b7280]">No results found.</div>
                  )}
                </div>
              )}
            </div>

            {/* Bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => { setNotifOpen((v) => !v); markAllRead(); }}
                className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E4EA] text-black hover:bg-[#f9fafb] transition-colors"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#DF120B] text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[#e5e7eb] bg-white shadow-lg z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7eb]">
                    <p className="font-semibold text-sm text-[#111827]">Notifications</p>
                    {notifHistory.length > 0 && (
                      <button onClick={clearHistory} className="text-[10px] font-semibold text-[#9ca3af] hover:text-red-500 transition-colors">
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-[#f3f4f6]">
                    {notifHistory.length ? (
                      notifHistory.map((n) => {
                        const dotColor = n.type === "error" ? "bg-red-400" : n.type === "info" ? "bg-blue-400" : "bg-emerald-400";
                        const timeStr = n.ts ? new Date(n.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) + ", " + new Date(n.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
                        return (
                          <div key={n.id} className="flex gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors">
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#111827]">{n.title}</p>
                              {n.message && <p className="mt-0.5 text-xs text-[#6b7280] leading-relaxed">{n.message}</p>}
                              <p className="mt-1 text-[10px] text-[#9ca3af]">{timeStr}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="px-4 py-6 text-center text-xs text-[#9ca3af]">No notifications yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* + New */}
            <div ref={quickAddRef} className="relative">
              <button
                onClick={() => setQuickAddOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C57E5B] text-white shadow-[inset_0_0_0_1.8px_rgba(255,255,255,0.25)] hover:bg-[#b06a48] transition-colors"
              >
                <Plus size={16} />
              </button>
              {quickAddOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-lg z-50 py-1">
                  {QUICK_ADD.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => quickAdd(item)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb]"
                    >
                      <item.icon size={14} className="text-[#9ca3af]" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Avatar */}
            <div ref={avatarRef} className="relative">
              <button
                onClick={() => setAvatarOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1 hover:ring-2 hover:ring-[#884c2d]/20 transition-all"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C57E5B] text-white text-xs font-medium">
                  {initials}
                </span>
              </button>
              {avatarOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-lg z-50 py-1">
                  <div className="px-3 py-2 border-b border-[#f1f1f5]">
                    <p className="text-xs font-semibold text-[#111827] truncate">{name}</p>
                    <p className="text-[11px] text-[#6b7280] truncate">{auth.user?.role || "Admin"}</p>
                  </div>
                  <button
                    onClick={() => { setAvatarOpen(false); navigate("/admin/settings"); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb]"
                  >
                    <Settings size={14} className="text-[#9ca3af]" />
                    Settings
                  </button>
                  <button
                    onClick={() => { setAvatarOpen(false); auth.logout(); navigate("/login", { replace: true }); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={14} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
