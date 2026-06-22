// Structured project code: CS-<4 letters>-<company #>-<MMYY>, e.g. CS-DATC-02-0626.

// First 4 DISTINCT alphabetic letters of the company name, uppercase. Repeats are
// skipped and the next letter from the name is used instead:
// "DATACENTRIC" -> D, A, T, (skip A), C -> "DATC". Padded with X if under 4.
export function companyCodeFromName(name) {
  const letters = String(name || "").toUpperCase().replace(/[^A-Z]/g, "");
  const seen = new Set();
  let code = "";
  for (const ch of letters) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    code += ch;
    if (code.length === 4) break;
  }
  return code.padEnd(4, "X");
}

// 1-based creation-order rank of a project among all OTHER projects for the same
// company (oldest = 1), so each project a company has gets a distinct number.
export function projectNumberOf(company, projects = []) {
  const companyId = String(company?._id || company?.id || "");
  const siblings = projects.filter((p) => String(p.companyId) === companyId);
  const ordered = [...siblings].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return ordered.length + 1;
}

export function generateProjectCode(company, projects = [], date = new Date()) {
  if (!company) return "";
  const d = date instanceof Date ? date : new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const num = String(projectNumberOf(company, projects)).padStart(2, "0");
  return `CS-${companyCodeFromName(company.name)}-${num}-${mm}${yy}`;
}

// Default project name: <Company>-project <project # for that company>-<MMYY>, e.g. "Datacentric-project 2-0626".
export function generateDefaultProjectName(company, projects = [], date = new Date()) {
  if (!company) return "";
  const d = date instanceof Date ? date : new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const num = projectNumberOf(company, projects);
  return `${company.name}-project ${num}-${mm}${yy}`;
}

function addDays(value, days) {
  const base = value ? new Date(value) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export function createDefaultTimeline(startDate) {
  const stages = [
    ["Requirement Gathering", 0, 4],
    ["Design", 5, 12],
    ["Development", 13, 28],
    ["Testing", 29, 35],
    ["Review", 36, 40],
    ["Deployment", 41, 45],
  ];
  return stages.map(([name, startOffset, dueOffset], index) => ({
    id: `milestone-${Date.now()}-${index}`,
    name,
    startDate: addDays(startDate, startOffset),
    dueDate: addDays(startDate, dueOffset),
    status: index === 0 ? "On Track" : "Upcoming",
    owner: "",
    completion: 0,
    clientVisible: true,
  }));
}

export function createStarterTasks(project, company, timeline) {
  return timeline.map((milestone, index) => ({
    id: `task-${Date.now()}-${index}`,
    taskId: `TASK-${String(index + 1).padStart(3, "0")}`,
    title: `${milestone.name} checkpoint`,
    taskName: `${milestone.name} checkpoint`,
    companyId: company._id || company.id,
    company: company.name,
    projectId: project.id,
    projectName: project.name,
    project: project.id,
    assignedTo: Array.isArray(project.assignedTeam) ? project.assignedTeam[0] || "" : "",
    priority: project.priority || "Medium",
    status: index === 0 ? "To Do" : "Backlog",
    startDate: milestone.startDate,
    dueDate: milestone.dueDate,
    estimatedHours: "",
    actualHours: "",
    tags: [milestone.name, ...(project.tags || [])],
    clientVisible: false,
    createdAt: new Date().toISOString(),
  }));
}

export function buildProjectPayload(form, company) {
  const projectId = `project-${Date.now()}`;
  const timeline = createDefaultTimeline(form.startDate);
  const payload = {
    ...form,
    id: projectId,
    projectId: form.projectCode || projectId,
    companyId: company._id || company.id,
    companyName: company.name,
    client: company.name,
    budget: Number(form.budget) || 0,
    packageValue: Number(form.budget) || 0,
    discountApplied: Number(form.discount) || 0,
    finalAmount: Number(form.finalAmount) || Math.max(Number(form.budget || 0) - Number(form.discount || 0), 0),
    linkedInvoiceId: form.linkedInvoiceId,
    budgetUsed: 0,
    progress: Number(form.progress) || 0,
    stages: timeline.map((item) => ({ name: item.name, status: item.status === "On Track" ? "in_progress" : "not_started" })),
    timeline,
    tasksBoard: ["Backlog", "To Do", "In Progress", "Review", "Completed", "Blocked"],
    documents: [],
    customFolders: [],
    activity: [
      { icon: "check", text: "Project workspace created", time: "Just now" },
      { icon: "check", text: "Timeline initialized", time: "Just now" },
      { icon: "check", text: "Tasks board initialized", time: "Just now" },
    ],
    history: [
      { event: "Project Created", createdAt: new Date().toISOString() },
      { event: "Timeline Generated", createdAt: new Date().toISOString() },
      { event: "Tasks Created", createdAt: new Date().toISOString() },
    ],
    createdAt: new Date().toISOString(),
  };
  const starterTasks = createStarterTasks(payload, company, timeline);
  return { payload, starterTasks };
}
