import { Link } from "react-router-dom";
import { FolderKanban, Calendar, Clock3, AlertCircle, Zap, ListChecks, Settings2, CreditCard, CheckCircle2, ChevronDown } from "lucide-react";
import { Button, Avatar } from "../../components/ui";
import { isRoadmapComplete } from "../../lib/stageProgress";
import { useState } from "react";

const CLIENT_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PHASES = [
  { key: "Requirement Gathering", label: "Requirement", icon: ListChecks },
  { key: "Design", label: "Design", icon: ListChecks },
  { key: "Development", label: "Development", icon: ListChecks },
  { key: "Testing", label: "Testing", icon: ListChecks },
  { key: "Review", label: "Review", icon: ListChecks },
  { key: "Completed", label: "Deployment", icon: CheckCircle2 },
];

function roadmapProgress(stages) {
  if (!stages || !stages.length) return 0;
  let completed = 0;
  for (const s of stages) if (s.status === "completed") completed++;
  return Math.round((completed / stages.length) * 100);
}

function liveProjectStatus(project) {
  const stages = Array.isArray(project.stages) ? project.stages : [];
  if (!stages.length) return project.status || "Not Started";
  if (isRoadmapComplete(stages)) return "Completed";
  const anyStarted = stages.some((s) => s?.status && s.status !== "not_started");
  return anyStarted ? "In Progress" : "Not Started";
}

function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function InfoLine({ label, value }) {
  const displayValue = value === 0 ? "0" : value || "Not added";
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-0.5 break-words text-[#374151]">{displayValue}</p>
    </div>
  );
}

function KpiChip({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#6b7280]">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#6b7280]">{label}</p>
          <p className="mt-0.5 text-base font-bold leading-tight text-[#111827]" title={String(value)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function tabsFor(company, project) {
  const base = `/admin/companies/${company.id || company._id}/projects/${project.id || project._id}`;
  return [
    { label: "Overview", to: base },
    { label: "Timeline", to: `${base}/tasks` },
    { label: "Files", to: `${base}/files` },
  ];
}

export default function ProjectHeader({ company, project, activeTab, actionLabel, actionIcon: ActionIcon, onAction }) {
  const tabs = tabsFor(company, project);
  const team = project.team || project.assignedTeam || [];
  const liveStatus = liveProjectStatus(project);
  
  const stages = Array.isArray(project.stages) ? project.stages : [];
  const displayPhases = stages.map(s => {
    const standardPhase = PHASES.find(p => p.label === s.name || p.key === s.name);
    return { key: s.name, label: s.name, icon: standardPhase ? standardPhase.icon : CheckCircle2 };
  });

  const liveProgress = stages.length ? roadmapProgress(stages) : (project.progress || 0);

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

  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="border-b border-[#e5e7eb] bg-white">
      <div className="px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#fff8f6]">
              <FolderKanban size={24} className="text-[#884c2d]" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold text-[#111827]">{project.name || project.companyName}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6b7280]">
                <span>{company.name}</span>
                {team.length > 0 && (
                  <span className="flex items-center -space-x-2 ml-2">
                    {team.slice(0, 4).map((member, i) => (
                      <span key={i} className="rounded-full ring-2 ring-white" title={member}>
                        <Avatar name={member} size="sm" />
                      </span>
                    ))}
                    {team.length > 4 && (
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#525866] text-[10px] font-bold text-white ring-2 ring-white">
                        +{team.length - 4}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap shrink-0 gap-3">
            {onAction && (
              <Button variant="secondary" onClick={onAction}>
                {ActionIcon && <ActionIcon size={14} className="mr-1.5" />}
                {actionLabel}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-[#f1f1f5] bg-[#fafafa]">
          <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
            <InfoLine label="Package" value={project.packageName || project.package || "Custom"} />
            <InfoLine label="Status" value={liveStatus} />
            <InfoLine label="Progress" value={`${liveProgress}%`} />
            <InfoLine label="Due" value={project.expectedEndDate || project.dueDate || "Not set"} />
            <InfoLine label="Project Manager" value={project.projectManager || project.manager || "Unassigned"} />
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center self-center justify-self-end rounded-full border border-[#e5d3cc] bg-white text-[#884c2d] transition-colors hover:bg-[#fff1ec] sm:col-start-3 lg:col-start-auto"
            >
              <ChevronDown size={18} className={`transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          {detailsOpen && (
            <div className="grid grid-cols-2 gap-4 border-t border-[#f1f1f5] px-4 pb-4 pt-3 sm:grid-cols-3 lg:grid-cols-4">
               <InfoLine label="Priority" value={project.priority || "Medium"} />
               <InfoLine label="Start Date" value={project.startDate || "Not set"} />
               <InfoLine label="Final Amount" value={formatINR(project.finalAmount || project.budget)} />
               <InfoLine label="Client Status" value={CLIENT_STATUSES.find(s => s.value === project.clientStatus)?.label || "In Progress"} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 pb-5 sm:grid-cols-3 lg:grid-cols-5">
        <KpiChip label="Progress" value={`${liveProgress}%`} icon={Zap} />
        <KpiChip label="Current Phase" value={displayPhases[phaseIndex]?.label || project.currentPhase || "—"} icon={ListChecks} />
        <KpiChip label="Final Amount" value={formatINR(project.finalAmount || project.budget)} icon={CreditCard} />
        <KpiChip label="Payment Status" value={project.paymentStatus || "Pending"} icon={AlertCircle} />
        <KpiChip label="Client Status" value={CLIENT_STATUSES.find(s => s.value === project.clientStatus)?.label || "In Progress"} icon={Settings2} />
      </div>

      <div className="overflow-x-auto px-6 pb-5">
        <div className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white p-1">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              to={tab.to}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                tab.label === activeTab ? "bg-[#884c2d] text-white" : "text-[#6b7280] hover:bg-[#f9fafb]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
