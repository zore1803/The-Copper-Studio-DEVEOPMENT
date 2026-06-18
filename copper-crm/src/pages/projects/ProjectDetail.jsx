import { Fragment, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ListChecks, Palette, Code2, FlaskConical, ClipboardCheck, Rocket, Zap,
  UploadCloud, CheckCircle2, MessageSquare, Send, Calendar,
  Settings2, Save,
} from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import SidePanel from "../../components/SidePanel";
import ProjectHeader from "./ProjectHeader";

const PHASES = [
  { key: "Requirement Gathering", label: "Requirement", icon: ListChecks },
  { key: "Design", label: "Design", icon: Palette },
  { key: "Development", label: "Development", icon: Code2 },
  { key: "Testing", label: "Testing", icon: FlaskConical },
  { key: "Review", label: "Review", icon: ClipboardCheck },
  { key: "Completed", label: "Deployment", icon: Rocket },
];

const STAGE_NAMES = ["Requirement Gathering", "Design", "Development", "Testing", "Review", "Delivery"];
const PACKAGE_OPTIONS = ["Starter", "Growth", "Enterprise", "Custom"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const PAYMENT_STATUS_OPTIONS = ["Pending", "Partial", "Paid", "Overdue"];

const CLIENT_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const activityIcon = { upload: UploadCloud, check: CheckCircle2, comment: MessageSquare };
const PHASE_NODE_SIZE = "h-12 w-12 sm:h-14 sm:w-14";
const PHASE_NODE_HEIGHT = "h-12 sm:h-14";

function getPhaseIndex(project) {
  const direct = PHASES.findIndex((phase) => phase.key === (project.currentPhase || project.status));
  if (direct !== -1) return direct;
  if (project.progress >= 95) return 5;
  if (project.progress >= 75) return 4;
  if (project.progress >= 50) return 3;
  if (project.progress >= 25) return 2;
  if (project.progress >= 10) return 1;
  return 0;
}

function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function parseMoney(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function roadmapProgress(stages = []) {
  if (!stages.length) return 0;
  const completed = stages.filter((stage) => stage.status === "completed").length;
  return Math.round((completed / stages.length) * 100);
}

function isRoadmapComplete(stages = []) {
  return stages.length > 0 && stages.every((stage) => stage.status === "completed");
}

function nextPhaseForStages(stages = []) {
  if (isRoadmapComplete(stages)) return "Completed";
  const activeStage = stages.find((stage) => stage.status === "in_progress") || stages.find((stage) => stage.status !== "completed");
  return activeStage?.name || "Requirement Gathering";
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

function InviteCollaborators({ client }) {
  const { showToast } = useToast();
  function handleInvite(event) {
    event.preventDefault();
    const email = event.target.elements.email.value.trim();
    if (!email) return;
    showToast({ title: "Invite sent", message: `${email} can now access this project dashboard.` });
    event.target.reset();
  }
  return (
    <div className="rounded-2xl border border-[#6f381a] bg-[#884c2d] p-6 text-white shadow-[0_18px_40px_rgba(79,39,16,0.06)]">
      <h4 className="font-display mb-2 text-lg font-semibold">Invite Collaborators</h4>
      <p className="mb-4 text-sm text-white/85">Grant the {client} team access to the real-time project dashboard.</p>
      <form onSubmit={handleInvite} className="flex items-center gap-2">
        <input
          name="email"
          type="email"
          placeholder="Email address"
          className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs placeholder:text-white/60 outline-none focus:ring-1 focus:ring-white"
        />
        <button type="submit" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#884c2d] transition-transform hover:scale-105">
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

function ManageProjectPanel({ project, invoices = [], onClose, onSave }) {
  const stages = STAGE_NAMES.map(name => {
    const existing = (project.stages || []).find(s => s.name === name);
    return existing || { name, status: "not_started" };
  });

  const [form, setForm] = useState({
    name: project.name || "",
    packageName: project.packageName || project.packagePurchased || project.package || "",
    customPackageName: "",
    startDate: project.startDate || "",
    expectedEndDate: project.expectedEndDate || project.dueDate || "",
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
    stages,
  });

  const set = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  function cycleStage(name) {
    const order = ["not_started", "in_progress", "completed"];
    setForm(prev => ({
      ...prev,
      ...(() => {
        const nextStages = prev.stages.map(s =>
        s.name === name
          ? { ...s, status: order[(order.indexOf(s.status) + 1) % order.length] }
          : s
        );
        const complete = isRoadmapComplete(nextStages);
        const nextPhase = nextPhaseForStages(nextStages);
        return {
          stages: nextStages,
          progress: roadmapProgress(nextStages),
          currentPhase: nextPhase,
          status: complete ? "Completed" : nextPhase,
          clientStatus: complete ? "completed" : prev.clientStatus === "completed" ? "in_progress" : prev.clientStatus,
        };
      })(),
    }));
  }

  const stageColor = {
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    in_progress: "bg-[#884c2d]/10 text-[#884c2d] border-[#884c2d]/20",
    not_started: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const stageLabel = { completed: "Completed", in_progress: "In Progress", not_started: "Not Started" };
  const finalAmount = Math.max(parseMoney(form.budget) - parseMoney(form.discount), 0);

  return (
    <SidePanel
      title="Manage Project"
      subtitle="Updates are immediately visible to the client in their portal."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}><Save size={14} /> Save & Publish</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <PanelSection title="Basic Details">
          <PanelField span label="Project name" value={form.name} onChange={set("name")} />
          <PanelSelect label="Package purchased" value={form.packageName} onChange={set("packageName")} options={PACKAGE_OPTIONS} />
          {form.packageName === "Custom" && (
            <PanelField label="Custom package name" value={form.customPackageName} onChange={set("customPackageName")} />
          )}
          <PanelSelect label="Priority" value={form.priority} onChange={set("priority")} options={PRIORITY_OPTIONS} />
          <PanelSelect label="Delivery status" value={form.status} onChange={set("status")} options={PHASES.map((phase) => phase.key).concat(["Pending", "Confirmed", "On Hold", "Cancelled"])} />
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
          <PanelSelect label="Linked invoice" value={form.linkedInvoiceId} onChange={set("linkedInvoiceId")}
            options={invoices.map((invoice) => ({ value: String(invoice.id || invoice._id), label: invoice.invoiceNumber || invoice.invoiceId || invoice.id || invoice._id }))} />
          <PanelSelect label="Payment status" value={form.paymentStatus} onChange={set("paymentStatus")} options={PAYMENT_STATUS_OPTIONS} />
        </PanelSection>

        <div>
          <label className="block text-xs font-semibold text-[#374151] mb-2">
            Overall Progress — {form.progress}%
          </label>
          <input
            type="range" min="0" max="100" step="1"
            value={form.progress}
            onChange={e => set("progress")(Number(e.target.value))}
            className="w-full accent-[#884c2d]"
          />
          <div className="mt-1.5 h-1.5 rounded-full bg-[#f3f4f6] overflow-hidden">
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

        <div>
          <label className="block text-xs font-semibold text-[#374151] mb-1.5">Current Phase (Admin Label)</label>
          <select
            value={form.currentPhase}
            onChange={e => set("currentPhase")(e.target.value)}
            className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20"
          >
            {PHASES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#374151] mb-1.5">
            Notes for Client
            <span className="ml-1 font-normal text-[#9ca3af]">(visible in client portal)</span>
          </label>
          <textarea
            value={form.adminNotes}
            onChange={e => set("adminNotes")(e.target.value)}
            placeholder="Share an update or message with the client…"
            rows={4}
            className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#884c2d] focus:ring-2 focus:ring-[#884c2d]/20 resize-none"
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-[#374151] mb-2">Engagement Roadmap Stages</p>
          <p className="text-[11px] text-[#9ca3af] mb-3">Tap a stage to cycle: Not Started → In Progress → Completed</p>
          <div className="space-y-2">
            {form.stages.map(stage => (
              <button
                key={stage.name}
                type="button"
                onClick={() => cycleStage(stage.name)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${stageColor[stage.status]}`}
              >
                <span>{stage.name}</span>
                <span>{stageLabel[stage.status]}</span>
              </button>
            ))}
          </div>
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
  const { records: allProjects, loading: projectsLoading, save: saveProject } = useCrmRecords("projects");
  const { records: invoices } = useCrmRecords("invoices");
  const [managing, setManaging] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState("");

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

  const phaseIndex = getPhaseIndex(project);
  const budgetPct = Math.min(100, Math.round(((project.budgetUsed || 0) / Math.max(project.budget || 1, 1)) * 100));
  const currentCompany = company || { id: companyId, name: project.client || project.company || project.companyName || "Company" };

  function handleShare() {
    navigator.clipboard?.writeText(`${window.location.origin}/admin/companies/${currentCompany.id}/projects/${project.id || project._id}`);
    showToast({ title: "Link copied", message: "Project workspace link copied to clipboard." });
  }

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

  async function handleAddNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    const updatedProject = {
      ...project,
      adminNotes: noteText.trim(),
      activity: [
        { icon: "comment", text: `Admin added a note for the client`, time: "Just now" },
        ...(project.activity || []).slice(0, 9),
      ],
    };
    await saveProject(updatedProject);
    setNoteText("");
    setAddingNote(false);
    showToast({ title: "Note saved", message: "Client can now see this note in their portal." });
  }

  return (
    <div className="space-y-6">
      <ProjectHeader
        company={currentCompany}
        project={project}
        activeTab="Overview"
        onShare={handleShare}
        onNewTask={() => navigate(`/admin/companies/${currentCompany.id}/projects/${project.id || project._id}/tasks`)}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiChip label="Progress" value={`${project.progress || 0}%`} icon={Zap} />
        <KpiChip label="Current Phase" value={PHASES[phaseIndex]?.label || project.currentPhase || "—"} icon={ListChecks} />
        <KpiChip label="Final Amount" value={formatINR(project.finalAmount || project.budget)} icon={ListChecks} />
        <KpiChip label="Payment Status" value={project.paymentStatus || "Pending"} icon={ListChecks} />
        <KpiChip label="Client Status" value={CLIENT_STATUSES.find(s => s.value === project.clientStatus)?.label || "In Progress"} icon={Settings2} />
        <KpiChip label="Activity" value={project.activity?.length || 0} icon={CheckCircle2} />
      </div>

      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 space-y-5 lg:col-span-7 xl:col-span-8">
          <Section
            title="Phase Roadmap"
            action={
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#525866]">
                  <span className="h-2 w-2 rounded-full bg-[#884c2d]" />
                  Current: {PHASES[phaseIndex]?.label || project.currentPhase}
                </span>
                <button
                  onClick={() => setManaging(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#E1E4EA] bg-white px-2.5 py-1 text-xs font-semibold text-[#525866] hover:bg-[#FFFFFF] transition-colors"
                >
                  <Settings2 size={11} /> Update
                </button>
              </div>
            }
          >
            <div className="flex items-center overflow-x-auto pb-1">
              {PHASES.map((phase, index) => {
                const Icon = phase.icon;
                const isDone = index < phaseIndex;
                const isCurrent = index === phaseIndex;
                const isLast = index === PHASES.length - 1;
                return (
                  <Fragment key={phase.key}>
                    <div className={`flex w-16 sm:w-20 shrink-0 flex-col items-center gap-3 text-center ${index > phaseIndex ? "opacity-45" : ""}`}>
                      <div className={`relative flex ${PHASE_NODE_SIZE} items-center justify-center`}>
                        {isCurrent ? (
                          <>
                            <div className={`grid ${PHASE_NODE_SIZE} place-items-center rounded-full border-4 border-[#884c2d] bg-[#FFFFFF] text-xs font-extrabold text-[#884c2d]`}>
                              {project.progress}%
                            </div>
                            <div className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-[#FFFFFF] bg-[#0085FF]">
                              <Zap size={11} className="text-white" />
                            </div>
                          </>
                        ) : (
                          <div className={`grid ${PHASE_NODE_SIZE} place-items-center rounded-full ${isDone ? "bg-[#884c2d] text-white shadow-lg shadow-[#884c2d]/25" : "bg-[#F1F1F5] text-[#525866]"}`}>
                            <Icon size={20} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className={`text-xs sm:text-sm font-bold ${isCurrent ? "text-[#884c2d]" : "text-[#0E121B]"}`}>{phase.label}</p>
                        <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wide ${isCurrent ? "text-[#0085FF]" : "text-[#525866]"}`}>
                          {isDone ? "Completed" : isCurrent ? "Current" : "Upcoming"}
                        </p>
                      </div>
                    </div>
                    {!isLast && (
                      <div className={`flex ${PHASE_NODE_HEIGHT} min-w-[16px] flex-1 items-center`}>
                        <div className={`h-[2px] w-full ${index < phaseIndex ? "bg-[#884c2d]" : "bg-[#F1F1F5]"}`} />
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </Section>

          <div className="grid gap-5 sm:grid-cols-2">
            <Section title="Critical Focus">
              <p className="text-sm text-[#525866]">View and manage this project's tasks as a Kanban board or Gantt timeline. Open a task to set priority and assign team members.</p>
              <button
                type="button"
                onClick={() => navigate(`/admin/companies/${currentCompany.id}/projects/${project.id || project._id}/tasks`)}
                className="mt-4 text-xs font-bold text-[#884c2d] hover:underline"
              >
                Open Project Timeline →
              </button>
            </Section>

            <Section
              title="Note for Client"
              action={
                <button onClick={() => setAddingNote(v => !v)} className="text-[11px] font-bold text-[#884c2d] hover:underline">
                  {addingNote ? "Cancel" : "Edit"}
                </button>
              }
            >
              <div className="flex h-full flex-col justify-between">
                <div>
                  {addingNote ? (
                    <form onSubmit={handleAddNote} className="space-y-2">
                      <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Message to show the client…"
                        rows={3}
                        className="w-full rounded-lg border border-[#E1E4EA] bg-white px-3 py-2 text-xs outline-none focus:border-[#884c2d] focus:ring-1 focus:ring-[#884c2d]/30 resize-none"
                        autoFocus
                      />
                      <button type="submit" className="flex items-center gap-1.5 rounded-lg bg-[#884c2d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6f381a]">
                        <Save size={11} /> Save Note
                      </button>
                    </form>
                  ) : (
                    <p className="text-sm italic leading-5 text-[#0E121B]">
                      &ldquo;{project.adminNotes || "No note for client yet. Click Edit to add one."}&rdquo;
                    </p>
                  )}
                </div>
                {!addingNote && (
                  <Button variant="secondary" className="mt-6 w-full justify-center" onClick={() => navigate(`/admin/companies/${currentCompany.id}/projects/${project.id || project._id}/files`)}>
                    Open Client Workspace
                  </Button>
                )}
              </div>
            </Section>
          </div>
        </div>

        <div className="col-span-12 space-y-5 lg:col-span-5 xl:col-span-4">
          <Section
            title="Project Metadata"
            action={
              <button onClick={() => setManaging(true)} className="flex items-center gap-1 text-xs font-semibold text-[#884c2d] hover:underline">
                <Settings2 size={11} /> Edit
              </button>
            }
          >
            <div className="space-y-5">
              <MetaRow icon={Calendar} label="Start Date" value={project.startDate} />
              <MetaRow icon={Calendar} label="Expected Completion" value={project.dueDate || project.expectedEndDate} />
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

          <Section title="Activity">
            <div className="space-y-5">
              {project.activity?.length ? project.activity.map((item, index) => {
                const Icon = activityIcon[item.icon] || CheckCircle2;
                return (
                  <div key={index} className="flex gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F1F1F5] text-[#525866]">
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-sm text-[#0E121B]">{item.text}</p>
                      <p className="text-[10px] uppercase text-[#9ca3af]">{item.time}</p>
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-[#525866]">No activity recorded yet.</p>}
            </div>
          </Section>

          <InviteCollaborators client={currentCompany.name} />
        </div>
      </section>

      {managing && (
        <ManageProjectPanel
          project={project}
          invoices={invoices}
          onClose={() => setManaging(false)}
          onSave={handleSaveProject}
        />
      )}
    </div>
  );
}
