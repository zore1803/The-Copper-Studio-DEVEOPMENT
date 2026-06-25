import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpDown, Building2, Check, ChevronLeft, ChevronRight, Download, Edit2, Eye, FolderOpen, FolderPlus,
  Folder as FolderIcon, Globe, Grid2x2, List, MoreVertical, Plus, Save, Search,
  SlidersHorizontal, Trash2, X
} from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";
import CompanyFormPanel from "../../components/CompanyFormPanel";
import FilterButton from "../../components/FilterButton";

const PAGE_SIZE = 25;
const FOLDER_PAGE_SIZE = 8;

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "city_asc", label: "City (A–Z)" }
];

// Distinct, alphabetically-sorted values of a field across records, prefixed
// with "All" for use as a dropdown filter.
function uniqueSorted(records, key) {
  return [
    "All",
    ...Array.from(new Set(records.map((r) => r[key]).filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b))
    )
  ];
}
const DEFAULT_FOLDERS = ["Key Accounts", "New Prospects", "Renewals Due", "High Value"];
const FOLDERS_STORAGE_KEY = "cs-hotlist-folders";

// The custom folder list is kept in localStorage so user-created folders (and
// empty ones) survive a page reload. Folder *membership* lives on each company
// record (company.folder) and persists through the API.
function loadStoredFolders() {
  try {
    const raw = JSON.parse(localStorage.getItem(FOLDERS_STORAGE_KEY));
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {
    /* ignore malformed cache */
  }
  return DEFAULT_FOLDERS;
}

function persistFolders(list) {
  try {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / availability errors */
  }
}

// Closes an open menu/panel when the user clicks anywhere outside the given
// ref(s). Pass an array of refs when a trigger button and its menu live in
// separate DOM subtrees (e.g. a portaled menu).
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

const DOC_STATUS_OPTIONS = ["Pending", "Accepted", "Rejected"];
const DOC_STATUS_STYLE = {
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  Rejected: "bg-red-50 text-red-600 border-red-100",
};

// Derives the document-signature status: explicit `documentStatus` wins once
// someone has verified it directly, otherwise it falls back to the legacy
// behavior of inferring from the company's pipeline status.
function docStatusOf(company) {
  return company.documentStatus
    || (company.status === "Active" ? "Accepted" : company.status === "Prospect" ? "Pending" : company.status)
    || "Pending";
}

// When `onChange` is passed, renders as a dropdown so an admin can directly
// verify/reject a signed document instead of only inferring it from the
// company's unrelated pipeline status.
function DocSignedBadge({ status, onChange }) {
  const style = DOC_STATUS_STYLE[status] || "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]";
  if (!onChange) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${style}`}>
        {status || "—"}
      </span>
    );
  }
  return (
    <select
      value={DOC_STATUS_OPTIONS.includes(status) ? status : "Pending"}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => { event.stopPropagation(); onChange(event.target.value); }}
      title="Verify this company's signed document"
      className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-semibold outline-none ${style}`}
    >
      {DOC_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function CompanyRow({ company, onEdit, onDelete, onClick, onOpen, onVerifyDocument }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useClickOutside([btnRef, menuRef], () => setMenuOpen(false), menuOpen);

  useEffect(() => {
    if (!menuOpen) return;
    function reposition() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
    }
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [menuOpen]);

  function toggleMenu() {
    if (!menuOpen) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
    }
    setMenuOpen((v) => !v);
  }

  return (
    <tr
      className="border-b border-[#f3f4f6] hover:bg-[#fafafa] cursor-pointer transition-colors group"
      onClick={onClick}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 shrink-0 rounded-full bg-[#f3f4f6] border border-[#e5e7eb] flex items-center justify-center">
            <Building2 size={14} className="text-[#9ca3af]" />
          </div>
          <span className="text-sm font-semibold text-[#111827]">{company.name}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-sm text-[#374151]">{company.industry || "—"}</td>
      <td className="px-4 py-3.5 text-sm text-[#374151] max-w-[140px] truncate">
        {company.address ? company.address.slice(0, 22) + (company.address.length > 22 ? "…" : "") : "—"}
      </td>
      <td className="px-4 py-3.5">
        {company.website ? (
          <a
            href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
            onClick={(e) => e.stopPropagation()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[#884c2d] hover:underline"
          >
            <Globe size={12} />
            {company.website.replace(/^https?:\/\//, "").slice(0, 22)}…
          </a>
        ) : "—"}
      </td>
      <td className="px-4 py-3.5 text-sm font-mono text-[#6b7280]">{company.gstin || "—"}</td>
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <DocSignedBadge status={docStatusOf(company)} onChange={(next) => onVerifyDocument(company, next)} />
      </td>
      <td className="px-4 py-3.5 text-sm text-[#374151]">{company.leadSource || "—"}</td>
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <button
          ref={btnRef}
          onClick={toggleMenu}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && menuPos && createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-50 w-44 rounded-xl border border-[#e5e7eb] bg-white shadow-lg py-1"
          >
            <button
              onClick={() => { setMenuOpen(false); onOpen(company); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb]"
            >
              <Eye size={14} /> Open
            </button>
            <button
              onClick={() => { setMenuOpen(false); onEdit(company); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb]"
            >
              <Edit2 size={14} /> Edit company
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(company); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>,
          document.body
        )}
      </td>
    </tr>
  );
}

function FolderCard({ folder, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
        active ? "border-[#C57E5B] bg-[#fff8f6]" : "border-[#E1E4EA] bg-white hover:bg-[#fafafa]"
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${active ? "border-[#C57E5B] text-[#C57E5B]" : "border-[#E1E4EA] text-[#525866]"}`}>
        <FolderIcon size={18} />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#0E121B]">{folder}</p>
        <p className="text-xs text-[#525866] mt-0.5">{count} companies</p>
      </div>
    </button>
  );
}

function FolderRow({ folder, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-xl border border-[#E1E4EA] bg-white px-4 py-3 text-left transition-colors hover:bg-[#fafafa]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866]">
          <FolderIcon size={16} />
        </div>
        <p className="text-sm font-semibold text-[#0E121B]">{folder}</p>
      </div>
      <span className="text-xs text-[#525866]">{count} companies</span>
    </button>
  );
}

function FolderDetail({ folder, companies, onBack, onAdd, onOpenCompany, onRemove, onVerifyDocument }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866] transition-colors hover:bg-[#f9fafb]"
            title="Back to all folders"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-[#C57E5B]" />
            <div>
              <p className="text-base font-medium text-[#0E121B]">{folder}</p>
              <p className="text-xs text-[#525866]">{companies.length} {companies.length === 1 ? "company" : "companies"}</p>
            </div>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="flex h-[42px] items-center gap-1.5 self-start rounded-full bg-[#C57E5B] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#b06a48] sm:self-auto"
        >
          <Plus size={15} />
          Add companies
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white py-12 text-center">
          <p className="text-sm text-[#6b7280]">No companies in this folder yet.</p>
          <button
            onClick={onAdd}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#C57E5B] px-3.5 py-2 text-xs font-medium text-[#C57E5B] transition-colors hover:bg-[#fff8f6]"
          >
            <Plus size={14} /> Add companies
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <div key={c._id || c.id} className="group relative flex flex-col gap-2 rounded-xl border border-[#E1E4EA] bg-white p-4">
              <button
                onClick={() => onRemove(c)}
                className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-lg text-[#9ca3af] transition-colors hover:bg-red-50 hover:text-red-600 group-hover:flex"
                title="Remove from folder"
              >
                <X size={14} />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e5e7eb] bg-[#f3f4f6]">
                  <Building2 size={15} className="text-[#9ca3af]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111827]">{c.name}</p>
                  <p className="truncate text-xs text-[#525866]">{c.industry || "—"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <DocSignedBadge status={docStatusOf(c)} onChange={(next) => onVerifyDocument(c, next)} />
                <button
                  onClick={() => onOpenCompany(c)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#884c2d] hover:underline"
                >
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
    <SidePanel
      title="New Folder"
      subtitle="Create a custom hotlist folder to group companies."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onCreate(name)}><Save size={14} /> Create Folder</Button>
        </div>
      }
    >
      <label className="block">
        <span className="text-xs font-semibold text-[#374151]">Folder name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onCreate(name); }}
          placeholder="e.g. Q3 Targets"
          className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none transition-all focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
        />
      </label>
    </SidePanel>
  );
}

function AssignCompaniesModal({ folder, companies, onClose, onSave }) {
  const idOf = (c) => c._id || c.id;
  const [selected, setSelected] = useState(
    () => new Set(companies.filter((c) => (c.folder || "") === folder).map(idOf))
  );
  const [query, setQuery] = useState("");

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const list = companies.filter((c) =>
    `${c.name} ${c.industry}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <SidePanel
      title={`Add companies to ${folder}`}
      subtitle="Select the companies that belong in this hotlist folder."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave([...selected])}><Save size={14} /> Save ({selected.size})</Button>
        </div>
      }
    >
      <div className="mb-3 flex h-11 items-center gap-2 rounded-full border border-[#1F2937]/10 px-3.5">
        <Search size={15} className="text-[#1F2937]/50 shrink-0" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-[#1F2937]/50"
          placeholder="Search companies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        {list.map((c) => {
          const id = idOf(c);
          const checked = selected.has(id);
          return (
            <label
              key={id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                checked ? "border-[#C57E5B] bg-[#fff8f6]" : "border-[#e5e7eb] hover:bg-[#f9fafb]"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(id)}
                className="rounded border-[#d1d5db] accent-[#884c2d]"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#111827]">{c.name}</p>
                <p className="truncate text-xs text-[#525866]">
                  {c.industry || "—"}
                  {c.folder && c.folder !== folder ? ` · in ${c.folder}` : ""}
                </p>
              </div>
            </label>
          );
        })}
        {list.length === 0 && <p className="py-8 text-center text-sm text-[#6b7280]">No companies found.</p>}
      </div>
    </SidePanel>
  );
}

export default function Companies() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(() => (location.state?.openCreate
    ? { name: "", gstin: "", industry: "", contact: "", projects: 0, status: "Prospect", address: "", city: "", state: "", pincode: "", website: "", leadSource: "", owner: "", notes: "" }
    : null));
  const [actionsOpen, setActionsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [industryFilter, setIndustryFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [pincodeFilter, setPincodeFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name_asc");
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [view, setView] = useState("table");
  const [folders, setFolders] = useState(loadStoredFolders);
  const [folderSearch, setFolderSearch] = useState("");
  const [openedFolder, setOpenedFolder] = useState(null);
  const [folderView, setFolderView] = useState("grid");
  const [folderPage, setFolderPage] = useState(1);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const { records: companies, save, remove, loading } = useCrmRecords("companies");
  const { showToast } = useToast();
  const actionsRef = useRef(null);
  const sortRef = useRef(null);
  useClickOutside(actionsRef, () => setActionsOpen(false), actionsOpen);
  useClickOutside(sortRef, () => setSortOpen(false), sortOpen);

  useEffect(() => {
    if (location.state?.openCreate) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const industries = useMemo(() => uniqueSorted(companies, "industry"), [companies]);
  const cities = useMemo(() => uniqueSorted(companies, "city"), [companies]);
  const states = useMemo(() => uniqueSorted(companies, "state"), [companies]);
  const owners = useMemo(() => uniqueSorted(companies, "owner"), [companies]);

  const filtered = useMemo(() =>
    companies.filter((c) => {
      const matchesSearch = `${c.name} ${c.industry} ${c.contact} ${c.status} ${c.gstin} ${c.leadSource} ${c.city} ${c.state} ${c.pincode} ${c.owner}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || c.status === statusFilter || docStatusOf(c) === statusFilter;
      const matchesIndustry = industryFilter === "All" || c.industry === industryFilter;
      const matchesCity = cityFilter === "All" || c.city === cityFilter;
      const matchesState = stateFilter === "All" || c.state === stateFilter;
      const matchesPincode = !pincodeFilter.trim() || String(c.pincode || "").includes(pincodeFilter.trim());
      const matchesOwner = ownerFilter === "All" || c.owner === ownerFilter;
      return matchesSearch && matchesStatus && matchesIndustry && matchesCity && matchesState && matchesPincode && matchesOwner;
    }), [companies, industryFilter, search, statusFilter, cityFilter, stateFilter, pincodeFilter, ownerFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const byStr = (a, b, key) => String(a[key] || "").localeCompare(String(b[key] || ""), undefined, { sensitivity: "base" });
    const byCreated = (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    switch (sortBy) {
      case "name_desc": return arr.sort((a, b) => byStr(b, a, "name"));
      case "created_desc": return arr.sort((a, b) => byCreated(b, a));
      case "created_asc": return arr.sort(byCreated);
      case "city_asc": return arr.sort((a, b) => byStr(a, b, "city"));
      case "name_asc":
      default: return arr.sort((a, b) => byStr(a, b, "name"));
    }
  }, [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Folders shown = the managed list plus any folder a company is already
  // assigned to, so membership is never orphaned if the list is edited.
  const allFolders = useMemo(() => {
    const fromCompanies = companies.map((c) => c.folder).filter(Boolean);
    return Array.from(new Set([...folders, ...fromCompanies]));
  }, [folders, companies]);

  const visibleFolders = useMemo(
    () => allFolders.filter((f) => f.toLowerCase().includes(folderSearch.toLowerCase())),
    [allFolders, folderSearch]
  );

  const folderTotalPages = Math.max(1, Math.ceil(visibleFolders.length / FOLDER_PAGE_SIZE));
  const pagedFolders = visibleFolders.slice((folderPage - 1) * FOLDER_PAGE_SIZE, folderPage * FOLDER_PAGE_SIZE);

  useEffect(() => {
    if (folderPage > folderTotalPages) setFolderPage(1);
  }, [folderPage, folderTotalPages]);

  const openedCompanies = useMemo(
    () => (openedFolder ? companies.filter((c) => (c.folder || "") === openedFolder) : []),
    [companies, openedFolder]
  );

  function folderCount(folder) {
    return companies.filter((c) => (c.folder || "") === folder).length;
  }

  function createFolder(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      showToast({ type: "error", title: "Folder name required", message: "Enter a name for the folder." });
      return;
    }
    if (allFolders.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      showToast({ type: "error", title: "Folder already exists", message: `"${trimmed}" is already a folder.` });
      return;
    }
    const next = [...folders, trimmed];
    setFolders(next);
    persistFolders(next);
    setCreatingFolder(false);
    showToast({ title: "Folder created", message: `"${trimmed}" added to your hotlists.` });
  }

  async function assignCompaniesToFolder(selectedIds) {
    const idOf = (c) => c._id || c.id;
    const selected = new Set(selectedIds);
    // Only persist the companies whose membership for this folder actually changed.
    const changed = companies.filter((c) => ((c.folder || "") === openedFolder) !== selected.has(idOf(c)));
    await Promise.all(
      changed.map((c) => save({ ...c, folder: selected.has(idOf(c)) ? openedFolder : "" }))
    );
    setAssignOpen(false);
    showToast({
      title: "Folder updated",
      message: `"${openedFolder}" now has ${selected.size} ${selected.size === 1 ? "company" : "companies"}.`
    });
  }

  async function removeFromFolder(company) {
    await save({ ...company, folder: "" });
    showToast({ title: "Removed from folder", message: `${company.name || "Company"} removed from "${openedFolder}".` });
  }

  async function saveCompany(company) {
    try {
      const isNew = !company._id;
      await save({ ...company, id: company.id || `company-${Date.now()}`, projects: Number(company.projects) || 0 });
      setEditing(null);
      showToast({ title: isNew ? "Company created" : "Company updated", message: `${company.name || "Company"} saved.` });
    } catch (err) {
      showToast({ type: "error", title: "Could not save company", message: err.message });
    }
  }

  async function deleteCompany(company) {
    await remove(company);
    showToast({ title: "Company deleted", message: `${company.name || "Company"} removed.` });
  }

  async function verifyDocument(company, status) {
    await save({ ...company, documentStatus: status });
    showToast({ title: "Document status updated", message: `${company.name || "Company"}'s signed document marked as ${status}.` });
  }

  function openCompany(company) {
    navigate(`/admin/companies/${company.id || company._id}`);
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("All");
    setIndustryFilter("All");
    setCityFilter("All");
    setStateFilter("All");
    setPincodeFilter("");
    setOwnerFilter("All");
    setPage(1);
  }

  function exportCompanies() {
    const headers = ["Company Name", "Industry", "GSTIN", "Status", "Lead Source", "Website"];
    const rows = filtered.map((company) => [company.name, company.industry, company.gstin, company.status, company.leadSource, company.website]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "companies.csv";
    link.click();
    URL.revokeObjectURL(url);
    setActionsOpen(false);
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Sub-header */}
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div>
          <h1 className="text-base font-medium text-[#0E121B]">Companies</h1>
          <p className="text-xs text-[#525866] mt-0.5">Manage your organisation contracts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex h-11 w-full items-center gap-2 rounded-full border border-[#1F2937]/10 px-3.5 sm:w-72">
            <Search size={16} className="text-[#1F2937]/50 shrink-0" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#1F2937]/50"
              placeholder="Search by name, industry, or status…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="relative" ref={actionsRef}>
            <button onClick={() => setActionsOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E1E4EA] bg-white text-[#1F2937] hover:bg-[#f9fafb] transition-colors">
              <MoreVertical size={16} />
            </button>
            {actionsOpen && (
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-[#e5e7eb] bg-white p-1 shadow-lg">
                <button onClick={exportCompanies} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]">
                  <Download size={14} /> Export filtered CSV
                </button>
                <button onClick={() => { resetFilters(); setActionsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]">
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
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); setPage(1); }}
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
            onReset={resetFilters}
            fields={[
              { key: "status", label: "Document / Status", type: "select", value: statusFilter, onChange: (value) => { setStatusFilter(value); setPage(1); }, options: ["All", "Accepted", "Pending", "Rejected", "Active", "Prospect"] },
              { key: "industry", label: "Industry", type: "select", value: industryFilter, onChange: (value) => { setIndustryFilter(value); setPage(1); }, options: industries },
              { key: "city", label: "City", type: "select", value: cityFilter, onChange: (value) => { setCityFilter(value); setPage(1); }, options: cities },
              { key: "state", label: "State", type: "select", value: stateFilter, onChange: (value) => { setStateFilter(value); setPage(1); }, options: states },
              { key: "owner", label: "Company owner", type: "select", value: ownerFilter, onChange: (value) => { setOwnerFilter(value); setPage(1); }, options: owners },
              { key: "pincode", label: "Pincode", type: "text", value: pincodeFilter, onChange: (value) => { setPincodeFilter(value); setPage(1); }, placeholder: "e.g. 400001" }
            ]}
          />
          {/* View toggle */}
          <button
            onClick={() => setView((v) => (v === "table" ? "hotlist" : "table"))}
            className={`flex items-center gap-1.5 rounded-full p-1 transition-colors ${view === "hotlist" ? "bg-[#0085FF]/20" : "bg-[#F1F1F5]"}`}
          >
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-medium shadow-[0_0_6px_rgba(0,0,0,0.1)]">
              <Grid2x2 size={16} className={view === "hotlist" ? "text-[#C57E5B]" : "text-[#1F2937]"} />
              <span className={view === "hotlist" ? "text-[#C57E5B]" : "text-[#1F2937]"}>Hotlist</span>
            </span>
          </button>
          <button
            onClick={() => setEditing({ name: "", gstin: "", industry: "", contact: "", projects: 0, status: "Prospect", address: "", city: "", state: "", pincode: "", website: "", leadSource: "", owner: "", notes: "" })}
            className="flex h-11 items-center gap-1.5 rounded-full bg-[#C57E5B] px-4 text-sm font-medium text-white hover:bg-[#b06a48] transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Company
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto bg-[#F1F1F5] p-6">
        {view === "table" ? (
          <div className="overflow-hidden rounded-xl border border-[#E1E4EA] bg-white shadow-[0_4px_4px_rgba(0,0,0,0.05)]">
            <div className="overflow-auto">
              <table className="min-w-full">
                <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#525866]">
                        <Building2 size={13} />
                        Company Name
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#525866]">
                        <SlidersHorizontal size={13} />
                        Industry
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#525866]">
                        Location
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#525866]">
                        <Globe size={13} />
                        Website
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#525866]">
                        GSTIN
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#525866]">
                        Document Signed
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#525866]">
                        Lead Source
                      </div>
                    </th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#6b7280]">Loading companies…</td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#6b7280]">No companies found.</td>
                    </tr>
                  ) : paginated.map((company) => (
                    <CompanyRow
                      key={company._id || company.id}
                      company={company}
                      onEdit={setEditing}
                      onDelete={deleteCompany}
                      onOpen={openCompany}
                      onClick={() => openCompany(company)}
                      onVerifyDocument={verifyDocument}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#E1E4EA]">
              <p className="text-sm text-[#6b7280]">
                Showing <span className="font-semibold text-[#111827]">{Math.min(paginated.length, PAGE_SIZE)}</span> of{" "}
                <span className="font-semibold text-[#111827]">{filtered.length}</span> Companies
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                      p === page
                        ? "bg-[#884c2d] text-white"
                        : "border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Company Hotlists panel */}
            <div className="flex flex-col gap-4 rounded-lg border border-[#E1E4EA] bg-white p-6 shadow-[0_4px_4px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-medium text-[#0E121B]">Company Hotlists</p>
                <p className="text-xs text-[#525866] mt-0.5">Organise your companies into custom folders</p>
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
                <button
                  onClick={() => setCreatingFolder(true)}
                  className="flex h-[42px] items-center gap-1.5 whitespace-nowrap rounded-full bg-[#C57E5B] px-3.5 text-xs font-medium text-white hover:bg-[#b06a48] transition-colors"
                >
                  <FolderPlus size={15} />
                  New Folder
                </button>
              </div>
            </div>

            {openedFolder ? (
              <FolderDetail
                folder={openedFolder}
                companies={openedCompanies}
                onBack={() => setOpenedFolder(null)}
                onAdd={() => setAssignOpen(true)}
                onOpenCompany={openCompany}
                onRemove={removeFromFolder}
                onVerifyDocument={verifyDocument}
              />
            ) : (
              <>
                {/* View toggle + folder pagination */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm text-[#525866]">{visibleFolders.length} folders</p>
                  <div className="flex items-center gap-1.5">
                    <div className="inline-flex h-9 items-center rounded-full border border-[#EAECF0] bg-white p-1">
                      <button
                        onClick={() => setFolderView("list")}
                        title="List view"
                        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                          folderView === "list" ? "bg-[#C57E5B] text-white" : "text-[#525866] hover:bg-[#f9fafb]"
                        }`}
                      >
                        <List size={15} />
                      </button>
                      <button
                        onClick={() => setFolderView("grid")}
                        title="Icon view"
                        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                          folderView === "grid" ? "bg-[#C57E5B] text-white" : "text-[#525866] hover:bg-[#f9fafb]"
                        }`}
                      >
                        <Grid2x2 size={15} />
                      </button>
                    </div>
                    <button
                      onClick={() => setFolderPage((p) => Math.max(1, p - 1))}
                      disabled={folderPage === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAECF0] text-[#525866] hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: folderTotalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
                      <button
                        key={p}
                        onClick={() => setFolderPage(p)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                          p === folderPage ? "bg-[#C57E5B] text-white" : "border border-[#EAECF0] text-[#525866] hover:bg-[#f9fafb]"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setFolderPage((p) => Math.min(folderTotalPages, p + 1))}
                      disabled={folderPage === folderTotalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAECF0] text-[#525866] hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Folder grid / list */}
                {visibleFolders.length === 0 ? (
                  <p className="text-center text-sm text-[#6b7280] py-12">No folders found.</p>
                ) : folderView === "grid" ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {pagedFolders.map((folder) => (
                      <FolderCard
                        key={folder}
                        folder={folder}
                        count={folderCount(folder)}
                        onClick={() => setOpenedFolder(folder)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pagedFolders.map((folder) => (
                      <FolderRow
                        key={folder}
                        folder={folder}
                        count={folderCount(folder)}
                        onClick={() => setOpenedFolder(folder)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {editing && <CompanyFormPanel company={editing} onClose={() => setEditing(null)} onSave={saveCompany} />}
      {creatingFolder && <FolderModal onClose={() => setCreatingFolder(false)} onCreate={createFolder} />}
      {assignOpen && openedFolder && (
        <AssignCompaniesModal
          folder={openedFolder}
          companies={companies}
          onClose={() => setAssignOpen(false)}
          onSave={assignCompaniesToFolder}
        />
      )}
    </div>
  );
}
