import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Calendar, ChevronRight, Edit3, Eye, EyeOff,
  LayoutGrid, List, LockKeyhole, Mail, MessageCircle,
  Plus, Save, Search,
  Settings as SettingsIcon, ShieldCheck, SlidersHorizontal, Tag,
  Trash2, UploadCloud, UserPlus, X
} from "lucide-react";
import { Button } from "../../components/ui";
import { useCrmRecords } from "../../hooks/useCrmRecords";
import { useToast } from "../../components/useToast";
import { useAuth } from "../../auth/useAuth";
import { apiGet, apiPost, apiPut } from "../../lib/api";
import SidePanel from "../../components/SidePanel";
import { isEmail, isGstin } from "../../lib/validators";
import { loadCompanyOwners, persistCompanyOwners } from "../../lib/companyOwners";
import { DATA_FIELD_GROUPS, getDataFields, primeDataFields, saveDataFields } from "../../lib/dataFields";

const URL_RE = /^([a-z]+:\/\/)?[^\s.]+\.[^\s]{2,}$/i;

function Card({ children, className = "" }) {
  return <section className={`rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-100/60 ${className}`}>{children}</section>;
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
      />
    </label>
  );
}

const TASK_STAGES = ["Backlog", "To Do", "In Progress", "Review", "Completed", "Blocked"];
const MEETING_STAGES = ["requested", "confirmed", "completed", "cancelled"];
const MEETING_STAGE_LABEL = { requested: "Requested", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" };

function TaskStatusPill({ status = "Accepted" }) {
  const map = {
    Accepted: "bg-blue-50 text-blue-600", High: "bg-red-50 text-red-600", Medium: "bg-yellow-50 text-yellow-600", Low: "bg-gray-100 text-gray-500",
    requested: "bg-amber-50 text-amber-700", confirmed: "bg-blue-50 text-blue-600", completed: "bg-emerald-50 text-emerald-700", cancelled: "bg-gray-100 text-gray-500",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

function meetingWhen(meeting) {
  const raw = meeting.scheduledAt || meeting.preferredDate;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function MeetingCalendarView({ meetings }) {
  const todayDate = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);

  const withDates = useMemo(
    () => meetings.map((meeting) => ({ meeting, when: meetingWhen(meeting) })).filter((m) => m.when),
    [meetings]
  );

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      list.push({ date, meetings: withDates.filter((m) => sameDay(m.when, date)).map((m) => m.meeting) });
    }
    return list;
  }, [cursor, withDates]);

  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const selectedMeetings = selectedDay ? cells.find((c) => c && sameDay(c.date, selectedDay))?.meetings || [] : [];

  return (
    <div className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">← Prev</button>
        <p className="text-sm font-bold text-gray-900">{monthLabel}</p>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">Next →</button>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="grid grid-cols-7 bg-gray-50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
            <div key={label} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, index) => {
            if (!cell) return <div key={`pad-${index}`} className="aspect-square border border-gray-100 bg-gray-50/60" />;
            const isToday = sameDay(cell.date, todayDate);
            return (
              <button
                key={cell.date.toISOString()}
                onClick={() => setSelectedDay(cell.date)}
                className={`aspect-square border border-gray-100 p-1.5 text-left transition-colors hover:bg-blue-50 ${isToday ? "bg-blue-50/60" : "bg-white"}`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${isToday ? "bg-[#2563EB] text-white" : "text-gray-700"}`}>
                  {cell.date.getDate()}
                </span>
                {cell.meetings.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {cell.meetings.slice(0, 3).map((m) => <span key={m.id || m._id} className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />)}
                    {cell.meetings.length > 3 && <span className="text-[9px] font-bold text-[#2563EB]">+{cell.meetings.length - 3}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {selectedDay && (
        <SidePanel
          title={selectedDay.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          subtitle={`${selectedMeetings.length} meeting${selectedMeetings.length === 1 ? "" : "s"} this day.`}
          onClose={() => setSelectedDay(null)}
        >
          {selectedMeetings.length ? (
            <div className="space-y-2">
              {selectedMeetings.map((m) => (
                <div key={m.id || m._id} className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                  <div className="mt-1.5"><TaskStatusPill status={m.status} /></div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">No meetings on this day.</p>
          )}
        </SidePanel>
      )}
    </div>
  );
}

export function TasksPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState("Tasks");
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const { records: taskRecords, save: saveTask, remove: removeTask } = useCrmRecords("tasks");
  const { records: meetingRecords, save: saveMeeting, remove: removeMeeting } = useCrmRecords("meetings");
  const PAGE_SIZE = 10;

  const taskRows = useMemo(() => taskRecords.map((task) => ({
    ...task,
    id: task.id || task.taskId || task._id,
    title: task.title || task.taskName || "",
    relatedTo: task.relatedTo || task.project || task.projectName || "",
    relatedType: task.relatedType || "Project",
    assigned: task.assigned || task.assignedTo || "",
    due: task.due || task.dueDate || "",
    status: task.status || "Backlog",
    priority: task.priority || "Medium",
  })), [taskRecords]);
  const meetingRows = useMemo(() => meetingRecords.map((meeting) => ({
    ...meeting,
    id: meeting.id || meeting.meetingId || meeting._id,
    title: meeting.title || meeting.subject || "",
    type: meeting.type || meeting.channel || "",
    scheduled: meeting.scheduled || meeting.scheduledAt || meeting.preferredDate || "",
    duration: meeting.duration || "",
    status: meeting.status || "requested",
    contact: meeting.contact || meeting.contactName || meeting.participants?.[0]?.name || "",
    contactType: meeting.contactType || meeting.companyName || "",
  })), [meetingRecords]);
  const filteredTasks = taskRows
    .filter((t) => `${t.title} ${t.relatedTo} ${t.status}`.toLowerCase().includes(query.toLowerCase()))
    .filter((t) => statusFilter === "All" || t.status === statusFilter);
  const filteredMeetings = meetingRows
    .filter((m) => `${m.title} ${m.contact}`.toLowerCase().includes(query.toLowerCase()))
    .filter((m) => statusFilter === "All" || m.status === statusFilter);

  const activeRows = tab === "Tasks" ? filteredTasks : filteredMeetings;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const paginated = activeRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusOptions = tab === "Tasks" ? TASK_STAGES : MEETING_STAGES;
  const paginatedTaskIds = paginated.map((t) => t.id);
  const allTasksSelected = paginatedTaskIds.length > 0 && paginatedTaskIds.every((id) => selectedTaskIds.includes(id));

  function toggleSelectAllTasks() {
    setSelectedTaskIds((prev) => (allTasksSelected ? prev.filter((id) => !paginatedTaskIds.includes(id)) : [...new Set([...prev, ...paginatedTaskIds])]));
  }

  function toggleSelectTask(id) {
    setSelectedTaskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function switchTab(t) {
    setTab(t);
    setPage(1);
    setStatusFilter("All");
    setView((v) => (v === "calendar" && t === "Tasks" ? "list" : v));
  }

  async function updateMeetingStatus(meeting, status) {
    setUpdatingId(meeting.id);
    try {
      await saveMeeting({ ...meeting, status });
      showToast({ title: "Meeting updated", message: `${meeting.title || "Meeting"} is now ${status}.` });
    } catch (err) {
      showToast({ type: "error", title: "Could not update meeting", message: err.message });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeleteTask(task) {
    if (!window.confirm(`Delete "${task.title || "this task"}"?`)) return;
    await removeTask(task);
    showToast({ title: "Task deleted" });
  }

  async function handleDeleteMeeting(meeting) {
    if (!window.confirm(`Delete "${meeting.title || "this meeting"}"?`)) return;
    await removeMeeting(meeting);
    showToast({ title: "Meeting deleted" });
  }

  async function handleSaveSelected() {
    if (!selected) return;
    await saveTask(selected);
    showToast({ title: selected._id ? "Task updated" : "Task created" });
    setSelected(null);
  }

  return (
    <div className="p-5 xl:p-6 bg-[#f9fafb] min-h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks &amp; Meetings</h1>
          <p className="text-sm text-gray-500">Manage your Tasks &amp; reminders</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "Tasks" && (
            <button onClick={() => setSelected({ title: "", relatedTo: "", assigned: "", due: "", status: "Backlog", priority: "Medium" })} className="flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-xs font-semibold text-white hover:bg-blue-600">
              <Plus size={14} /> New Activity
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
          <div className="flex gap-1">
            {["Tasks", "Meetings"].map((t) => (
              <button key={t} onClick={() => switchTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t ? "border-b-2 border-[#2563EB] text-[#2563EB] rounded-none pb-1" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-500">
              <Search size={12} />
              <input className="w-44 bg-transparent outline-none placeholder:text-gray-400 text-xs" placeholder={tab === "Tasks" ? "Search by task by title, description, or status..." : "Search by meeting by title, priority, or contact..."} value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
            </div>
            <div className="relative">
              <button onClick={() => setFiltersOpen((v) => !v)} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${statusFilter !== "All" ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                <SlidersHorizontal size={13} />
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                  <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Filter by status</p>
                  {["All", ...statusOptions].map((status) => (
                    <button
                      key={status}
                      onClick={() => { setStatusFilter(status); setPage(1); setFiltersOpen(false); }}
                      className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-xs font-semibold capitalize ${statusFilter === status ? "bg-blue-50 text-[#2563EB]" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setView("list")} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${view === "list" ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}><List size={13} /></button>
            <button onClick={() => setView("kanban")} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${view === "kanban" ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}><LayoutGrid size={13} /></button>
            {tab === "Meetings" && (
              <button onClick={() => setView("calendar")} className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${view === "calendar" ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                <Calendar size={12} /> View in Calendar
              </button>
            )}
          </div>
        </div>

        {view === "calendar" && tab === "Meetings" ? (
          <MeetingCalendarView meetings={filteredMeetings} />
        ) : view === "list" ? (
          <>
            <div className="overflow-x-auto">
              {tab === "Tasks" ? (
                <table className="w-full min-w-[800px]">
                  <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
                    <tr>
                      <th className="w-10 px-4 py-3"><input type="checkbox" checked={allTasksSelected} onChange={toggleSelectAllTasks} className="rounded border-gray-300" /></th>
                      {["Task", "Related To", "Status", "Assigned", "Due Date", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#525866]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((task) => (
                      <tr key={task.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                        <td className="px-4 py-3"><input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => toggleSelectTask(task.id)} className="rounded border-gray-300" /></td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 max-w-[200px] truncate">{task.title}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">{task.relatedTo}</p>
                          <p className="text-[11px] text-gray-400">{task.relatedType}</p>
                        </td>
                        <td className="px-4 py-3"><TaskStatusPill status={task.status} /></td>
                        <td className="px-4 py-3 text-sm text-gray-600">{task.assigned}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{task.due}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setSelected(task)} className="text-gray-400 hover:text-blue-500" title="Edit"><Edit3 size={14} /></button>
                            <button onClick={() => handleDeleteTask(task)} className="text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginated.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">No tasks found</td></tr>}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[800px]">
                  <thead className="bg-[#fff1ec] border-b border-[#f3e5e0]">
                    <tr>
                      {["Meeting", "Scheduled", "Status", "With", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#525866]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((mtg) => (
                      <tr key={mtg.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">{mtg.title}</p>
                          <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{mtg.type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">{mtg.scheduled ? new Date(mtg.scheduled).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No date"}</p>
                          <p className="text-[11px] text-gray-400">{mtg.duration ? `${mtg.duration} mins` : ""}</p>
                        </td>
                        <td className="px-4 py-3"><TaskStatusPill status={mtg.status} /></td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">{mtg.contact}</p>
                          <p className="text-[11px] text-gray-400">{mtg.contactType}</p>
                        </td>
                        <td className="px-4 py-3">
                          {updatingId === mtg.id ? (
                            <span className="text-xs text-gray-400">Updating…</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {mtg.status === "requested" && (
                                <>
                                  <button onClick={() => updateMeetingStatus(mtg, "confirmed")} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700">Accept</button>
                                  <button onClick={() => updateMeetingStatus(mtg, "cancelled")} className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50">Reject</button>
                                </>
                              )}
                              {mtg.status === "confirmed" && (
                                <button onClick={() => updateMeetingStatus(mtg, "completed")} className="rounded-lg bg-[#2563EB] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-600">Mark Done</button>
                              )}
                              <button onClick={() => handleDeleteMeeting(mtg)} className="text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {paginated.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">No meetings found</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <span className="text-xs text-gray-500">Showing {Math.min((page - 1) * PAGE_SIZE + 1, activeRows.length)}–{Math.min(page * PAGE_SIZE, activeRows.length)} of {activeRows.length} {tab}</span>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-xs text-gray-500 disabled:opacity-40 hover:bg-gray-50">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold ${p === page ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{p}</button>
                ))}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-xs text-gray-500 disabled:opacity-40 hover:bg-gray-50">›</button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-5">
            {tab === "Tasks" ? (
              <div className="grid grid-cols-5 gap-4 min-w-[1000px]">
                {TASK_STAGES.map((stage) => {
                  const stageItems = filteredTasks.filter((task) => task.status === stage);
                  return (
                  <div key={stage} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">{stage} <span className="ml-1 text-gray-400">{stageItems.length}</span></span>
                    </div>
                    <div className="space-y-2">
                      {stageItems.map((task) => (
                        <button key={task.id} onClick={() => setSelected(task)} className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm">
                          <p className="text-xs font-bold text-gray-900">{task.title || "Untitled task"}</p>
                          <p className="mt-1 text-[11px] text-gray-400">{task.relatedTo || "No project linked"}</p>
                        </button>
                      ))}
                      {stageItems.length === 0 && <div className="py-6 text-center text-xs text-gray-300">No items</div>}
                    </div>
                  </div>
                );})}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4 min-w-[800px]">
                {MEETING_STAGES.map((stage) => {
                  const stageItems = filteredMeetings.filter((m) => m.status === stage);
                  return (
                  <div key={stage} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">{MEETING_STAGE_LABEL[stage]} <span className="ml-1 text-gray-400">{stageItems.length}</span></span>
                    </div>
                    <div className="space-y-2">
                      {stageItems.map((mtg) => (
                        <div key={mtg.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                          <p className="text-xs font-bold text-gray-900">{mtg.title || "Untitled meeting"}</p>
                          <p className="mt-1 text-[11px] text-gray-400">{mtg.contact || "No contact linked"}</p>
                          {mtg.status === "requested" && (
                            <div className="mt-2 flex gap-1.5">
                              <button onClick={() => updateMeetingStatus(mtg, "confirmed")} className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">Accept</button>
                              <button onClick={() => updateMeetingStatus(mtg, "cancelled")} className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50">Reject</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {stageItems.length === 0 && <div className="py-6 text-center text-xs text-gray-300">No items</div>}
                    </div>
                  </div>
                );})}
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <SidePanel
          title={selected._id ? "Edit task" : "New Task"}
          subtitle="Update task title, related entity, status, and due date."
          onClose={() => setSelected(null)}
          footer={
            <div className="flex justify-between">
              {selected._id ? (
                <button onClick={() => { handleDeleteTask(selected); setSelected(null); }} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={14} /> Delete</button>
              ) : <span />}
              <div className="flex gap-2"><Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={handleSaveSelected}><Save size={14} /> Save</Button></div>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Task title" value={selected.title} onChange={(v) => setSelected(p => ({ ...p, title: v }))} />
            <Field label="Related To" value={selected.relatedTo} onChange={(v) => setSelected(p => ({ ...p, relatedTo: v }))} />
            <Field label="Assigned" value={selected.assigned} onChange={(v) => setSelected(p => ({ ...p, assigned: v }))} />
            <Field label="Due date" value={selected.due} onChange={(v) => setSelected(p => ({ ...p, due: v }))} />
            <Field label="Status" value={selected.status} onChange={(v) => setSelected(p => ({ ...p, status: v }))} />
            <Field label="Priority" value={selected.priority} onChange={(v) => setSelected(p => ({ ...p, priority: v }))} />
          </div>
        </SidePanel>
      )}
    </div>
  );
}

function SettingsField({ label, value, onChange, type = "text", placeholder, error = "", disabled = false, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[#374151]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className={`h-9 w-full rounded-lg border bg-white px-3 text-sm text-[#111827] outline-none transition-all focus:ring-2 disabled:cursor-not-allowed disabled:bg-[#f9fafb] disabled:text-[#9ca3af] ${
          error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-[#e5e7eb] focus:border-[#884c2d] focus:ring-[#884c2d]/20"
        }`}
      />
      {hint && !error && <span className="text-[11px] text-[#9ca3af]">{hint}</span>}
      {error && <span className="text-[11px] font-semibold text-red-500">{error}</span>}
    </div>
  );
}

function SettingsSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b6f63]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#d8c2b9] bg-[#fffdfc] px-4 py-3 text-sm text-[#211a17] outline-none transition-all focus:border-[#884c2d] focus:ring-4 focus:ring-[#f3dfd7]"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function SettingsToggle({ title, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#ead8d1] bg-[#fffdfc] px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-[#211a17]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#6c6355]">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition-colors ${checked ? "bg-[#884c2d]" : "bg-[#d8c2b9]"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}

// Masked-by-default field for values that are credential-shaped (SMTP host,
// gateway API base, etc.) — reveal them deliberately instead of leaving them
// in plain text on screen.
function SettingsSecretField({ label, value, onChange, placeholder, error = "", hint }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b6f63]">{label}</span>
      <div className="relative mt-2">
        <input
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className={`w-full rounded-2xl border bg-[#fffdfc] px-4 py-3 pr-11 text-sm text-[#211a17] outline-none transition-all focus:ring-4 ${
            error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-[#d8c2b9] focus:border-[#884c2d] focus:ring-[#f3dfd7]"
          }`}
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          title={revealed ? "Hide value" : "Reveal value"}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9c8c80] transition-colors hover:text-[#884c2d]"
        >
          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && !error && <span className="mt-1.5 block text-[11px] text-[#9c8c80]">{hint}</span>}
      {error && <span className="mt-1.5 block text-[11px] font-semibold text-red-500">{error}</span>}
    </label>
  );
}

// Re-confirms the signed-in admin's password before unlocking the
// credential-bearing tab — doesn't change anything, just gates access.
function SecurityGate({ onUnlock }) {
  const { token } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password) {
      setError("Enter your password to continue.");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      await apiPost("/api/admin/settings/verify-password", { password }, token);
      onUnlock();
    } catch (err) {
      setError(err.message || "Incorrect password.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f3dfd7] text-[#884c2d]"><LockKeyhole size={22} /></div>
      <h3 className="mt-4 text-lg font-semibold text-[#211a17]">Confirm it's you</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-[#6c6355]">
        This area holds account credentials — your password, SMTP access, and the payment gateway endpoint. Re-enter your password to unlock it.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 w-full max-w-xs space-y-3 text-left">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(event) => { setPassword(event.target.value); setError(""); }}
          placeholder="Current password"
          aria-invalid={Boolean(error)}
          className={`w-full rounded-2xl border bg-[#fffdfc] px-4 py-3 text-sm text-[#211a17] outline-none transition-all focus:ring-4 ${
            error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-[#d8c2b9] focus:border-[#884c2d] focus:ring-[#f3dfd7]"
          }`}
        />
        {error && <p className="text-[11px] font-semibold text-red-500">{error}</p>}
        <Button type="submit" className="w-full justify-center" disabled={verifying}>
          <ShieldCheck size={14} /> {verifying ? "Verifying…" : "Unlock"}
        </Button>
      </form>
    </div>
  );
}

const GENERAL_SECTIONS = [
  { key: "profile", title: "Profile", description: "Your details, mobile number, and password.", icon: UserPlus },
  { key: "triggerTemplate", title: "Trigger Template", description: "Manage email and WhatsApp message templates.", icon: MessageCircle },
  { key: "dataFields", title: "Data Fields", description: "Configure custom data fields used across the CRM.", icon: SlidersHorizontal },
];

const SECURE_SECTIONS = [];

const ALL_SECTIONS = [...GENERAL_SECTIONS, ...SECURE_SECTIONS];

function SettingsSidebarGroup({ label, icon: GroupIcon, sections, activeSection, locked, onSelect }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9c8c80]">
        {GroupIcon && <GroupIcon size={11} />} {label}
      </p>
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          onClick={() => onSelect(section.key)}
          className={`flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-colors ${
            activeSection === section.key ? "bg-[#fff1ec]" : "hover:bg-[#fff8f6]"
          }`}
        >
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
            activeSection === section.key ? "bg-[#f3dfd7] text-[#884c2d]" : "bg-[#f5e6e1] text-[#6c6355]"
          }`}>
            <section.icon size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#211a17]">
              {section.title}
              {locked && <LockKeyhole size={11} className="text-[#9c8c80]" />}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6c6355]">{section.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// Editable chip-list for one configurable option list (industry, lead source…).
function DataFieldList({ label, hint, values, onChange }) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) { setDraft(""); return; }
    onChange([...values, trimmed]);
    setDraft("");
  }

  return (
    <div className="py-4 first:pt-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-[#111827]">{label}</p>
          {hint && <p className="text-xs text-[#6b7280] mt-0.5">{hint}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-bold text-[#6b7280]">{values.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {values.length ? values.map((value) => (
          <span key={value} className="flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-2.5 py-0.5 text-xs font-medium text-[#374151]">
            {value}
            <button type="button" onClick={() => onChange(values.filter((v) => v !== value))} className="ml-0.5 text-[#d1d5db] hover:text-red-400 transition-colors">
              <X size={11} />
            </button>
          </span>
        )) : (
          <span className="text-xs text-[#d1d5db] italic">No options yet</span>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addValue(); } }}
          placeholder="Add option…"
          className="h-8 flex-1 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 text-xs text-[#111827] outline-none transition-all focus:border-[#884c2d] focus:bg-white focus:ring-2 focus:ring-[#884c2d]/20"
        />
        <button type="button" onClick={addValue} className="flex h-8 items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-xs font-semibold text-[#374151] hover:border-[#884c2d] hover:text-[#884c2d] transition-colors">
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

function DataFieldsSection({ onSave, saving }) {
  const { token } = useAuth();
  const [values, setValues] = useState(() => getDataFields());
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(DATA_FIELD_GROUPS[0]?.label);

  useEffect(() => {
    let alive = true;
    primeDataFields(token).then((data) => {
      if (alive && data) setValues(data);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  function setList(key, next) {
    setValues((prev) => ({ ...prev, [key]: next }));
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#9ca3af]">Loading…</div>;
  }

  const currentGroup = DATA_FIELD_GROUPS.find((g) => g.label === activeGroup) || DATA_FIELD_GROUPS[0];

  return (
    <div className="flex min-h-0 flex-1 gap-0 divide-x divide-[#f3f4f6]">
      {/* Left nav — fixed, never scrolls */}
      <nav className="w-44 shrink-0 py-1 pr-4">
        {DATA_FIELD_GROUPS.map((group) => {
          const totalOptions = group.fields.reduce((sum, f) => sum + (values[f.key]?.length || 0), 0);
          const isActive = activeGroup === group.label;
          return (
            <button
              key={group.label}
              onClick={() => setActiveGroup(group.label)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${isActive ? "bg-[#fff1ec] font-semibold text-[#884c2d]" : "text-[#374151] hover:bg-[#f9fafb]"}`}
            >
              <span>{group.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-[#884c2d]/10 text-[#884c2d]" : "bg-[#f3f4f6] text-[#9ca3af]"}`}>{totalOptions}</span>
            </button>
          );
        })}
      </nav>

      {/* Right — scrollable fields panel */}
      <div className="flex min-h-0 flex-1 flex-col pl-6">
        <div className="flex-1 overflow-y-auto">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#9ca3af]">{currentGroup.label}</p>
          <div className="divide-y divide-[#f3f4f6]">
            {currentGroup.fields.map((field) => (
              <DataFieldList
                key={field.key}
                label={field.label}
                hint={field.hint}
                values={values[field.key] || []}
                onChange={(next) => setList(field.key, next)}
              />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 justify-end border-t border-[#f3f4f6] pt-4 mt-4">
          <Button disabled={saving} onClick={() => onSave(values)}><Save size={14} /> {saving ? "Saving…" : "Save Changes"}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Illustrated SVG icons for the Settings launcher ──────────────────────────

function IconProfile() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ig-body" x1="24" y1="28" x2="24" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c97a4e" />
          <stop offset="1" stopColor="#8b4a25" />
        </linearGradient>
        <linearGradient id="ig-face" x1="24" y1="10" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde8d8" />
          <stop offset="1" stopColor="#f5c9a8" />
        </linearGradient>
        <radialGradient id="ig-shine" cx="20" cy="14" r="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.6" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* body / shirt */}
      <path d="M8 46c0-8.837 7.163-16 16-16s16 7.163 16 16H8z" fill="url(#ig-body)" />
      {/* collar white */}
      <path d="M21 30l3 4 3-4-1.5-1.5h-3L21 30z" fill="white" opacity="0.9" />
      {/* head */}
      <circle cx="24" cy="18" r="9" fill="url(#ig-face)" />
      {/* shine on head */}
      <circle cx="20" cy="14" r="4" fill="url(#ig-shine)" />
      {/* eyes */}
      <circle cx="21" cy="17" r="1.2" fill="#6b3a1f" />
      <circle cx="27" cy="17" r="1.2" fill="#6b3a1f" />
      {/* smile */}
      <path d="M21 21.5q3 2.5 6 0" stroke="#8b4a25" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* badge / checkmark ring */}
      <circle cx="36" cy="12" r="5.5" fill="#22c55e" />
      <path d="M33.5 12l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconTemplates() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tg-email" x1="6" y1="14" x2="30" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="tg-chat" x1="18" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* email envelope back */}
      <rect x="5" y="13" width="28" height="20" rx="3" fill="url(#tg-email)" />
      {/* envelope flap */}
      <path d="M5 16l14 10 14-10" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* lines in email body */}
      <rect x="10" y="23" width="12" height="1.5" rx="0.75" fill="#92400e" opacity="0.4" />
      <rect x="10" y="26.5" width="8" height="1.5" rx="0.75" fill="#92400e" opacity="0.4" />
      {/* whatsapp bubble */}
      <path d="M18 22h18a4 4 0 014 4v10a4 4 0 01-4 4H18l-4 4v-4a4 4 0 01-4-4V26a4 4 0 014-4z" fill="url(#tg-chat)" />
      {/* chat dots */}
      <circle cx="26" cy="32" r="1.5" fill="white" />
      <circle cx="31" cy="32" r="1.5" fill="white" />
      <circle cx="36" cy="32" r="1.5" fill="white" />
    </svg>
  );
}

function IconDataFields() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="df-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="df-track" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#c7d2fe" />
          <stop offset="1" stopColor="#a5b4fc" />
        </linearGradient>
      </defs>
      {/* background pill */}
      <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#df-bg)" />
      {/* slider track 1 */}
      <rect x="10" y="14" width="28" height="3" rx="1.5" fill="#c7d2fe" opacity="0.5" />
      <rect x="10" y="14" width="18" height="3" rx="1.5" fill="white" />
      <circle cx="28" cy="15.5" r="4.5" fill="white" stroke="#818cf8" strokeWidth="2" />
      {/* slider track 2 */}
      <rect x="10" y="23" width="28" height="3" rx="1.5" fill="#c7d2fe" opacity="0.5" />
      <rect x="10" y="23" width="10" height="3" rx="1.5" fill="white" />
      <circle cx="20" cy="24.5" r="4.5" fill="white" stroke="#818cf8" strokeWidth="2" />
      {/* slider track 3 */}
      <rect x="10" y="32" width="28" height="3" rx="1.5" fill="#c7d2fe" opacity="0.5" />
      <rect x="10" y="32" width="22" height="3" rx="1.5" fill="white" />
      <circle cx="32" cy="33.5" r="4.5" fill="white" stroke="#818cf8" strokeWidth="2" />
    </svg>
  );
}

function IconPricing() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pr-tag" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb923c" />
          <stop offset="1" stopColor="#c2410c" />
        </linearGradient>
        <linearGradient id="pr-shine" x1="8" y1="8" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.4" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* tag shape */}
      <path d="M6 6h18a2 2 0 011.414.586l16 16a2 2 0 010 2.828l-12 12a2 2 0 01-2.828 0l-16-16A2 2 0 0110 20V8a2 2 0 012-2z" fill="url(#pr-tag)" />
      {/* shine */}
      <path d="M6 6h18a2 2 0 011.414.586l12 12A18 18 0 006 6z" fill="url(#pr-shine)" />
      {/* hole */}
      <circle cx="14" cy="14" r="2.5" fill="white" opacity="0.9" />
      {/* rupee ₹ symbol */}
      <text x="21" y="32" fontSize="16" fontWeight="bold" fill="white" fontFamily="system-ui,sans-serif">₹</text>
      {/* star burst top-right */}
      <path d="M39 5l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#fbbf24" />
    </svg>
  );
}

const SETTINGS_TILES = [
  { key: "profile", title: "Profile", SvgIcon: IconProfile, to: "/admin/settings/profile" },
  { key: "templates", title: "Templates", SvgIcon: IconTemplates, to: "/admin/settings/trigger-template" },
  { key: "dataFields", title: "Data Fields", SvgIcon: IconDataFields, to: "/admin/settings/data-fields" },
  { key: "pricing", title: "Pricing", SvgIcon: IconPricing, to: "/admin/settings/pricing" },
];

// Settings landing: plain icons with a label underneath, like a folder grid.
export function SettingsPage() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col bg-[#F1F1F5]">
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div className="min-w-0">
          <h1 className="text-base font-medium text-[#0E121B]">Settings</h1>
          <p className="mt-0.5 text-xs text-[#525866]">Choose an area to manage.</p>
        </div>
      </div>

      <section className="p-6 xl:p-8">
        <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {SETTINGS_TILES.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={() => navigate(tile.to)}
              className="group flex flex-col items-center gap-2.5 text-center"
            >
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-white shadow-md shadow-gray-200/80 transition-all group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-gray-300/60">
                <tile.SvgIcon />
              </div>
              <span className="text-sm font-semibold text-[#211a17]">{tile.title}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// Shared chrome for a single settings sub-page: a header strip with a back
// button, plus a card body.
function SettingsSubPage({ title, description, icon: Icon, actions, children }) {
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col bg-[#F1F1F5]">
      <div className="flex flex-col gap-4 border-b border-[#E1E4EA] bg-white px-6 py-3 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/settings")}
            title="Back to Settings"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#E1E4EA] text-[#525866] transition-colors hover:bg-[#f9fafb]"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f3dfd7] text-[#884c2d]"><Icon size={17} /></div>
          <div className="min-w-0">
            <h1 className="text-base font-medium text-[#0E121B]">{title}</h1>
            {description && <p className="mt-0.5 truncate text-xs text-[#525866]">{description}</p>}
          </div>
        </div>
        {actions}
      </div>

      <section className="flex flex-1 flex-col overflow-hidden p-5 xl:p-6">
        <Card className="flex flex-1 flex-col overflow-hidden p-6 shadow-[0_18px_40px_rgba(79,39,16,0.06)]">{children}</Card>
      </section>
    </div>
  );
}

// Settings > Profile — the admin's own details and password.
export function SettingsProfilePage() {
  const { showToast } = useToast();
  const { token } = useAuth();
  const [profile, setProfile] = useState({ fullName: "", email: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet("/api/admin/settings", token);
        if (alive) setProfile((prev) => ({ ...prev, ...data.profile }));
      } catch (err) {
        if (alive) showToast({ type: "error", title: "Settings unavailable", message: err.message || "Could not load your profile." });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token, showToast]);

  async function saveProfile() {
    const e = {};
    if (profile.phone && !/^\d{10}$/.test(profile.phone.trim())) e.phone = "Enter a valid 10-digit mobile number.";
    const touched = passwordForm.currentPassword || passwordForm.newPassword || passwordForm.confirmPassword;
    if (touched) {
      if (!passwordForm.currentPassword) e.currentPassword = "Enter your current password.";
      if (passwordForm.newPassword.length < 8) e.newPassword = "Use at least 8 characters.";
      if (passwordForm.newPassword !== passwordForm.confirmPassword) e.confirmPassword = "Passwords do not match.";
    }
    setErrors(e);
    if (Object.keys(e).length) {
      showToast({ type: "error", title: "Check the form", message: "Please fix the highlighted fields." });
      return;
    }

    setSaving(true);
    try {
      await apiPut("/api/client/profile", { name: profile.fullName, phone: profile.phone }, token);
      if (touched) {
        await apiPut("/api/client/change-password", { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }, token);
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
      showToast({ title: "Profile updated", message: "Your changes have been saved successfully." });
    } catch (err) {
      showToast({ type: "error", title: "Couldn't save", message: err.message || "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  const initials = (profile.fullName || "A").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <SettingsSubPage title="Profile" description="Your details and account password." icon={UserPlus}>
      {loading ? (
        <div className="py-16 text-center text-sm text-[#9ca3af]">Loading…</div>
      ) : (
        <div className="flex gap-8">
          {/* Avatar column */}
          <div className="flex shrink-0 flex-col items-center gap-3 pt-1">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f3dfd7] text-xl font-bold text-[#884c2d]">
              {initials}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#111827]">{profile.fullName || "Admin"}</p>
              <p className="text-xs text-[#9ca3af]">Super Admin</p>
            </div>
          </div>

          {/* Form column */}
          <div className="flex-1 min-w-0">
            {/* Personal info */}
            <p className="mb-4 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">Personal Info</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="Full Name" value={profile.fullName} onChange={(v) => setProfile((p) => ({ ...p, fullName: v }))} />
              <SettingsField label="Email Address" type="email" value={profile.email} disabled hint="Contact support to change your login email." />
              <SettingsField label="Mobile Number" type="tel" value={profile.phone} error={errors.phone} onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} hint="Used by WhatsApp message templates." />
              <SettingsField label="Job Title" value={profile.title || ""} onChange={(v) => setProfile((p) => ({ ...p, title: v }))} placeholder="e.g. Founder" />
            </div>

            {/* Password */}
            <div className="mt-6 border-t border-[#f3f4f6] pt-6">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">Change Password</p>
              <p className="mb-4 text-xs text-[#6b7280]">Leave blank to keep your current password.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Current Password" type="password" value={passwordForm.currentPassword} error={errors.currentPassword} onChange={(v) => setPasswordForm((p) => ({ ...p, currentPassword: v }))} />
                <div className="hidden sm:block" />
                <SettingsField label="New Password" type="password" value={passwordForm.newPassword} error={errors.newPassword} onChange={(v) => setPasswordForm((p) => ({ ...p, newPassword: v }))} />
                <SettingsField label="Confirm Password" type="password" value={passwordForm.confirmPassword} error={errors.confirmPassword} onChange={(v) => setPasswordForm((p) => ({ ...p, confirmPassword: v }))} />
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-[#f3f4f6] pt-4">
              <Button disabled={saving} onClick={saveProfile}><Save size={14} /> {saving ? "Saving…" : "Save Changes"}</Button>
            </div>
          </div>
        </div>
      )}
    </SettingsSubPage>
  );
}

// Settings > Trigger Template — links to the email/WhatsApp template editors.
export function SettingsTriggerTemplatePage() {
  const navigate = useNavigate();
  return (
    <SettingsSubPage title="Trigger Template" description="Email and WhatsApp message templates." icon={MessageCircle}>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate("/admin/communication/email-templates")}
          className="flex items-start gap-3 rounded-2xl border border-[#ead8d1] bg-white p-5 text-left transition-colors hover:bg-[#fff8f6]"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f3dfd7] text-[#884c2d]"><Mail size={18} /></div>
          <div>
            <p className="text-sm font-bold text-[#211a17]">Email Templates</p>
            <p className="mt-1 text-xs leading-5 text-[#6c6355]">Create and edit the email templates sent to clients.</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => navigate("/admin/communication/whatsapp-templates")}
          className="flex items-start gap-3 rounded-2xl border border-[#ead8d1] bg-white p-5 text-left transition-colors hover:bg-[#fff8f6]"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f3dfd7] text-[#884c2d]"><MessageCircle size={18} /></div>
          <div>
            <p className="text-sm font-bold text-[#211a17]">WhatsApp Templates</p>
            <p className="mt-1 text-xs leading-5 text-[#6c6355]">Create and edit the WhatsApp message templates.</p>
          </div>
        </button>
      </div>
    </SettingsSubPage>
  );
}

// Settings > Data Fields — configurable dropdown option lists.
export function SettingsDataFieldsPage() {
  const { showToast } = useToast();
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);

  async function handleSave(values) {
    setSaving(true);
    try {
      await saveDataFields(values, token);
      showToast({ title: "Data fields updated", message: "Dropdown options have been saved." });
    } catch (err) {
      showToast({ type: "error", title: "Couldn't save", message: err.message || "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSubPage title="Data Fields" description="Configurable dropdown options across the CRM." icon={SlidersHorizontal}>
      <DataFieldsSection onSave={handleSave} saving={saving} />
    </SettingsSubPage>
  );
}

// Settings > Pricing — package plan details used across pricing, projects,
// coupons and proposals.
export function SettingsPricingPage() {
  return (
    <SettingsSubPage title="Pricing" description="Package plans and their pricing." icon={Tag}>
      <div className="rounded-2xl border border-dashed border-[#d8c2b9] bg-[#fffdfc] px-6 py-12 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f3dfd7] text-[#884c2d]"><Tag size={20} /></div>
        <p className="mt-3 text-sm font-semibold text-[#211a17]">Coming soon</p>
        <p className="mt-1 text-xs text-[#6c6355]">Package plan management (name, price, and inclusions) will live here.</p>
      </div>
    </SettingsSubPage>
  );
}
