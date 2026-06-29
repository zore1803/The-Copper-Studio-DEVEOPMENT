import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpDown, Building2, Check, ChevronLeft, ChevronRight, Download, Edit2, Eye, FolderOpen, FolderPlus,
  Folder as FolderIcon, Globe, Grid2x2, List, MoreVertical, Plus, Save, Search,
  Trash2, X, Briefcase, FolderKanban, Clock3, CheckCircle2, AlertTriangle
} from "lucide-react";
import { Button } from "../../components/ui";
import SidePanel from "../../components/SidePanel";

import { useCrmRecords } from "../../hooks/useCrmRecords";
import { buildProjectPayload } from "../../lib/projectDefaults";
import ProjectFormPanel from "../../components/ProjectFormPanel";
import FilterButton from "../../components/FilterButton";
import { useToast } from "../../components/useToast";

function useClickOutside(refs, onOutside, active) {
  useEffect(() => {
    if (!active) return;
    function onDocMouseDown(event) {
      const list = Array.isArray(refs) ? refs : [refs];
      if (list.some((ref) => ref.current && ref.current.contains(event.target))) return;
      onOutside();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [active, onOutside, refs]);
}

const SORT_OPTIONS = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" }
];

function formatINR(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function KpiChip({ label, value, icon: Icon, tone = "default" }) {
  const toneStyles = {
    default: "bg-[#fff1ec] text-[#884c2d]",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  };
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneStyles[tone]}`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[#6b7280]">{label}</p>
          <p className="mt-0.5 truncate text-base font-bold text-[#111827]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, action, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#f3e5e0] bg-[#fff1ec] px-5 py-3.5">
        <div>
          <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[#6b7280]">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-0 overflow-x-auto">{children}</div>
    </section>
  );
}

const PROJECT_STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "delayed", label: "Delayed" },
  { value: "cancelled", label: "Cancelled" },
];

const FOLDER_PAGE_SIZE = 8;
const FOLDERS_STORAGE_KEY = "cs-project-hotlist-folders";
const DEFAULT_FOLDERS = ["High Priority", "At Risk", "Upcoming Deadlines", "Key Projects"];

function loadStoredFolders() {
  try {
    const raw = JSON.parse(localStorage.getItem(FOLDERS_STORAGE_KEY));
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {
  }
  return DEFAULT_FOLDERS;
}

function persistFolders(list) {
  try {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(list));
  } catch {
  }
}

function FolderCard({ folder, count, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors ${active ? "border-[#C57E5B] bg-[#fff8f6]" : "border-[#E1E4EA] bg-white hover:bg-[#fafafa]"}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${active ? "border-[#C57E5B] text-[#C57E5B]" : "border-[#E1E4EA] text-[#525866]"}`}>
        <FolderIcon size={18} />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#0E121B]">{folder}</p>
        <p className="text-xs text-[#525866] mt-0.5">{count} projects</p>
      </div>
    </button>
  );
}

function FolderRow({ folder, count, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between rounded-xl border border-[#E1E4EA] bg-white px-4 py-3 text-left transition-colors hover:bg-[#fafafa]">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866]">
          <FolderIcon size={16} />
        </div>
        <p className="text-sm font-semibold text-[#0E121B]">{folder}</p>
      </div>
      <span className="text-xs text-[#525866]">{count} projects</span>
    </button>
  );
}

function FolderDetail({ folder, projects, onBack, onAdd, onOpenProject, onRemove }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866] transition-colors hover:bg-[#f9fafb]" title="Back to all folders">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-[#C57E5B]" />
            <div>
              <p className="text-base font-medium text-[#0E121B]">{folder}</p>
              <p className="text-xs text-[#525866]">{projects.length} {projects.length === 1 ? "project" : "projects"}</p>
            </div>
          </div>
        </div>
        <button onClick={onAdd} className="flex h-[42px] items-center gap-1.5 self-start rounded-full bg-[#C57E5B] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#b06a48] sm:self-auto">
          <Plus size={15} /> Add projects
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white py-12 text-center">
          <p className="text-sm text-[#6b7280]">No projects in this folder yet.</p>
          <button onClick={onAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#C57E5B] px-3.5 py-2 text-xs font-medium text-[#C57E5B] transition-colors hover:bg-[#fff8f6]">
            <Plus size={14} /> Add projects
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p._id || p.id} className="group relative flex flex-col gap-2 rounded-xl border border-[#E1E4EA] bg-white p-4">
              <button onClick={() => onRemove(p)} className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-lg text-[#9ca3af] transition-colors hover:bg-red-50 hover:text-red-600 group-hover:flex" title="Remove from folder">
                <X size={14} />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e5e7eb] bg-[#f3f4f6]">
                  <FolderIcon size={15} className="text-[#9ca3af]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111827]">{p.name}</p>
                  <p className="truncate text-xs text-[#525866]">{p.computedCompanyName || "—"}</p>
                </div>
              </div>
              <div className="flex items-center justify-end mt-2">
                <button onClick={() => onOpenProject(p)} className="inline-flex items-center gap-1 text-xs font-medium text-[#884c2d] hover:underline">
                  <Eye size={13} /> Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FolderModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  return (
    <SidePanel title="New Folder" subtitle="Create a custom hotlist folder to group projects." onClose={onClose} footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onCreate(name)}><Save size={14} /> Create Folder</Button></div>}>
      <label className="block">
        <span className="text-xs font-semibold text-[#374151]">Folder name</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onCreate(name); }} placeholder="e.g. Q3 Deliverables" className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none transition-all focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20" />
      </label>
    </SidePanel>
  );
}

function AssignProjectsModal({ folder, projects, onClose, onSave }) {
  const idOf = (c) => c._id || c.id;
  const [selected, setSelected] = useState(() => new Set(projects.filter((c) => (c.folder || "") === folder).map(idOf)));
  const [query, setQuery] = useState("");

  const toggle = (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const list = projects.filter((c) => `${c.name} ${c.computedCompanyName}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <SidePanel title={`Add projects to ${folder}`} subtitle="Select the projects that belong in this hotlist folder." onClose={onClose} footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onSave([...selected])}><Save size={14} /> Save ({selected.size})</Button></div>}>
      <div className="mb-3 flex h-11 items-center gap-2 rounded-full border border-[#1F2937]/10 px-3.5">
        <Search size={15} className="text-[#1F2937]/50 shrink-0" />
        <input className="w-full bg-transparent text-sm outline-none placeholder:text-[#1F2937]/50" placeholder="Search projects…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        {list.map((c) => {
          const id = idOf(c);
          const checked = selected.has(id);
          return (
            <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${checked ? "border-[#C57E5B] bg-[#fff8f6]" : "border-[#e5e7eb] hover:bg-[#f9fafb]"}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(id)} className="rounded border-[#d1d5db] accent-[#884c2d]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#111827]">{c.name}</p>
                <p className="truncate text-xs text-[#525866]">{c.computedCompanyName || "—"}{c.folder && c.folder !== folder ? ` · in ${c.folder}` : ""}</p>
              </div>
            </label>
          );
        })}
        {list.length === 0 && <p className="py-8 text-center text-sm text-[#6b7280]">No projects found.</p>}
      </div>
    </SidePanel>
  );
}

export default function ProjectsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(() => Boolean(location.state?.openCreate));
  const { records: projects, loading, save, update, remove } = useCrmRecords("projects");
  const { records: companies } = useCrmRecords("companies");
  const { records: contacts } = useCrmRecords("contacts");
  const { records: invoices } = useCrmRecords("invoices");
  const { save: saveTask } = useCrmRecords("tasks");

  const [view, setView] = useState("table");
  const [folders, setFolders] = useState(loadStoredFolders);
  const [folderSearch, setFolderSearch] = useState("");
  const [openedFolder, setOpenedFolder] = useState(null);
  const [folderView, setFolderView] = useState("grid");
  const [folderPage, setFolderPage] = useState(1);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    if (location.state?.openCreate) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [packageFilter, setPackageFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [pmFilter, setPmFilter] = useState("All");

  const [actionsOpen, setActionsOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState("created_desc");
  const actionsRef = useRef(null);
  const sortRef = useRef(null);
  useClickOutside(actionsRef, () => setActionsOpen(false), actionsOpen);
  useClickOutside(sortRef, () => setSortOpen(false), sortOpen);

  const computedProjects = useMemo(() => {
    return projects.map((p) => {
      const stages = Array.isArray(p.stages) ? p.stages : [];
      const totalStages = stages.length;
      const completedStages = stages.filter(s => s.status === "completed").length;
      const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : (p.progress || 0);
      
      let currentStage = "Setup phase";
      if (totalStages > 0) {
         const active = stages.find(s => s.status === "in_progress" || s.status === "review" || s.status === "not_started");
         if (active) currentStage = active.name;
         else if (completedStages === totalStages) currentStage = "All stages completed";
      } else {
         currentStage = p.currentPhase || "No stages defined";
      }

      // When stages exist, completion is driven by the stages (all done = completed),
      // never by a possibly-stale stored status. Only fall back to the stored status
      // for projects that have no stages defined at all.
      let effectiveStatus;
      if (totalStages > 0) {
        const hasReview = stages.some(s => s.status === "review");
        if (progress === 100) effectiveStatus = "completed";
        else if (hasReview) effectiveStatus = "review";
        else if (progress > 0) effectiveStatus = "in_progress";
        else effectiveStatus = "not_started";
      } else {
        effectiveStatus = p.status || "not_started";
      }

      const company = companies.find(c => c.id === p.companyId || c._id === p.companyId);
      const companyName = company ? company.name || company.companyName : p.clientCompany || p.company || p.client || "-";

      return { ...p, computedProgress: progress, currentStage, effectiveStatus, computedCompanyName: companyName };
    });
  }, [projects, companies]);

  const pmOptions = useMemo(() => {
    const pms = new Set(computedProjects.map(p => p.projectManager).filter(Boolean));
    return ["All", ...Array.from(pms).sort()];
  }, [computedProjects]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const arr = computedProjects.filter((project) => {
      const matchesQuery = !query || `${project.name} ${project.client} ${project.template}`.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "All" || project.effectiveStatus === statusFilter || project.status === statusFilter;
      const matchesPriority = priorityFilter === "All" || (project.priority || "Medium") === priorityFilter;
      const matchesPayment = paymentFilter === "All" || (project.paymentStatus || "Pending") === paymentFilter;
      const matchesPackage = packageFilter === "All" || (project.packageName === packageFilter || project.template === packageFilter);
      const matchesPm = pmFilter === "All" || project.projectManager === pmFilter;

      let matchesDate = true;
      if (dateFilter !== "All") {
        const d = project.expectedEndDate || project.endDate;
        if (!d) {
          matchesDate = false;
        } else {
          const due = new Date(d).getTime();
          const now = Date.now();
          const oneWeek = now + 7 * 24 * 60 * 60 * 1000;
          const oneMonth = now + 30 * 24 * 60 * 60 * 1000;
          if (dateFilter === "Overdue") matchesDate = due < now;
          else if (dateFilter === "Due This Week") matchesDate = due >= now && due <= oneWeek;
          else if (dateFilter === "Due This Month") matchesDate = due >= now && due <= oneMonth;
        }
      }

      return matchesQuery && matchesStatus && matchesPriority && matchesPayment && matchesPackage && matchesDate && matchesPm;
    });

    const byStr = (a, b, key) => String(a[key] || "").localeCompare(String(b[key] || ""), undefined, { sensitivity: "base" });
    const byCreated = (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0);

    switch (sortBy) {
      case "name_desc": return arr.sort((a, b) => byStr(b, a, "name"));
      case "created_asc": return arr.sort(byCreated);
      case "name_asc": return arr.sort((a, b) => byStr(a, b, "name"));
      case "created_desc":
      default: return arr.sort((a, b) => byCreated(b, a));
    }
  }, [computedProjects, search, statusFilter, priorityFilter, paymentFilter, packageFilter, dateFilter, pmFilter, sortBy]);

  const kpis = useMemo(() => {
    const completed = computedProjects.filter((p) => p.effectiveStatus === "completed").length;
    const delayed = computedProjects.filter((p) => p.effectiveStatus === "delayed").length;
    const inProgress = computedProjects.filter((p) => p.effectiveStatus === "in_progress").length;
    return { total: computedProjects.length, inProgress, completed, delayed };
  }, [computedProjects]);

  async function handleCreate(company, form) {
    const { payload, starterTasks } = buildProjectPayload(form, company);
    const created = await save(payload);
    const realProjectId = created._id || created.id;
    await Promise.all(starterTasks.map((task) => saveTask({ ...task, projectId: realProjectId })));
    setCreating(false);
    showToast({ title: "Project workspace created", message: `${created.name} now has timeline, tasks, documents, and activity.` });
    navigate(`/admin/companies/${company.id || company._id}/projects/${created.id || created._id}`);
  }

  async function updateProjectStatus(project, newStatus) {
    await update(project.id || project._id, { status: newStatus });
    showToast({ title: "Status updated", message: `${project.name} is now ${newStatus.replace("_", " ")}.` });
  }

  async function handleDeleteProject(project) {
    if (!window.confirm(`Delete "${project.name || "this project"}"? This cannot be undone.`)) return;
    await remove(project);
    showToast({ title: "Project deleted", message: `${project.name || "Project"} removed.` });
  }


  const allFolders = useMemo(() => {
    const fromProjects = computedProjects.map((p) => p.folder).filter(Boolean);
    return Array.from(new Set([...folders, ...fromProjects]));
  }, [folders, computedProjects]);

  const visibleFolders = useMemo(
    () => allFolders.filter((f) => f.toLowerCase().includes(folderSearch.toLowerCase())),
    [allFolders, folderSearch]
  );
  const folderTotalPages = Math.max(1, Math.ceil(visibleFolders.length / FOLDER_PAGE_SIZE));
  const pagedFolders = visibleFolders.slice((folderPage - 1) * FOLDER_PAGE_SIZE, folderPage * FOLDER_PAGE_SIZE);

  useEffect(() => {
    if (folderPage > folderTotalPages) setFolderPage(1);
  }, [folderPage, folderTotalPages]);

  const openedProjects = useMemo(
    () => (openedFolder ? computedProjects.filter((p) => (p.folder || "") === openedFolder) : []),
    [computedProjects, openedFolder]
  );

  function folderCount(folder) {
    return computedProjects.filter((p) => (p.folder || "") === folder).length;
  }

  function createFolder(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) { showToast({ type: "error", title: "Folder name required", message: "Enter a name for the folder." }); return; }
    if (allFolders.some((f) => f.toLowerCase() === trimmed.toLowerCase())) { showToast({ type: "error", title: "Folder already exists", message: `"${trimmed}" is already a folder.` }); return; }
    const next = [...folders, trimmed];
    setFolders(next);
    persistFolders(next);
    setCreatingFolder(false);
    showToast({ title: "Folder created", message: `"${trimmed}" added to your hotlists.` });
  }

  async function assignProjectsToFolder(selectedIds) {
    const idOf = (c) => c._id || c.id;
    const selected = new Set(selectedIds);
    const changed = computedProjects.filter((c) => ((c.folder || "") === openedFolder) !== selected.has(idOf(c)));
    await Promise.all(changed.map((c) => update(idOf(c), { folder: selected.has(idOf(c)) ? openedFolder : "" })));
    setAssignOpen(false);
    showToast({ title: "Folder updated", message: `"${openedFolder}" now has ${selected.size} ${selected.size === 1 ? "project" : "projects"}.` });
  }

  async function removeFromFolder(project) {
    await update(project.id || project._id, { folder: "" });
    showToast({ title: "Removed from folder", message: `${project.name || "Project"} removed from "${openedFolder}".` });
  }

  function openProject(project) {
    navigate(`/admin/companies/${project.companyId}/projects/${project.id || project._id}`);
  }

  const statusFilters = [
    { label: "All", value: "All" },
    { label: "Not Started", value: "not_started" },
    { label: "In Progress", value: "in_progress" },
    { label: "Completed", value: "completed" },
    { label: "Delayed", value: "delayed" },
    { label: "Cancelled", value: "cancelled" }
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Sub-header */}
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div>
          <h1 className="text-base font-medium text-[#0E121B]">Projects</h1>
          <p className="text-xs text-[#525866] mt-0.5">Manage your active projects and workflows</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex h-11 w-full items-center gap-2 rounded-full border border-[#1F2937]/10 px-3.5 sm:w-72 bg-white">
            <Search size={16} className="text-[#1F2937]/50 shrink-0" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#1F2937]/50"
              placeholder="Search projects or clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="relative" ref={actionsRef}>
            {/* View toggle */}
            <button
              onClick={() => setView((v) => (v === "table" ? "hotlist" : "table"))}
              className={`flex items-center gap-1.5 rounded-full p-1 transition-colors mr-2 ${view === "hotlist" ? "bg-[#0085FF]/20" : "bg-[#F1F1F5]"}`}
            >
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-medium shadow-[0_0_6px_rgba(0,0,0,0.1)]">
                <Grid2x2 size={16} className={view === "hotlist" ? "text-[#C57E5B]" : "text-[#1F2937]"} />
                <span className={view === "hotlist" ? "text-[#C57E5B]" : "text-[#1F2937]"}>Hotlist</span>
              </span>
            </button>
          </div>

          <div className="relative" ref={actionsRef}>
            <button onClick={() => setActionsOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E1E4EA] bg-white text-[#1F2937] hover:bg-[#f9fafb] transition-colors">
              <MoreVertical size={16} />
            </button>
            {actionsOpen && (
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-[#e5e7eb] bg-white p-1 shadow-lg">
                <button onClick={() => { 
                  setSearch(""); 
                  setStatusFilter("All"); 
                  setPriorityFilter("All");
                  setPaymentFilter("All");
                  setPackageFilter("All");
                  setDateFilter("All");
                  setPmFilter("All");
                  setActionsOpen(false); 
                }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]">
                  <X size={14} /> Clear filters
                </button>
              </div>
            )}
          </div>

          {/* Sort */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen((value) => !value)}
              className={`flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${sortOpen ? "border-[#884c2d] bg-[#fff8f6] text-[#884c2d]" : "border-[#E1E4EA] bg-white text-[#1F2937] hover:bg-[#f9fafb]"}`}
            >
              <ArrowUpDown size={15} />
              <span className="hidden sm:inline">{SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort"}</span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-[#e5e7eb] bg-white p-1 shadow-lg">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f9fafb] ${sortBy === opt.value ? "font-semibold text-[#884c2d]" : "text-[#374151]"}`}
                  >
                    {opt.label}
                    {sortBy === opt.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <FilterButton
            onReset={() => { 
              setSearch(""); 
              setStatusFilter("All");
              setPriorityFilter("All");
              setPaymentFilter("All");
              setPackageFilter("All");
              setDateFilter("All");
              setPmFilter("All");
            }}
            fields={[
              { 
                key: "status", 
                label: "Status", 
                type: "select", 
                value: statusFilter, 
                onChange: setStatusFilter, 
                options: ["All", "Not Started", "In Progress", "Review", "Completed", "Delayed", "Cancelled"] 
              },
              { 
                key: "priority", 
                label: "Priority", 
                type: "select", 
                value: priorityFilter, 
                onChange: setPriorityFilter, 
                options: ["All", "High", "Medium", "Low"] 
              },
              { 
                key: "payment", 
                label: "Payment Status", 
                type: "select", 
                value: paymentFilter, 
                onChange: setPaymentFilter, 
                options: ["All", "Pending", "Partially Paid", "Paid"] 
              },
              { 
                key: "package", 
                label: "Package / Template", 
                type: "select", 
                value: packageFilter, 
                onChange: setPackageFilter, 
                options: ["All", "Starter Studio", "Growth Studio", "Enterprise Studio", "Custom"] 
              },
              { 
                key: "date", 
                label: "Completion Date", 
                type: "select", 
                value: dateFilter, 
                onChange: setDateFilter, 
                options: ["All", "Due This Week", "Due This Month", "Overdue"] 
              },
              { 
                key: "pm", 
                label: "Project Manager", 
                type: "select", 
                value: pmFilter, 
                onChange: setPmFilter, 
                options: pmOptions 
              }
            ]}
          />

          <button
            onClick={() => setCreating(true)}
            className="flex h-11 items-center gap-1.5 rounded-full bg-[#C57E5B] px-4 text-sm font-medium text-white hover:bg-[#b06a48] transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Project
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#F1F1F5] p-6 space-y-6">

      {view === "table" ? (
        <>
          {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiChip label="Total Projects" value={kpis.total} icon={FolderKanban} />
          <KpiChip label="In Progress" value={kpis.inProgress} icon={Clock3} tone="default" />
          <KpiChip label="Completed" value={kpis.completed} icon={CheckCircle2} tone="success" />
          <KpiChip label="Delayed" value={kpis.delayed} icon={AlertTriangle} tone={kpis.delayed ? "danger" : "default"} />
        </div>
      )}

      <Section
        title="Project Portfolio"
        subtitle="Manage all active projects and workflows."
      >
        <table className="w-full text-left text-sm text-[#6b7280]">
          <thead className="bg-[#fff1ec] text-xs uppercase text-[#9ca3af]">
            <tr>
              <th className="px-5 py-3 font-semibold">Project Name</th>
              <th className="px-5 py-3 font-semibold">Company</th>
              <th className="px-5 py-3 font-semibold">Template</th>
              <th className="px-5 py-3 font-semibold">Current Stage</th>
              <th className="px-5 py-3 font-semibold">Progress</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Timeline</th>
              <th className="px-5 py-3 font-semibold text-right">Value</th>
              <th className="px-5 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3e5e0] bg-white">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center">
                  <div className="mx-auto flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#884c2d]"></div>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[#111827]">Loading projects...</p>
                </td>
              </tr>
            ) : filtered.length > 0 ? filtered.map((project) => {
              const start = project.startDate ? new Date(project.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
              const deadline = (project.dueDate || project.expectedEndDate) ? new Date(project.dueDate || project.expectedEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
              return (
                <tr key={project.id || project._id} className="hover:bg-[#fff1ec] transition-colors">
                  <td className="px-5 py-4">
                    <Link
                      to={`/admin/companies/${project.companyId}/projects/${project.id || project._id}`}
                      className="font-bold text-[#884c2d] hover:underline"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 font-medium text-[#111827]">{project.computedCompanyName}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                      {project.template || project.packageName || "Custom"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-[#111827] truncate max-w-[150px]">{project.currentStage}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-[#f3f4f6]">
                        <div
                          className={`h-full rounded-full ${project.computedProgress === 100 ? "bg-emerald-500" : "bg-[#884c2d]"}`}
                          style={{ width: `${project.computedProgress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-[#111827]">{project.computedProgress}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={project.effectiveStatus}
                      onChange={(e) => updateProjectStatus(project, e.target.value)}
                      className={`rounded-md border-0 bg-transparent py-1 pl-1 pr-6 text-xs font-semibold focus:ring-0 ${
                        project.effectiveStatus === "completed" ? "text-emerald-700" :
                        project.effectiveStatus === "delayed" ? "text-red-700" :
                        "text-[#111827]"
                      }`}
                    >
                      {PROJECT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[#9ca3af]">Start: <span className="text-[#111827] font-medium">{start}</span></span>
                      <span className="text-[#9ca3af]">Due: <span className="text-[#111827] font-medium">{deadline}</span></span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-[#111827]">
                    {formatINR(project.finalAmount || project.budget || 0)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => handleDeleteProject(project)} className="rounded-lg p-2 text-[#9ca3af] hover:bg-red-50 hover:text-red-600" title="Delete project">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff1ec] text-[#884c2d]">
                    <FolderKanban size={20} />
                  </div>
                  <p className="text-sm font-semibold text-[#111827]">{search || statusFilter !== "All" ? "No projects match your filters." : "No projects yet."}</p>
                  <p className="mt-1 text-sm text-[#6b7280]">Create a project and link it to a company to get started.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-lg border border-[#E1E4EA] bg-white p-6 shadow-[0_4px_4px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-medium text-[#0E121B]">Project Hotlists</p>
              <p className="text-xs text-[#525866] mt-0.5">Organise your projects into custom folders</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-[42px] w-full items-center gap-2 rounded-full border border-[#1F2937]/10 px-3.5 sm:w-72">
                <Search size={15} className="text-[#1F2937]/50 shrink-0" />
                <input
                  className="w-full bg-transparent text-xs outline-none placeholder:text-[#1F2937]/50"
                  placeholder="Search folders…"
                  value={folderSearch}
                  onChange={(e) => { setFolderSearch(e.target.value); setFolderPage(1); }}
                />
              </div>
              <button onClick={() => setCreatingFolder(true)} className="flex h-[42px] items-center gap-1.5 whitespace-nowrap rounded-full bg-[#C57E5B] px-3.5 text-xs font-medium text-white hover:bg-[#b06a48] transition-colors">
                <FolderPlus size={15} /> New Folder
              </button>
            </div>
          </div>

          {openedFolder ? (
            <FolderDetail folder={openedFolder} projects={openedProjects} onBack={() => setOpenedFolder(null)} onAdd={() => setAssignOpen(true)} onOpenProject={openProject} onRemove={removeFromFolder} />
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-[#525866]">{visibleFolders.length} folders</p>
                <div className="flex items-center gap-1.5">
                  <div className="inline-flex h-9 items-center rounded-full border border-[#EAECF0] bg-white p-1">
                    <button onClick={() => setFolderView("list")} title="List view" className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${folderView === "list" ? "bg-[#C57E5B] text-white" : "text-[#525866] hover:bg-[#f9fafb]"}`}>
                      <List size={15} />
                    </button>
                    <button onClick={() => setFolderView("grid")} title="Icon view" className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${folderView === "grid" ? "bg-[#C57E5B] text-white" : "text-[#525866] hover:bg-[#f9fafb]"}`}>
                      <Grid2x2 size={15} />
                    </button>
                  </div>
                  <button onClick={() => setFolderPage((p) => Math.max(1, p - 1))} disabled={folderPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAECF0] text-[#525866] hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: folderTotalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
                    <button key={p} onClick={() => setFolderPage(p)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${p === folderPage ? "bg-[#C57E5B] text-white" : "border border-[#EAECF0] text-[#525866] hover:bg-[#f9fafb]"}`}>{p}</button>
                  ))}
                  <button onClick={() => setFolderPage((p) => Math.min(folderTotalPages, p + 1))} disabled={folderPage === folderTotalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAECF0] text-[#525866] hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {visibleFolders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E1E4EA] py-12 text-center">
                  <p className="text-sm text-[#6b7280]">No folders found.</p>
                </div>
              ) : folderView === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {pagedFolders.map((f) => (
                    <FolderCard key={f} folder={f} count={folderCount(f)} active={openedFolder === f} onClick={() => setOpenedFolder(f)} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {pagedFolders.map((f) => (
                    <FolderRow key={f} folder={f} count={folderCount(f)} onClick={() => setOpenedFolder(f)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {creatingFolder && <FolderModal onClose={() => setCreatingFolder(false)} onCreate={createFolder} />}
      {assignOpen && <AssignProjectsModal folder={openedFolder} projects={computedProjects} onClose={() => setAssignOpen(false)} onSave={assignProjectsToFolder} />}

      {creating && (
        <ProjectFormPanel
          companies={companies}
          contacts={contacts}
          invoices={invoices}
          onClose={() => setCreating(false)}
          onSave={handleCreate}
        />
      )}
      </div>
    </div>
  );
}
