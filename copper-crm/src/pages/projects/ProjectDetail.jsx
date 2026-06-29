import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ListChecks, Palette, Code2, FlaskConical, ClipboardCheck, Rocket, Zap,
  CheckCircle2, Calendar,
  Settings2, Save, Trash2
} from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";
import SearchableSelectField from "../../components/SearchableSelect";
import ProjectHeader from "./ProjectHeader";
import { roadmapProgress, isRoadmapComplete, nextPhaseForStages } from "../../lib/stageProgress";

const PHASES = [
  { key: "Requirement Gathering", label: "Requirement", icon: ListChecks },
  { key: "Design", label: "Design", icon: Palette },
  { key: "Development", label: "Development", icon: Code2 },
  { key: "Testing", label: "Testing", icon: FlaskConical },
  { key: "Review", label: "Review", icon: ClipboardCheck },
  { key: "Completed", label: "Deployment", icon: Rocket },
];

const PACKAGE_OPTIONS = ["Starter Studio", "Growth Studio", "Enterprise Studio", "Custom"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const PAYMENT_STATUS_OPTIONS = ["Pending", "Partial", "Paid", "Overdue"];

const CLIENT_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function parseMoney(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function PanelField({ label, value, onChange, type = "text", disabled = false, span = false }) {
  return (
    <label className={`block ${span ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input
        type={type}
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className={`mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20 ${disabled ? "bg-[#f9fafb] text-[#6b7280]" : ""}`}
      />
    </label>
  );
}

function PanelSelect({ label, value, onChange, options = [], span = false }) {
  const normalized = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
  return (
    <label className={`block ${span ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
      >
        <option value="">Select...</option>
        {normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function PanelSection({ title, children }) {
  return (
    <div className="space-y-3 border-t border-[#f3f4f6] pt-5 first:border-t-0 first:pt-0">
      <h4 className="text-xs font-bold uppercase tracking-wide text-[#884c2d]">{title}</h4>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function KpiChip({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#E1E4EA] bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F1F5] text-[#884c2d]">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[#525866]">{label}</p>
          <p className="mt-0.5 truncate text-base font-bold text-[#0E121B]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <section className="rounded-2xl border border-[#E1E4EA] bg-white shadow-[0_18px_40px_rgba(79,39,16,0.06)]">
      <div className="flex items-center justify-between border-b border-[#f3f4f6] bg-[#FAFAFA] rounded-t-2xl px-5 sm:px-7 py-4">
        <h3 className="font-display text-sm font-bold text-[#0E121B]">{title}</h3>
        {action}
      </div>
      <div className="p-5 sm:p-7">{children}</div>
    </section>
  );
}

function MetaRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F1F1F5] text-[#884c2d]">
        <Icon size={17} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{label}</p>
        <p className="text-sm font-bold text-[#0E121B]">{value || "—"}</p>
      </div>
    </div>
  );
}



function ManageProjectPanel({ project, invoices = [], onClose, onSave, onDelete }) {
  const { showToast } = useToast();

  // Reflect the project's actual stages — don't silently re-inject defaults, otherwise
  // deleting every stage would make them reappear. Use "+ Add Stage" to add new ones.
  const initialStages = Array.isArray(project.stages) ? project.stages : [];

  const [form, setForm] = useState({
    name: project.name || "",
    packageName: project.packageName || project.packagePurchased || project.package || "",
    customPackageName: "",
    startDate: project.startDate ? String(project.startDate).slice(0, 10) : "",
    expectedEndDate: (project.expectedEndDate || project.dueDate) ? String(project.expectedEndDate || project.dueDate).slice(0, 10) : "",
    priority: project.priority || "Medium",
    status: project.status || "Requirement Gathering",
    budget: project.budget ?? project.packageValue ?? "",
    budgetUsed: project.budgetUsed ?? "",
    discount: project.discount ?? project.discountApplied ?? "",
    linkedInvoiceId: project.linkedInvoiceId || "",
    paymentStatus: project.paymentStatus || "Pending",
    progress: project.progress || 0,
    clientStatus: project.clientStatus || "in_progress",
    currentPhase: project.currentPhase || project.status || "In Progress",
    adminNotes: project.adminNotes || "",
    stages: initialStages,
  });

  const set = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  function updateStage(index, field, value) {
    setForm(prev => {
      const nextStages = [...prev.stages];
      nextStages[index] = { ...nextStages[index], [field]: value };
      
      let updates = {};
      if (field === "status") {
        const complete = isRoadmapComplete(nextStages);
        const nextPhase = nextPhaseForStages(nextStages);
        updates = {
          progress: roadmapProgress(nextStages),
          currentPhase: nextPhase,
          status: complete ? "Completed" : nextPhase,
          clientStatus: complete ? "completed" : prev.clientStatus === "completed" ? "in_progress" : prev.clientStatus,
        };
      }
      
      return { ...prev, stages: nextStages, ...updates };
    });
  }

  function addStage() {
    setForm(prev => ({
      ...prev,
      stages: [...prev.stages, { name: "New Phase", status: "not_started", clientVisible: true }]
    }));
  }

  function removeStage(index) {
    setForm(prev => ({
      ...prev,
      stages: prev.stages.filter((_, i) => i !== index)
    }));
  }

  function moveStageUp(index) {
    if (index === 0) return;
    setForm(prev => {
      const nextStages = [...prev.stages];
      [nextStages[index - 1], nextStages[index]] = [nextStages[index], nextStages[index - 1]];
      return { ...prev, stages: nextStages };
    });
  }

  function moveStageDown(index) {
    if (index === form.stages.length - 1) return;
    setForm(prev => {
      const nextStages = [...prev.stages];
      [nextStages[index + 1], nextStages[index]] = [nextStages[index], nextStages[index + 1]];
      return { ...prev, stages: nextStages };
    });
  }

  const finalAmount = Math.max(parseMoney(form.budget) - parseMoney(form.discount), 0);

  function handleSaveClick() {
    const pStartStr = form.startDate;
    const pEndStr = form.expectedEndDate;

    for (let i = 0; i < form.stages.length; i++) {
      const stage = form.stages[i];
      if (stage.startDate && pStartStr && stage.startDate < pStartStr) {
        return showToast({ type: "error", title: "Invalid Date", message: `Stage ${i+1} start date cannot be before project start.` });
      }
      if (stage.endDate && pEndStr && stage.endDate > pEndStr) {
        return showToast({ type: "error", title: "Invalid Date", message: `Stage ${i+1} end date cannot be after project expected completion.` });
      }
    }

    onSave(form);
  }

  return (
    <SidePanel
      title="Manage Project"
      subtitle="Updates are immediately visible to the client in their portal."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onDelete} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Delete Project
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSaveClick}><Save size={14} /> Save & Publish</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <PanelSection title="Basic Details">
          <PanelField span label="Project name" value={form.name} onChange={set("name")} />
          <PanelSelect label="Package purchased" value={form.packageName} onChange={(val) => {
            setForm(prev => {
              let autoBudget = prev.budget;
              if (val === "Starter Studio") autoBudget = 24999;
              else if (val === "Growth Studio") autoBudget = 49999;
              else if (val === "Enterprise Studio") autoBudget = 89999;
              return { ...prev, packageName: val, budget: autoBudget };
            });
          }} options={PACKAGE_OPTIONS} />
          {form.packageName === "Custom" && (
            <PanelField label="Custom package name" value={form.customPackageName} onChange={set("customPackageName")} />
          )}
          <PanelSelect label="Priority" value={form.priority} onChange={set("priority")} options={PRIORITY_OPTIONS} />
        </PanelSection>

        <PanelSection title="Timeline">
          <PanelField type="date" label="Project start date" value={form.startDate} onChange={set("startDate")} />
          <PanelField type="date" label="Expected completion" value={form.expectedEndDate} onChange={set("expectedEndDate")} />
        </PanelSection>

        <PanelSection title="Commercials">
          <PanelField type="number" label="Package value / price" value={form.budget} onChange={set("budget")} />
          <PanelField type="number" label="Discount applied" value={form.discount} onChange={set("discount")} />
          <PanelField type="number" label="Budget used" value={form.budgetUsed} onChange={set("budgetUsed")} />
          <PanelField label="Final amount" value={formatINR(finalAmount)} disabled />
          <SearchableSelectField label="Linked invoice" value={form.linkedInvoiceId} onChange={set("linkedInvoiceId")}
            options={invoices.map((invoice) => ({ value: String(invoice.id || invoice._id), label: invoice.invoiceNumber || invoice.invoiceId || invoice.id || invoice._id }))} placeholder="Search invoices…" />
          <PanelSelect label="Payment status" value={form.paymentStatus} onChange={set("paymentStatus")} options={PAYMENT_STATUS_OPTIONS} />
        </PanelSection>

        <div>
          <label className="block text-xs font-semibold text-[#374151] mb-2">
            Overall Progress — {form.progress}%
          </label>
          <div className="h-2 rounded-full bg-[#f3f4f6] overflow-hidden">
            <div className="h-full rounded-full bg-[#884c2d] transition-all" style={{ width: `${form.progress}%` }} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#374151] mb-1.5">Client-Visible Status</label>
          <select
            value={form.clientStatus}
            onChange={e => set("clientStatus")(e.target.value)}
            className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
          >
            {CLIENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="rounded-xl bg-[#F1F1F5] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-[#111827]">Project Stages</h3>
            <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#884c2d] shadow-sm">
              <span className="flex h-3 w-3 items-center justify-center rounded-full border border-[#884c2d]">i</span>
              Client Visible
            </span>
          </div>
          
          <div className="space-y-4">
            {form.stages.map((stage, index) => (
              <div key={index} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm border border-[#e5e7eb]">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#884c2d] text-xs font-bold text-white shadow-sm">
                    {index + 1}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Phase Name"
                    value={stage.name || ""} 
                    onChange={(e) => updateStage(index, "name", e.target.value)}
                    className="flex-1 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-bold text-[#111827] outline-none focus:border-[#884c2d] focus:bg-white focus:ring-1 focus:ring-[#884c2d]/50"
                  />
                  <select
                    value={stage.status || "not_started"}
                    onChange={(e) => updateStage(index, "status", e.target.value)}
                    className="w-36 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm font-bold text-[#111827] outline-none focus:border-[#884c2d] focus:bg-white focus:ring-1 focus:ring-[#884c2d]/50"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                  </select>
                  <div className="flex flex-col items-center gap-0.5 border-l border-[#e5e7eb] pl-2">
                    <button type="button" onClick={() => moveStageUp(index)} disabled={index === 0} className="text-[#9ca3af] hover:text-[#111827] disabled:opacity-30">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <button type="button" onClick={() => moveStageDown(index)} disabled={index === form.stages.length - 1} className="text-[#9ca3af] hover:text-[#111827] disabled:opacity-30">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  </div>
                  <button type="button" onClick={() => removeStage(index)} className="p-1.5 text-[#9ca3af] hover:text-[#E82222] transition-colors ml-1">
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pl-10">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-widest text-[#6b7280]">Start Date</label>
                    <input 
                      type="date" 
                      value={stage.startDate ? String(stage.startDate).slice(0, 10) : ""} 
                      min={form.startDate || undefined}
                      max={form.expectedEndDate || undefined}
                      onChange={(e) => updateStage(index, "startDate", e.target.value)}
                      className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] font-medium outline-none focus:border-[#884c2d] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-widest text-[#6b7280]">End Date</label>
                    <input 
                      type="date" 
                      value={stage.endDate ? String(stage.endDate).slice(0, 10) : ""} 
                      min={form.startDate || undefined}
                      max={form.expectedEndDate || undefined}
                      onChange={(e) => updateStage(index, "endDate", e.target.value)}
                      className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] font-medium outline-none focus:border-[#884c2d] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="pl-10">
                  <textarea
                    rows={1}
                    placeholder="Stage notes (visible to client)..."
                    value={stage.notes || ""}
                    onChange={(e) => updateStage(index, "notes", e.target.value)}
                    className="w-full resize-none rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#884c2d] focus:bg-white placeholder:text-[#9ca3af]"
                  />
                </div>

                <div className="pl-10 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-[#111827] cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={stage.clientVisible !== false}
                      onChange={(e) => updateStage(index, "clientVisible", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]"
                    />
                    Client Visible
                  </label>
                  <textarea
                    rows={1}
                    placeholder="Internal notes (hidden from client)..."
                    value={stage.internalNotes || ""}
                    onChange={(e) => updateStage(index, "internalNotes", e.target.value)}
                    className="w-full resize-none rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#884c2d] focus:bg-white placeholder:text-[#9ca3af]"
                  />
                </div>

              </div>
            ))}
          </div>

          <button type="button" onClick={addStage} className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-[#d1d5db] py-3 text-sm font-bold text-[#6b7280] hover:bg-[#f9fafb] transition-colors">
            + Add Stage
          </button>
        </div>


      </div>
    </SidePanel>
  );
}

export default function ProjectDetail() {
  const { companyId, projectId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { records: companies } = useCrmRecords("companies");
  const { records: allProjects, loading: projectsLoading, save: saveProject, remove: removeProject } = useCrmRecords("projects");
  const { records: invoices } = useCrmRecords("invoices");
  const [managing, setManaging] = useState(false);

  const project = useMemo(
    () => allProjects.find((p) => String(p.id || p._id) === projectId),
    [allProjects, projectId]
  );
  const company = useMemo(
    () => companies.find((c) =>
      String(c.id) === companyId ||
      String(c._id) === companyId ||
      String(c.id || c._id) === String(project?.companyId) ||
      c.name === project?.client ||
      c.name === project?.company ||
      c.name === project?.companyName
    ),
    [companies, companyId, project]
  );

  if (!project && projectsLoading) {
    return (
      <div className="rounded-2xl border border-[#E1E4EA] bg-[#FFFFFF] p-10 text-center">
        <p className="text-sm font-semibold text-[#525866]">Loading project…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-2xl border border-[#E1E4EA] bg-[#FFFFFF] p-10 text-center">
        <p className="text-sm font-semibold text-[#525866]">We couldn't find that project for this company.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate("/admin/companies")}>Back to Companies</Button>
      </div>
    );
  }

  const stages = Array.isArray(project.stages) ? project.stages : [];
  // Driven entirely by the project's real stages — no phantom defaults when empty.
  const displayPhases = stages.map(s => {
    const standardPhase = PHASES.find(p => p.label === s.name || p.key === s.name);
    return { key: s.name, label: s.name, icon: standardPhase ? standardPhase.icon : CheckCircle2 };
  });

  // Derive progress and the active phase live from the stages so the roadmap stays
  // correct even if the stored project.progress / currentPhase are stale (e.g. after
  // stages were changed on the Kanban/Gantt board).
  const liveProgress = stages.length ? roadmapProgress(stages) : (project.progress || 0);

  // Active stage by INDEX (not name) so duplicate stage names don't collide.
  let phaseIndex;
  if (stages.length) {
    if (isRoadmapComplete(stages)) {
      phaseIndex = stages.length - 1;
    } else {
      phaseIndex = stages.findIndex(s => s.status === "in_progress");
      if (phaseIndex === -1) phaseIndex = stages.findIndex(s => s.status === "review");
      if (phaseIndex === -1) phaseIndex = stages.findIndex(s => s.status !== "completed");
      if (phaseIndex === -1) phaseIndex = 0;
    }
  } else {
    phaseIndex = displayPhases.findIndex(p => p.key === (project.currentPhase || project.status) || p.label === (project.currentPhase || project.status));
    if (phaseIndex === -1) phaseIndex = project.progress >= 100 ? displayPhases.length - 1 : 0;
  }

  const budgetPct = Math.min(100, Math.round(((project.budgetUsed || 0) / Math.max(project.budget || 1, 1)) * 100));
  const currentCompany = company || { id: companyId, name: project.client || project.company || project.companyName || "Company" };


  async function handleSaveProject(updates) {
    const packageName = updates.packageName === "Custom" ? (updates.customPackageName || "Custom") : updates.packageName;
    const roadmapComplete = isRoadmapComplete(updates.stages);
    const nextProgress = roadmapComplete ? 100 : Number(updates.progress);
    const nextPhase = roadmapComplete ? "Completed" : updates.currentPhase;
    const updatedProject = {
      ...project,
      name: updates.name,
      packageName,
      packagePurchased: packageName,
      startDate: updates.startDate,
      expectedEndDate: updates.expectedEndDate,
      dueDate: updates.expectedEndDate,
      priority: updates.priority,
      status: roadmapComplete ? "Completed" : updates.status,
      budget: parseMoney(updates.budget),
      packageValue: parseMoney(updates.budget),
      budgetUsed: parseMoney(updates.budgetUsed),
      discount: parseMoney(updates.discount),
      discountApplied: parseMoney(updates.discount),
      finalAmount: Math.max(parseMoney(updates.budget) - parseMoney(updates.discount), 0),
      linkedInvoiceId: updates.linkedInvoiceId,
      paymentStatus: updates.paymentStatus,
      progress: nextProgress,
      clientStatus: roadmapComplete ? "completed" : updates.clientStatus,
      currentPhase: nextPhase,
      adminNotes: updates.adminNotes,
      stages: updates.stages,
    };
    await saveProject(updatedProject);
    setManaging(false);
    showToast({ title: "Project updated", message: "Details, commercials, and client updates were saved." });
  }

  async function handleDeleteProject() {
    if (!window.confirm(`Delete "${project.name || "this project"}"? This cannot be undone.`)) return;
    await removeProject(project);
    showToast({ title: "Project deleted", message: `${project.name || "Project"} removed.` });
    navigate(`/admin/companies/${currentCompany.id || currentCompany._id}`);
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f8fafc]">
      <ProjectHeader
        company={currentCompany}
        project={project}
        activeTab="Overview"
        actionLabel="Manage Stages"
        actionIcon={Settings2}
        onAction={() => setManaging(true)}
      />

      <div className="flex-1 p-6">
        <section className="grid grid-cols-12 gap-5">
          <div className="col-span-12 space-y-5 lg:col-span-7 xl:col-span-8">
          <div className="rounded-2xl border border-[#E1E4EA] bg-[#FAFAF8] p-6 lg:p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-[#0E121B] flex items-center gap-2">
                  <ListChecks className="text-[#884c2d]" size={20} />
                  Project Roadmap
                </h3>
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-bold text-[#374151]">
                  {stages.length} stages
                </span>
                <span className="rounded-full bg-[#dcfce7] px-2.5 py-1 text-[11px] font-bold text-[#166534]">
                  {stages.filter(s => s.status === 'completed').length}/{stages.length} done
                </span>
              </div>
            </div>

            <div className="relative pl-6 space-y-8 before:absolute before:left-10 before:top-4 before:bottom-4 before:w-0.5 before:bg-[#E1E4EA]">
              {displayPhases.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E1E4EA] bg-white p-10 text-center">
                  <p className="text-sm font-semibold text-[#0E121B]">No stages yet.</p>
                  <p className="mt-1 text-sm text-[#6b7280]">Click &ldquo;Manage Stages&rdquo; to add the steps for this project.</p>
                </div>
              ) : displayPhases.map((phase, index) => {
                const stageData = stages[index] || { status: index < phaseIndex ? 'completed' : index === phaseIndex ? 'in_progress' : 'not_started' };
                const isCompleted = stageData.status === 'completed';
                const isReview = stageData.status === 'review';
                const isActive = stageData.status === 'in_progress' || isReview || (stageData.status === 'not_started' && index === phaseIndex);
                
                const iconBg = isCompleted ? 'bg-[#34d399] border-[#34d399]' : isActive ? 'bg-[#fef3c7] border-[#fbbf24]' : 'bg-white border-[#E1E4EA]';
                const iconColor = isCompleted ? 'text-white' : isActive ? 'text-[#d97706]' : 'text-[#9ca3af]';
                
                const cardBg = isCompleted ? 'bg-[#f0fdf4] border-[#bbf7d0]' : isActive ? 'bg-[#fffbeb] border-[#fde68a]' : 'bg-[#f3f4f6] border-[#e5e7eb]';
                
                function formatDate(dateStr) {
                  if (!dateStr) return null;
                  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }
                
                return (
                  <div key={phase.key || index} className="relative flex items-start gap-6">
                    <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${iconBg} shadow-sm`}>
                      {isCompleted ? <CheckCircle2 size={20} className={iconColor} /> : isActive ? <Zap size={18} className={iconColor} /> : <div className="h-2.5 w-2.5 rounded-full bg-[#d1d5db]" />}
                    </div>
                    
                    <div className={`flex-1 rounded-2xl border p-5 transition-all ${cardBg}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/60 text-[11px] font-bold text-[#525866]">
                          {index + 1}
                        </span>
                        <h4 className="text-base font-bold text-[#0E121B]">{phase.label}</h4>
                      </div>
                      
                      <div className="mb-4">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#166534]">
                            <CheckCircle2 size={12} /> Completed
                          </span>
                        ) : isReview ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7c3aed]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed]" /> In Review
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#d97706]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" /> Currently Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6b7280]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#9ca3af]" /> Upcoming
                          </span>
                        )}
                      </div>
                      
                      {(stageData.startDate || stageData.endDate) && (
                        <div className="flex items-center gap-3 text-[11px] font-bold text-[#6b7280]">
                          {stageData.startDate && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} /> {formatDate(stageData.startDate)}
                            </span>
                          )}
                          {stageData.startDate && stageData.endDate && <span className="text-[#d1d5db]">&gt;</span>}
                          {stageData.endDate && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} /> {formatDate(stageData.endDate)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        <div className="col-span-12 space-y-5 lg:col-span-5 xl:col-span-4">
          <Section
            title="Project Metadata"
          >
            <div className="space-y-5">
              <MetaRow icon={Calendar} label="Start Date" value={project.startDate ? new Date(project.startDate).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—"} />
              <MetaRow icon={Calendar} label="Expected Completion" value={(project.dueDate || project.expectedEndDate || project.expectedCompletion || project.expectedCompletionDate) ? new Date(project.dueDate || project.expectedEndDate || project.expectedCompletion || project.expectedCompletionDate).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : new Date(new Date(project.startDate || Date.now()).getTime() + 45 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })} />
              <MetaRow icon={ListChecks} label="Package Purchased" value={project.packagePurchased || project.packageName} />
              <div className="border-t border-[#E1E4EA] pt-5">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#525866]">
                  <span>Budget Usage</span>
                  <span className="text-[#0E121B]">{formatINR(project.budgetUsed)} / {formatINR(project.budget)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#F1F1F5]">
                  <div className="h-full rounded-full bg-[#884c2d]" style={{ width: `${budgetPct}%` }} />
                </div>
              </div>
            </div>
          </Section>
        </div>
      </section>

      </div>

      {managing && (
        <ManageProjectPanel
          project={project}
          invoices={invoices}
          onClose={() => setManaging(false)}
          onSave={handleSaveProject}
          onDelete={handleDeleteProject}
        />
      )}
    </div>
  );
}
