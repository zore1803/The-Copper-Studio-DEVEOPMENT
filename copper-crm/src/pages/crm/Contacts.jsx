import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpDown, Building2, Check, ChevronLeft, ChevronRight, Eye, Folder as FolderIcon,
  FolderOpen, FolderPlus, Grid2x2, Edit2, List, Mail, MessageCircle, MoreVertical, Phone, Plus,
  Save, Search, SlidersHorizontal, Trash2, X
} from "lucide-react";
import { Avatar, Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import SidePanel from "../../components/SidePanel";
import ContactFormPanel from "../../components/ContactFormPanel";
import ContactExportMenu from "../../components/ContactExportMenu";
import { useToast } from "../../components/useToast";
import FilterButton from "../../components/FilterButton";
import { contactFullName } from "../../lib/contacts";

const PAGE_SIZE = 12;
const FOLDER_PAGE_SIZE = 8;

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "company_asc", label: "Company (A–Z)" },
];

const DEFAULT_FOLDERS = ["Key Contacts", "Decision Makers", "Follow Up", "VIP"];
const FOLDERS_STORAGE_KEY = "cs-contact-hotlist-folders";

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

function uniqueSorted(records, key) {
  return [
    "All",
    ...Array.from(new Set(records.map((r) => r[key]).filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b))
    ),
  ];
}

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

function EmptyState({ onCreate }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866]">
        <Phone size={20} />
      </div>
      <p className="text-sm font-semibold text-[#111827]">No contacts yet.</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#6b7280]">Contacts are people inside companies. Add them with company links so deals, projects, and communication history stay connected.</p>
      <Button className="mt-4" onClick={onCreate}><Plus size={14} /> New Contact</Button>
    </div>
  );
}

function ContactRow({ contact, companyName, onEdit, onDelete, onOpen }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useClickOutside([btnRef, menuRef], () => setMenuOpen(false), menuOpen);

  function toggleMenu(event) {
    event.stopPropagation();
    if (!menuOpen) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
    }
    setMenuOpen((value) => !value);
  }

  return (
    <div
      className="grid grid-cols-[minmax(220px,1.2fr)_minmax(160px,1fr)_180px_180px_120px_auto] gap-4 border-b border-[#f3f4f6] px-4 py-3 text-sm hover:bg-[#fafafa] cursor-pointer"
      onClick={() => onOpen(contact)}
    >
      <button onClick={(e) => { e.stopPropagation(); onOpen(contact); }} className="flex min-w-0 items-center gap-3 text-left">
        <Avatar name={contactFullName(contact)} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-[#111827]">{contactFullName(contact)}</span>
          <span className="block truncate text-xs text-[#6b7280]">{contact.designation || "No designation"}</span>
        </span>
      </button>
      <span className="flex min-w-0 items-center gap-2 text-[#374151]"><Building2 size={13} className="text-[#9ca3af]" /> <span className="truncate">{companyName}</span></span>
      <span className="flex min-w-0 items-center gap-2 text-[#374151]"><Mail size={13} className="text-[#9ca3af]" /> <span className="truncate">{contact.email || "Not added"}</span></span>
      <span className="flex min-w-0 items-center gap-2 text-[#374151]"><MessageCircle size={13} className="text-[#9ca3af]" /> <span className="truncate">{contact.whatsapp || contact.phone || "Not added"}</span></span>
      <span className="h-fit rounded-full bg-[#f3f4f6] px-2 py-1 text-center text-xs font-semibold text-[#374151]">{contact.status || "Active"}</span>
      <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <ContactExportMenu contact={contact} companyName={companyName} />
        <button
          ref={btnRef}
          onClick={toggleMenu}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && menuPos && createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-50 w-44 rounded-xl border border-[#e5e7eb] bg-white shadow-lg py-1"
          >
            <button onClick={() => { setMenuOpen(false); onOpen(contact); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb]">
              <Eye size={14} /> Open profile
            </button>
            <button onClick={() => { setMenuOpen(false); onEdit(contact); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb]">
              <Edit2 size={14} /> Edit contact
            </button>
            <button onClick={() => { setMenuOpen(false); onDelete(contact); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Delete
            </button>
          </div>,
          document.body
        )}
      </span>
    </div>
  );
}

function FolderCard({ folder, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-xl border border-[#E1E4EA] bg-white p-4 text-left transition-colors hover:bg-[#fafafa]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866]">
        <FolderIcon size={18} />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#0E121B]">{folder}</p>
        <p className="text-xs text-[#525866] mt-0.5">{count} contacts</p>
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
      <span className="text-xs text-[#525866]">{count} contacts</span>
    </button>
  );
}

function FolderDetail({ folder, contacts, companyMap, onBack, onAdd, onOpenContact, onRemove }) {
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
              <p className="text-xs text-[#525866]">{contacts.length} {contacts.length === 1 ? "contact" : "contacts"}</p>
            </div>
          </div>
        </div>
        <button onClick={onAdd} className="flex h-[42px] items-center gap-1.5 self-start rounded-full bg-[#C57E5B] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#b06a48] sm:self-auto">
          <Plus size={15} /> Add contacts
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white py-12 text-center">
          <p className="text-sm text-[#6b7280]">No contacts in this folder yet.</p>
          <button onClick={onAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#C57E5B] px-3.5 py-2 text-xs font-medium text-[#C57E5B] transition-colors hover:bg-[#fff8f6]">
            <Plus size={14} /> Add contacts
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => {
            const company = companyMap.get(String(c.companyId));
            const companyName = company?.companyName || company?.name || c.company || "Not linked";
            return (
              <div key={c._id || c.id} className="group relative flex flex-col gap-2 rounded-xl border border-[#E1E4EA] bg-white p-4">
                <button onClick={() => onRemove(c)} className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-lg text-[#9ca3af] transition-colors hover:bg-red-50 hover:text-red-600 group-hover:flex" title="Remove from folder">
                  <X size={14} />
                </button>
                <div className="flex items-center gap-3">
                  <Avatar name={contactFullName(c)} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">{contactFullName(c)}</p>
                    <p className="truncate text-xs text-[#525866]">{c.designation || companyName}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#f3f4f6] px-2 py-1 text-[11px] font-semibold text-[#374151]">{c.status || "Active"}</span>
                  <button onClick={() => onOpenContact(c)} className="inline-flex items-center gap-1 text-xs font-medium text-[#884c2d] hover:underline">
                    <Eye size={13} /> Open
                  </button>
                </div>
              </div>
            );
          })}
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
      subtitle="Create a custom hotlist folder to group contacts."
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
          placeholder="e.g. Q3 Decision Makers"
          className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none transition-all focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
        />
      </label>
    </SidePanel>
  );
}

function AssignContactsModal({ folder, contacts, onClose, onSave }) {
  const idOf = (c) => c._id || c.id;
  const [selected, setSelected] = useState(() => new Set(contacts.filter((c) => (c.folder || "") === folder).map(idOf)));
  const [query, setQuery] = useState("");

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const list = contacts.filter((c) => `${contactFullName(c)} ${c.designation || ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <SidePanel
      title={`Add contacts to ${folder}`}
      subtitle="Select the contacts that belong in this hotlist folder."
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
          placeholder="Search contacts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        {list.map((c) => {
          const id = idOf(c);
          const checked = selected.has(id);
          return (
            <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${checked ? "border-[#C57E5B] bg-[#fff8f6]" : "border-[#e5e7eb] hover:bg-[#f9fafb]"}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(id)} className="rounded border-[#d1d5db] accent-[#884c2d]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#111827]">{contactFullName(c)}</p>
                <p className="truncate text-xs text-[#525866]">
                  {c.designation || "—"}
                  {c.folder && c.folder !== folder ? ` · in ${c.folder}` : ""}
                </p>
              </div>
            </label>
          );
        })}
        {list.length === 0 && <p className="py-8 text-center text-sm text-[#6b7280]">No contacts found.</p>}
      </div>
    </SidePanel>
  );
}

export default function Contacts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(() => (location.state?.openCreate
    ? { salutation: "", firstName: "", lastName: "", email: "", phone: "", whatsapp: "", designation: "", linkedin: "", companyId: "", status: "Active" }
    : null));
  const { records: contacts, save, remove, loading } = useCrmRecords("contacts");
  const { records: companies } = useCrmRecords("companies");

  useEffect(() => {
    if (location.state?.openCreate) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [view, setView] = useState("table");
  const [statusFilter, setStatusFilter] = useState("All");
  const [designationFilter, setDesignationFilter] = useState("All");
  const [companyFilter, setCompanyFilter] = useState("All");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [sortBy, setSortBy] = useState("name_asc");
  const [sortOpen, setSortOpen] = useState(false);
  const actionsRef = useRef(null);
  const sortRef = useRef(null);
  useClickOutside(actionsRef, () => setActionsOpen(false), actionsOpen);
  useClickOutside(sortRef, () => setSortOpen(false), sortOpen);

  const [folders, setFolders] = useState(loadStoredFolders);
  const [folderSearch, setFolderSearch] = useState("");
  const [openedFolder, setOpenedFolder] = useState(null);
  const [folderView, setFolderView] = useState("grid");
  const [folderPage, setFolderPage] = useState(1);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const companyMap = useMemo(() => new Map(companies.map((c) => [String(c.id || c._id), c])), [companies]);

  const companyNameOf = useCallback(
    (contact) => companyMap.get(String(contact.companyId))?.companyName || companyMap.get(String(contact.companyId))?.name || contact.company || "Not linked",
    [companyMap]
  );

  const designations = useMemo(() => uniqueSorted(contacts, "designation"), [contacts]);
  const statuses = useMemo(() => uniqueSorted(contacts, "status"), [contacts]);
  const companyNames = useMemo(
    () => ["All", ...Array.from(new Set(contacts.map(companyNameOf).filter((n) => n && n !== "Not linked"))).sort()],
    [contacts, companyNameOf]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchesQuery = !needle || `${contact.salutation || ""} ${contact.firstName || ""} ${contact.lastName || ""} ${contact.name || ""} ${contact.email || ""} ${contact.phone || ""} ${contact.whatsapp || ""} ${contact.designation || ""} ${companyNameOf(contact)}`.toLowerCase().includes(needle);
      const matchesStatus = statusFilter === "All" || (contact.status || "Active") === statusFilter;
      const matchesDesignation = designationFilter === "All" || contact.designation === designationFilter;
      const matchesCompany = companyFilter === "All" || companyNameOf(contact) === companyFilter;
      return matchesQuery && matchesStatus && matchesDesignation && matchesCompany;
    });
  }, [contacts, search, statusFilter, designationFilter, companyFilter, companyNameOf]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const byStr = (a, b, getter) => String(getter(a) || "").localeCompare(String(getter(b) || ""), undefined, { sensitivity: "base" });
    const byCreated = (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    switch (sortBy) {
      case "name_desc": return arr.sort((a, b) => byStr(b, a, contactFullName));
      case "created_desc": return arr.sort((a, b) => byCreated(b, a));
      case "created_asc": return arr.sort(byCreated);
      case "company_asc": return arr.sort((a, b) => byStr(a, b, companyNameOf));
      case "name_asc":
      default: return arr.sort((a, b) => byStr(a, b, contactFullName));
    }
  }, [filtered, sortBy, companyNameOf]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allFolders = useMemo(() => {
    const fromContacts = contacts.map((c) => c.folder).filter(Boolean);
    return Array.from(new Set([...folders, ...fromContacts]));
  }, [folders, contacts]);

  const visibleFolders = useMemo(
    () => allFolders.filter((f) => f.toLowerCase().includes(folderSearch.toLowerCase())),
    [allFolders, folderSearch]
  );

  const folderTotalPages = Math.max(1, Math.ceil(visibleFolders.length / FOLDER_PAGE_SIZE));
  const pagedFolders = visibleFolders.slice((folderPage - 1) * FOLDER_PAGE_SIZE, folderPage * FOLDER_PAGE_SIZE);

  useEffect(() => {
    if (folderPage > folderTotalPages) setFolderPage(1);
  }, [folderPage, folderTotalPages]);

  const openedContacts = useMemo(
    () => (openedFolder ? contacts.filter((c) => (c.folder || "") === openedFolder) : []),
    [contacts, openedFolder]
  );

  function folderCount(folder) {
    return contacts.filter((c) => (c.folder || "") === folder).length;
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

  async function assignContactsToFolder(selectedIds) {
    const idOf = (c) => c._id || c.id;
    const selected = new Set(selectedIds);
    const changed = contacts.filter((c) => ((c.folder || "") === openedFolder) !== selected.has(idOf(c)));
    await Promise.all(changed.map((c) => save({ ...c, folder: selected.has(idOf(c)) ? openedFolder : "" })));
    setAssignOpen(false);
    showToast({ title: "Folder updated", message: `"${openedFolder}" now has ${selected.size} ${selected.size === 1 ? "contact" : "contacts"}.` });
  }

  async function removeFromFolder(contact) {
    await save({ ...contact, folder: "" });
    showToast({ title: "Removed from folder", message: `${contactFullName(contact)} removed from "${openedFolder}".` });
  }

  async function saveContact(contact) {
    const payload = {
      ...contact,
      id: contact.id || `contact-${Date.now()}`,
      name: contact.name || `${contact.salutation || ""} ${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
    };
    await save(payload);
    setEditing(null);
    showToast({ title: "Contact saved", message: `${payload.name || "Contact"} is linked to ${companyNameOf(payload)}.` });
  }

  async function deleteContact(contact) {
    await remove(contact);
    showToast({ title: "Contact deleted", message: `${contactFullName(contact)} removed.` });
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("All");
    setDesignationFilter("All");
    setCompanyFilter("All");
    setPage(1);
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div>
          <h1 className="text-base font-medium text-[#0E121B]">Contacts</h1>
          <p className="text-xs text-[#525866] mt-0.5">Manage your organisation contacts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-11 w-full items-center gap-2 rounded-full border border-[#1F2937]/10 px-3.5 sm:w-72">
            <Search size={16} className="text-[#1F2937]/50 shrink-0" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, or company..." className="w-full bg-transparent text-sm outline-none placeholder:text-[#1F2937]/50" />
          </div>
          <div className="relative" ref={actionsRef}>
            <button onClick={() => setActionsOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E1E4EA] bg-white text-[#1F2937] hover:bg-[#f9fafb] transition-colors">
              <MoreVertical size={16} />
            </button>
            {actionsOpen && (
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-[#e5e7eb] bg-white p-1 shadow-lg">
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

            {/* Filters */}
            <FilterButton
              panelWidth={520}
              onReset={resetFilters}
              fields={[
                { key: "status", label: "Status", type: "select", value: statusFilter, onChange: (value) => { setStatusFilter(value); setPage(1); }, options: statuses },
                { key: "designation", label: "Designation", type: "select", value: designationFilter, onChange: (value) => { setDesignationFilter(value); setPage(1); }, options: designations },
                { key: "company", label: "Company", type: "select", value: companyFilter, onChange: (value) => { setCompanyFilter(value); setPage(1); }, options: companyNames }
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
              onClick={() => setEditing({ salutation: "", firstName: "", lastName: "", email: "", phone: "", whatsapp: "", designation: "", linkedin: "", companyId: "", status: "Active" })}
              className="flex h-11 items-center gap-1.5 rounded-full bg-[#C57E5B] px-4 text-sm font-medium text-white hover:bg-[#b06a48] transition-colors shadow-sm"
            >
              <Plus size={16} /> New Contact
            </button>
          </div>
        </div>

      <main className="flex-1 overflow-auto bg-[#F1F1F5] p-6">
        {view === "table" ? (
          <>
            <div className="overflow-hidden rounded-xl border border-[#E1E4EA] bg-white">
              <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(160px,1fr)_180px_180px_120px_auto] gap-4 border-b border-[#f3e5e0] bg-[#fff1ec] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#9ca3af]">
                <span className="flex items-center gap-1.5"><SlidersHorizontal size={12} /> Contact</span>
                <span>Associated Company</span><span>Email</span><span>WhatsApp</span><span>Status</span><span />
              </div>
              {loading ? (
                <div className="p-10 text-center text-sm text-[#6b7280]">Loading contacts...</div>
              ) : rows.length ? (
                rows.map((contact) => (
                  <ContactRow
                    key={contact._id || contact.id}
                    contact={contact}
                    companyName={companyNameOf(contact)}
                    onEdit={setEditing}
                    onDelete={deleteContact}
                    onOpen={(c) => navigate(`/admin/contacts/${c._id || c.id}`)}
                  />
                ))
              ) : <div className="p-5"><EmptyState onCreate={() => setEditing({ status: "Active" })} /></div>}
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-[#6b7280]">
              <span>Showing {rows.length} of {filtered.length} contacts</span>
              <div className="flex items-center gap-1">
                <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1 disabled:opacity-40">Prev</button>
                <span className="px-2 text-xs font-semibold">Page {page} / {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-lg border border-[#E1E4EA] bg-white p-6 shadow-[0_4px_4px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-medium text-[#0E121B]">Contact Hotlists</p>
                <p className="text-xs text-[#525866] mt-0.5">Organise your contacts into custom folders</p>
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
              <FolderDetail
                folder={openedFolder}
                contacts={openedContacts}
                companyMap={companyMap}
                onBack={() => setOpenedFolder(null)}
                onAdd={() => setAssignOpen(true)}
                onOpenContact={(c) => navigate(`/admin/contacts/${c._id || c.id}`)}
                onRemove={removeFromFolder}
              />
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm text-[#525866]">{visibleFolders.length} folders</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setFolderView((v) => (v === "grid" ? "list" : "grid"))}
                      title={folderView === "grid" ? "Switch to list view" : "Switch to grid view"}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAECF0] text-[#525866] hover:bg-[#f9fafb] transition-colors"
                    >
                      {folderView === "grid" ? <List size={16} /> : <Grid2x2 size={16} />}
                    </button>
                    <button onClick={() => setFolderPage((p) => Math.max(1, p - 1))} disabled={folderPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAECF0] text-[#525866] hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: folderTotalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
                      <button
                        key={p}
                        onClick={() => setFolderPage(p)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${p === folderPage ? "bg-[#C57E5B] text-white" : "border border-[#EAECF0] text-[#525866] hover:bg-[#f9fafb]"}`}
                      >
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setFolderPage((p) => Math.min(folderTotalPages, p + 1))} disabled={folderPage === folderTotalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAECF0] text-[#525866] hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {visibleFolders.length === 0 ? (
                  <p className="text-center text-sm text-[#6b7280] py-12">No folders found.</p>
                ) : folderView === "grid" ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {pagedFolders.map((folder) => (
                      <FolderCard key={folder} folder={folder} count={folderCount(folder)} onClick={() => setOpenedFolder(folder)} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pagedFolders.map((folder) => (
                      <FolderRow key={folder} folder={folder} count={folderCount(folder)} onClick={() => setOpenedFolder(folder)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {editing && (
        <ContactFormPanel
          contact={editing}
          companies={companies}
          onClose={() => setEditing(null)}
          onSave={saveContact}
        />
      )}
      {creatingFolder && <FolderModal onClose={() => setCreatingFolder(false)} onCreate={createFolder} />}
      {assignOpen && openedFolder && (
        <AssignContactsModal
          folder={openedFolder}
          contacts={contacts}
          onClose={() => setAssignOpen(false)}
          onSave={assignContactsToFolder}
        />
      )}
    </div>
  );
}
