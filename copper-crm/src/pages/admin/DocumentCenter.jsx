import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2, FileArchive, FileText, Folder, FolderOpen, Grid3X3,
  Link2, List, Loader2, Lock, Search, Share2, Upload, Users, Menu, X
} from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";
import customFolderSvg from "../../assets/Folder.svg";
function readFileAsDataUrl(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (onProgress && event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    reader.onload = () => { onProgress?.(100); resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const VISIBILITY = {
  private: { label: "Private", icon: Lock, className: "bg-gray-100 text-gray-600" },
  internal: { label: "Internal Team", icon: Users, className: "bg-blue-50 text-blue-700" },
  project: { label: "Project Team", icon: FolderOpen, className: "bg-amber-50 text-amber-700" },
  client: { label: "Client Visible", icon: Share2, className: "bg-emerald-50 text-emerald-700" },
};

const TYPE_ICON = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xlsx: FileText,
  ppt: FileText,
  zip: FileArchive,
  url: Link2,
};

function fileType(name = "") {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext || "url";
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E1E4EA] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E4EA] text-[#525866]">
        <Folder size={20} />
      </div>
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#6b7280]">{text}</p>
    </div>
  );
}

function FolderCard({ icon: Icon, title, meta, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-center justify-start rounded-xl p-3 text-center transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 hover:-translate-y-1 will-change-transform ${active ? "bg-black/10 ring-1 ring-black/5" : "bg-transparent"}`}
    >
      {typeof Icon === "string" ? (
        <img src={Icon} alt="Folder" className="mb-3 h-[96px] w-auto object-contain drop-shadow-sm" />
      ) : (
        <div className={`mb-3 flex h-[96px] w-[96px] items-center justify-center text-[#525866] drop-shadow-sm`}>
          <Icon size={40} />
        </div>
      )}
      <p className="line-clamp-2 w-full text-[13px] font-medium leading-tight text-[#374151]">{title}</p>
      <p className="mt-0.5 w-full text-[11px] text-[#9ca3af]">{meta}</p>
    </button>
  );
}

function DocumentRow({ doc, selected, onSelect }) {
  const type = fileType(doc.fileName || doc.name || doc.storageUrl);
  const Icon = TYPE_ICON[type] || FileText;
  const visibility = VISIBILITY[doc.visibility] || VISIBILITY.private;
  const VisibilityIcon = visibility.icon;
  
  const dateStr = doc.createdAt || doc.date || doc.updatedAt;
  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  }) : "Unknown date";

  return (
    <div
      onClick={() => onSelect(doc)}
      className={`grid w-full grid-cols-[minmax(0,1.5fr)_120px_130px_120px_80px] gap-4 border-b border-[#f3f4f6] px-4 py-3 text-left text-sm hover:bg-[#fafafa] cursor-pointer ${selected ? "bg-[#fff8f6]" : "bg-white"}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#6b7280]">
          <Icon size={16} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-[#111827]">{doc.fileName || doc.name || "Untitled document"}</span>
          <span className="block truncate text-xs text-[#9ca3af]">{doc.tags?.join(", ") || doc.folderPath || "No tags"}</span>
        </span>
      </span>
      <span className="text-[#374151]">{type.toUpperCase()}</span>
      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${visibility.className}`}>
        <VisibilityIcon size={11} /> {visibility.label}
      </span>
      <span className="text-[#6b7280]">{formattedDate}</span>
      <span onClick={(e) => e.stopPropagation()}>
        {doc.fileUrl ? (
          <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#884c2d] hover:underline">View</a>
        ) : (
          <span className="text-xs text-[#9ca3af]">No file</span>
        )}
      </span>
    </div>
  );
}

function fileExt(filename) {
  return (filename || "").split(".").pop().toLowerCase();
}

const DOCUMENT_CATEGORIES = ["Contracts", "Invoices", "Proposals", "Design Files", "Source Code", "Deliverables"];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Same fields as the company-workspace upload panel (CompanyDetail.jsx) so
// uploading from the Documentation tab produces an identical document record.
function UploadPanel({ folderLabel, onClose, onSave }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: "", category: "Contracts", fileType: "pdf", fileUrl: "", fileSize: "", notes: "" });
  const [fileReady, setFileReady] = useState(false);
  const [reading, setReading] = useState(false);
  const [readPct, setReadPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleBrowse(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast({ type: "error", title: "File too large", message: "Files must be 8 MB or smaller. Paste a hosted file URL instead for larger files." });
      event.target.value = "";
      return;
    }
    setFileReady(false);
    setReadPct(0);
    setReading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file, setReadPct);
      setForm((prev) => ({
        ...prev,
        name: prev.name || file.name,
        fileType: fileExt(file.name) || prev.fileType,
        fileUrl: dataUrl,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      }));
      setFileReady(true);
    } finally {
      setReading(false);
      event.target.value = "";
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      showToast({ type: "error", title: "Upload failed", message: err?.message || "Could not upload the document. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      title="Upload Document"
      subtitle={folderLabel ? `Uploading to ${folderLabel}.` : "Select a company or project folder, or upload unfiled."}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || reading || saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Save Document</>}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">File *</span>
          <div className="mt-1.5 rounded-lg border border-dashed border-[#d8c2b9] bg-[#fff8f6] px-3 py-3">
            <div className="flex items-center gap-3">
              <input id="center-doc-browse" type="file" className="hidden" onChange={handleBrowse} disabled={reading || saving} />
              <label
                htmlFor="center-doc-browse"
                className={`rounded-lg bg-[#884c2d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6f381a] ${reading || saving ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
              >
                Browse…
              </label>
              <span className="truncate text-xs text-[#6b7280]">{fileReady ? `${form.name} (${form.fileSize})` : reading ? "Reading file…" : "No file selected"}</span>
            </div>
            {reading && (
              <div className="mt-2.5">
                <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
                  <span>Reading file</span><span>{readPct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f1d9cd]">
                  <div className="h-full rounded-full bg-[#884c2d] transition-all" style={{ width: `${readPct}%` }} />
                </div>
              </div>
            )}
            {saving && (
              <div className="mt-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#884c2d]">
                  <Loader2 size={11} className="animate-spin" /> Uploading to server…
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f1d9cd]">
                  <div className="upload-indeterminate h-full w-1/3 rounded-full bg-[#884c2d]" />
                </div>
              </div>
            )}
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">File name *</span>
          <input value={form.name} onChange={(e) => set("name")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">Category</span>
          <select value={form.category} onChange={(e) => set("category")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20">
            {DOCUMENT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">File type</span>
          <select value={form.fileType} onChange={(e) => set("fileType")(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20">
            {["pdf", "doc", "docx", "xlsx", "png", "jpg", "zip"].map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">...or paste a file URL</span>
          <input
            value={fileReady ? "" : form.fileUrl}
            onChange={(e) => set("fileUrl")(e.target.value)}
            disabled={fileReady}
            className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20 disabled:bg-[#f9fafb] disabled:text-[#9ca3af]"
          />
          <span className="mt-1 block text-[11px] text-[#9ca3af]">Link to an already-hosted file (Drive, S3, etc.) — only used if you don't browse a file above.</span>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#374151]">Notes</span>
          <textarea
            value={form.notes}
            rows={3}
            onChange={(e) => set("notes")(e.target.value)}
            className="mt-1.5 w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
          />
        </label>
      </div>
    </SidePanel>
  );
}

export default function DocumentCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCompanyId = searchParams.get("company");
  const selectedProjectId = searchParams.get("project");
  
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");
  const [selected, setSelected] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { records: companies } = useCrmRecords("companies");
  const { records: projects } = useCrmRecords("projects");
  const { records: documents, save: saveDocument } = useCrmRecords("documents");
  const { records: invoices } = useCrmRecords("invoices");

  const currentCompany = companies.find((c) => String(c.id) === String(selectedCompanyId) || String(c._id) === String(selectedCompanyId));
  const currentProject = projects.find((p) => String(p.id) === String(selectedProjectId) || String(p._id) === String(selectedProjectId));

  const projectDocs = useMemo(() => {
    // 1. Fetch from the documents collection where projectId is set
    const collectionDocs = documents
      .filter((doc) => doc.projectId)
      .map((doc) => {
        const project = projects.find((p) => String(p._id || p.id) === String(doc.projectId));
        return {
          ...doc,
          id: doc._id || doc.id,
          projectId: doc.projectId,
          companyId: doc.companyId || project?.companyId,
          projectName: project?.name || project?.projectName || "Project",
          visibility: doc.visibility || (doc.scope === "internal" ? "internal" : "client"),
          folderPath: `${project?.name || "Project"} / ${doc.category || "Files"}`,
          fileName: doc.fileName || doc.name,
          fileUrl: doc.fileUrl,
        };
      });

    // 2. Fetch from the embedded project.documents (fallback)
    const embeddedDocs = projects.flatMap((project) =>
      (project.documents || []).map((doc) => ({
        ...doc,
        id: doc._id || doc.id,
        projectId: project.id || project._id,
        companyId: project.companyId,
        projectName: project.name || project.projectName,
        visibility: doc.visibility || (doc.category === "Internal" ? "internal" : "client"),
        folderPath: `${project.name || "Project"} / ${doc.category || "Files"}`,
        fileName: doc.fileName || doc.name,
        fileUrl: doc.fileUrl,
      }))
    );

    // 3. Fetch from invoices (represented as PDF documents)
    const invoiceDocs = invoices.map((inv) => {
      // Try to find the matching project using the projectId or sourceOrderId
      const project = projects.find(
        (p) =>
          (inv.projectId && String(p._id || p.id) === String(inv.projectId)) ||
          (inv.sourceOrderId && p.orderId && String(p.orderId) === String(inv.sourceOrderId))
      );

      const pName = project?.name || project?.projectName || "Project";
      const pId = project?._id || project?.id;

      return {
        _id: inv._id || inv.id,
        id: inv._id || inv.id,
        name: `Tax Invoice - ${inv.invoiceNumber || inv.id}.pdf`,
        fileName: `Tax Invoice - ${inv.invoiceNumber || inv.id}.pdf`,
        fileType: "pdf",
        category: "Invoices",
        tags: ["Invoice", "Receipt"],
        projectId: pId,
        companyId: inv.companyId || project?.companyId,
        projectName: pName,
        visibility: "client",
        folderPath: `${pName} / Invoices`,
        fileUrl: `/api/invoices/${inv._id || inv.id || inv.invoiceNumber}/pdf`,
        createdAt: inv.createdAt || inv.date || inv.paidAt,
      };
    });

    return [...collectionDocs, ...embeddedDocs, ...invoiceDocs];
  }, [projects, documents, invoices]);

  const companyDocs = useMemo(() => documents.map(doc => ({
    ...doc,
    folderPath: "Company Files",
    fileName: doc.fileName || doc.name
  })), [documents]);

  const normalizedQuery = query.trim().toLowerCase();
  const filterDoc = (doc) => {
    if (!normalizedQuery) return true;
    const haystack = `${doc.fileName || ""} ${doc.folderPath || ""} ${doc.tags?.join(" ") || ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  };

  let displayFolders = [];
  let displayFiles = [];
  let viewTitle = "";
  let viewSubtitle = "";
  let breadcrumbs = [];
  let showFolders = true;
  let showFiles = false;

  if (!selectedCompanyId) {
    // Root level
    displayFolders = companies.map((company) => {
      const companyProjects = projects.filter((p) => String(p.companyId) === String(company._id || company.id));
      const companyFiles = companyDocs.filter(d => String(d.companyId) === String(company._id || company.id));
      return {
        id: company._id || company.id,
        icon: customFolderSvg,
        title: company.companyName || company.name || "Unnamed company",
        meta: `${companyProjects.length} projects, ${companyFiles.length} files`,
        type: "company"
      };
    });
    if (normalizedQuery) {
       displayFolders = displayFolders.filter(f => f.title.toLowerCase().includes(normalizedQuery));
    }
    viewTitle = "Company Folders";
    viewSubtitle = "A folder-first view of all company documents, proposals, contracts, invoices, projects, and shared files.";
    breadcrumbs = [{ label: "Document Center", onClick: () => { setSearchParams({}); setQuery(""); } }];
    showFolders = true;
    showFiles = false;
  } else if (!selectedProjectId) {
    // Company level
    const companyProjects = projects.filter((p) => String(p.companyId) === String(selectedCompanyId));
    displayFolders = companyProjects.map((project) => ({
      id: project._id || project.id,
      icon: customFolderSvg,
      title: project.name || project.projectName || "Unnamed project",
      meta: `${projectDocs.filter(d => String(d.projectId) === String(project._id || project.id)).length} items`,
      type: "project"
    }));
    if (normalizedQuery) {
       displayFolders = displayFolders.filter(f => f.title.toLowerCase().includes(normalizedQuery));
    }
    displayFiles = companyDocs.filter(d => String(d.companyId) === String(selectedCompanyId)).filter(filterDoc);
    
    viewTitle = currentCompany?.companyName || currentCompany?.name || "Company";
    viewSubtitle = `Projects and documents for ${viewTitle}`;
    breadcrumbs = [
      { label: "Document Center", onClick: () => { setSearchParams({}); setQuery(""); } },
      { label: viewTitle, onClick: () => { setSearchParams({ company: selectedCompanyId }); setQuery(""); } }
    ];
    showFolders = true;
    showFiles = false;
  } else {
    // Project level
    displayFiles = projectDocs.filter(d => String(d.projectId) === String(selectedProjectId)).filter(filterDoc);
    
    viewTitle = currentProject?.name || currentProject?.projectName || "Project";
    viewSubtitle = `Documents for project ${viewTitle}`;
    breadcrumbs = [
      { label: "Document Center", onClick: () => { setSearchParams({}); setQuery(""); } },
      { label: currentCompany?.companyName || currentCompany?.name || "Company", onClick: () => { setSearchParams({ company: selectedCompanyId }); setQuery(""); } },
      { label: viewTitle, onClick: () => {} }
    ];
    showFolders = false;
    showFiles = true;
  }

  function handleFolderClick(folder) {
    setQuery("");
    if (folder.type === "company") {
      setSearchParams({ company: folder.id });
    } else if (folder.type === "project") {
      setSearchParams({ company: selectedCompanyId, project: folder.id });
    }
  }

  async function handleUpload(form) {
    const payload = { ...form, name: form.name };
    if (selectedCompanyId) payload.companyId = selectedCompanyId;
    if (selectedProjectId) payload.projectId = selectedProjectId;
    await saveDocument(payload);
    setUploading(false);
  }

  return (
    <div className="flex min-h-full bg-white">
      <section className="min-w-0 flex-1 p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-2">
                  <button onClick={crumb.onClick} className={`${idx < breadcrumbs.length - 1 ? "hover:text-[#111827] transition-colors" : "text-[#111827]"}`}>{crumb.label}</button>
                  {idx < breadcrumbs.length - 1 && <span>/</span>}
                </span>
              ))}
            </div>
            <h1 className="text-2xl font-bold text-[#111827]">{viewTitle}</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">{viewSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3">
              <Search size={14} className="text-[#9ca3af]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents" className="w-52 bg-transparent text-sm outline-none" />
            </div>
            <button onClick={() => setView("grid")} className={`flex h-9 w-9 items-center justify-center rounded-lg border ${view === "grid" ? "border-[#884c2d] text-[#884c2d]" : "border-[#e5e7eb] text-[#6b7280]"}`}><Grid3X3 size={15} /></button>
            <button onClick={() => setView("list")} className={`flex h-9 w-9 items-center justify-center rounded-lg border ${view === "list" ? "border-[#884c2d] text-[#884c2d]" : "border-[#e5e7eb] text-[#6b7280]"}`}><List size={15} /></button>
            <Button onClick={() => setUploading(true)}><Upload size={14} /> Upload</Button>
          </div>
        </div>

        {showFolders && displayFolders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#111827] mb-4">{!selectedCompanyId ? "Companies" : "Projects"}</h2>
            {view === "grid" ? (
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {displayFolders.map((folder) => (
                  <FolderCard key={folder.id} {...folder} active={false} onClick={() => handleFolderClick(folder)} />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-4 bg-[#fafafa] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#9ca3af] border-b border-[#f3f4f6]">
                  <span>Folder</span><span className="text-right">Items</span>
                </div>
                <div className="divide-y divide-[#f3f4f6]">
                  {displayFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleFolderClick(folder)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#fafafa] bg-white"
                    >
                      <span className="flex items-center gap-3">
                        <FolderOpen size={18} className="text-[#9ca3af]" />
                        <span className="text-sm font-semibold text-[#111827]">{folder.title}</span>
                      </span>
                      <span className="text-xs font-medium text-[#6b7280] text-right">{folder.meta}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {showFolders && displayFolders.length === 0 && !selectedCompanyId && (
           <EmptyState title="No companies found." text="Create companies first. Each company becomes a document workspace." />
        )}

        {showFiles && (
          <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
            <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-3">
              <div>
                <p className="text-sm font-bold text-[#111827]">
                  {selectedProjectId ? "Project Files" : "Company Files"}
                </p>
                <p className="text-xs text-[#6b7280]">{displayFiles.length} documents visible</p>
              </div>
              <p className="text-xs font-semibold text-[#6b7280]">Private / Internal / Project Team / Client Visible</p>
            </div>
            {displayFiles.length ? (
              <div>
                <div className="grid grid-cols-[minmax(0,1.5fr)_120px_130px_120px_80px] gap-4 bg-[#fafafa] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#9ca3af]">
                  <span>Name</span><span>Type</span><span>Visibility</span><span>Date</span><span>File</span>
                </div>
                {displayFiles.map((doc, index) => (
                  <DocumentRow key={doc._id || doc.id || `${doc.fileName}-${index}`} doc={doc} selected={selected === doc} onSelect={setSelected} />
                ))}
              </div>
            ) : (
              <EmptyState title="No documents yet." text="Upload documents to see them here." />
            )}
          </div>
        )}
      </section>

      {uploading && (
        <UploadPanel folderLabel={viewTitle} onClose={() => setUploading(false)} onSave={handleUpload} />
      )}
    </div>
  );
}

