import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../auth/useAuth";
import { clientApi } from "../../lib/clientApi";

/* ─── Shared primitives ─── */

const CS = {
  primary: "var(--cs-primary)",
  primaryContainer: "var(--cs-primary-container)",
  primaryFixed: "var(--cs-primary-fixed)",
  onPrimary: "var(--cs-on-primary)",
  background: "var(--cs-background)",
  surface: "var(--cs-surface)",
  surfaceLowest: "var(--cs-surface-container-lowest)",
  surfaceLow: "var(--cs-surface-container-low)",
  surfaceContainer: "var(--cs-surface-container)",
  outlineVariant: "var(--cs-outline-variant)",
  onSurface: "var(--cs-on-surface)",
  secondary: "var(--cs-secondary)",
  error: "var(--cs-error)",
};

function PageShell({ title, subtitle, children, action }) {
  return (
    <div className="p-4 md:p-6 xl:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: CS.primary, fontFamily: "Inter, sans-serif" }}>{title}</h1>
        {subtitle && <p className="mt-1 text-sm" style={{ color: CS.secondary }}>{subtitle}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border shadow-sm ${className}`}
      style={{ background: CS.surfaceLowest, borderColor: CS.outlineVariant }}>
      {children}
    </div>
  );
}

function Badge({ label, type = "neutral" }) {
  const styles = {
    neutral: { background: CS.surfaceContainer, color: CS.secondary },
    success: { background: "#e8f5e9", color: "#388e3c" },
    warning: { background: "#fff8e1", color: "#f57f17" },
    primary: { background: CS.primaryFixed, color: CS.primary },
    error: { background: "#fde8e8", color: CS.error },
  };
  return (
    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={styles[type] || styles.neutral}>
      {label}
    </span>
  );
}

function CsInput({ label, value, onChange, type = "text", disabled, placeholder, required, wrapperClass = "" }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClass}`}>
      {label && <label className="text-xs font-semibold" style={{ color: CS.secondary, fontFamily: "Inter, sans-serif" }}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none transition-all copper-focus"
        style={{ background: disabled ? CS.surfaceLow : "#fff", borderColor: CS.outlineVariant, color: CS.onSurface, fontFamily: "Inter, sans-serif", opacity: disabled ? 0.7 : 1 }}
      />
    </div>
  );
}

function CsSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold" style={{ color: CS.secondary, fontFamily: "Inter, sans-serif" }}>{label}</label>}
      <select
        value={value}
        onChange={e => onChange?.(e.target.value)}
        className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none transition-all copper-focus"
        style={{ background: "#fff", borderColor: CS.outlineVariant, color: CS.onSurface, fontFamily: "Inter, sans-serif" }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label className="cs-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="cs-toggle-slider" />
    </label>
  );
}

function CsBtn({ children, onClick, type = "button", variant = "primary", disabled, icon, className = "" }) {
  const variants = {
    primary: { background: CS.primary, color: CS.onPrimary, border: "none" },
    secondary: { background: "#fff", color: CS.secondary, border: `1px solid ${CS.outlineVariant}` },
    ghost: { background: "transparent", color: CS.secondary, border: "none" },
    danger: { background: "#fff", color: CS.error, border: `1px solid ${CS.error}` },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95 ${disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"} ${className}`}
      style={{ ...variants[variant], fontFamily: "Inter, sans-serif" }}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      {children}
    </button>
  );
}

function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="material-symbols-outlined text-[48px] mb-3" style={{ color: CS.outlineVariant }}>{icon}</span>
      <p className="text-base font-semibold mb-1" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>{title}</p>
      <p className="text-sm" style={{ color: CS.secondary }}>{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Spinner() {
  return <span className="material-symbols-outlined text-[24px] animate-spin" style={{ color: CS.primary }}>progress_activity</span>;
}

/* ─── PROJECT TIMELINE ─── */

function ClientTaskGantt({ tasks }) {
  const rows = tasks.map((task) => {
    const start = new Date(task.startDate || task.createdAt || Date.now());
    const end = new Date(task.dueDate || task.deadline || task.expectedEndDate || Date.now());
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) || end < start ? safeStart : end;
    return { ...task, safeStart, safeEnd };
  });
  if (!rows.length) return null;
  const min = Math.min(...rows.map((row) => row.safeStart.getTime()));
  const max = Math.max(...rows.map((row) => row.safeEnd.getTime()), min + 86400000);
  const range = Math.max(max - min, 86400000);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-5" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Task Timeline</h3>
      <div className="space-y-3">
        {rows.map((task) => {
          const left = ((task.safeStart.getTime() - min) / range) * 100;
          const width = Math.max(((task.safeEnd.getTime() - task.safeStart.getTime()) / range) * 100, 8);
          const dateRange = `${task.safeStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${task.safeEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
          return (
            <div key={task.id || task._id} className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: CS.onSurface }}>{task.title || task.taskName || "Untitled task"}</p>
                <p className="text-xs" style={{ color: CS.secondary }}>{task.status || "Backlog"}</p>
              </div>
              <div className="relative h-8 rounded-lg" style={{ background: CS.surfaceLow }}>
                <div
                  className="absolute top-1 flex h-6 items-center justify-center rounded-lg px-1.5 text-[10px] font-bold text-white"
                  style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, background: CS.primary }}
                  title={dateRange}
                >
                  <span className="truncate">{dateRange}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function ClientTimelinePage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    clientApi.getProjects(token).then(p => {
      setProjects(p);
      setSelected(p[0] || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!selected?._id) return;
    let alive = true;
    clientApi.getProjectTasks(selected._id, token)
      .then((data) => { if (alive) setTasks(data); })
      .catch(() => { if (alive) setTasks([]); });
    return () => { alive = false; };
  }, [selected, token]);

  const statusBadge = (s) => {
    const map = {
      not_started: { type: "neutral", label: "Not Started" },
      in_progress: { type: "primary", label: "In Progress" },
      on_hold: { type: "warning", label: "On Hold" },
      completed: { type: "success", label: "Completed" },
      cancelled: { type: "error", label: "Cancelled" },
    };
    return map[s] || { type: "neutral", label: s };
  };

  const stageBadge = (s) => {
    if (s === "completed") return { icon: "check_circle", color: "#388e3c" };
    if (s === "in_progress") return { icon: "radio_button_checked", color: CS.primary };
    return { icon: "radio_button_unchecked", color: CS.outlineVariant };
  };

  return (
    <PageShell title="Project Timeline" subtitle="Track every phase of your engagement with The Copper Studio.">
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : projects.length === 0 ? (
        <Card className="py-4">
          <EmptyState icon="timeline" title="No projects yet" description="Your project timeline will appear here once setup is complete." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: project list */}
          <div className="lg:col-span-1 space-y-3">
            {projects.map(p => (
              <button
                key={p._id}
                onClick={() => setSelected(p)}
                className="w-full text-left rounded-xl border p-4 transition-all"
                style={{
                  background: selected?._id === p._id ? CS.surfaceLow : CS.surfaceLowest,
                  borderColor: selected?._id === p._id ? CS.primary : CS.outlineVariant,
                  borderWidth: selected?._id === p._id ? 2 : 1,
                }}
              >
                <p className="font-semibold text-sm mb-1" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>{p.name}</p>
                <p className="text-xs mb-2" style={{ color: CS.secondary }}>{p.packageName || "Package"}</p>
                <div className="flex items-center justify-between mb-2">
                  <Badge {...statusBadge(p.status)} />
                  <span className="text-xs font-bold" style={{ color: CS.primary }}>{p.progress || 0}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: CS.surfaceContainer }}>
                  <div className="h-full rounded-full" style={{ width: `${p.progress || 0}%`, background: CS.primaryContainer }} />
                </div>
              </button>
            ))}
          </div>

          {/* Right: project detail */}
          <div className="lg:col-span-2 space-y-5">
            {selected ? (
              <>
                {/* Overview */}
                <Card className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: CS.secondary }}>Current Project</p>
                      <h2 className="text-2xl font-bold" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>{selected.name}</h2>
                      {selected.description && <p className="text-sm mt-1" style={{ color: CS.secondary }}>{selected.description}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: CS.secondary }}>Expected Completion</p>
                      <p className="font-bold" style={{ color: CS.primary }}>
                        {selected.expectedEndDate
                          ? new Date(selected.expectedEndDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                          : "TBD"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: CS.onSurface }}>
                      Current Phase: <span className="font-semibold" style={{ color: CS.primary }}>{selected.currentPhase || "In Progress"}</span>
                    </span>
                    <span className="font-bold" style={{ color: CS.primary }}>{selected.progress || 0}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden relative" style={{ background: CS.surfaceLow }}>
                    <div className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                      style={{ width: `${selected.progress || 0}%`, background: CS.primaryContainer }}>
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                </Card>

                {/* Admin notes */}
                {selected.adminNotes && (
                  <Card className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: CS.primaryFixed, color: CS.primary }}>
                        <span className="material-symbols-outlined text-[20px]">sticky_note_2</span>
                      </div>
                      <h3 className="font-semibold" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Notes from The Copper Studio</h3>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: CS.secondary }}>{selected.adminNotes}</p>
                    <div className="grid sm:grid-cols-2 gap-4 mt-4 pt-4 border-t" style={{ borderColor: CS.outlineVariant }}>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]" style={{ color: CS.outlineVariant }}>calendar_today</span>
                        <span className="text-sm" style={{ color: CS.onSurface }}>
                          Started:{" "}
                          <span className="font-medium">
                            {selected.startDate ? new Date(selected.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "TBD"}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]" style={{ color: CS.outlineVariant }}>history</span>
                        <span className="text-sm" style={{ color: CS.onSurface }}>
                          Status: <span className="font-medium"><Badge {...statusBadge(selected.status)} /></span>
                        </span>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Stages timeline */}
                {selected.stages?.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-5" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Engagement Roadmap</h3>
                    <div className="relative space-y-5 ml-3">
                      <div className="absolute left-[11px] top-3 bottom-3 w-0.5" style={{ background: CS.outlineVariant }} />
                      {selected.stages.map((stage, i) => {
                        const sb = stageBadge(stage.status);
                        return (
                          <div key={i} className="relative flex gap-5 items-start">
                            <div className={`z-10 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white flex-shrink-0 ${
                              stage.status === "completed" ? "" : stage.status === "in_progress" ? "" : ""
                            }`}
                              style={{
                                background: stage.status === "completed" ? CS.primaryContainer : stage.status === "in_progress" ? CS.primaryFixed : CS.surfaceContainer,
                              }}>
                              <span className="material-symbols-outlined text-[14px]" style={{ color: sb.color }}>
                                {stage.status === "completed" ? "check" : stage.status === "in_progress" ? "radio_button_checked" : "schedule"}
                              </span>
                            </div>
                            <div className="flex-1 pb-1">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                                <h4 className="font-semibold text-sm" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>{stage.name}</h4>
                                {stage.startDate && (
                                  <span className="text-xs" style={{ color: CS.secondary }}>
                                    {new Date(stage.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                              {stage.notes && <p className="text-xs leading-relaxed" style={{ color: CS.secondary }}>{stage.notes}</p>}
                              {stage.status === "in_progress" && (
                                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: CS.primaryFixed, color: CS.primary }}>
                                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                                  In Progress
                                </span>
                              )}
                              {stage.status === "completed" && (
                                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: "#e8f5e9", color: "#388e3c" }}>
                                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                <ClientTaskGantt tasks={tasks} />
              </>
            ) : null}
          </div>
        </div>
      )}
    </PageShell>
  );
}

/* ─── MEETINGS ─── */

const MEETING_TYPES = [
  { value: "discovery_session", label: "Discovery Session" },
  { value: "design_review", label: "Design Review" },
  { value: "technical_sync", label: "Technical Sync" },
  { value: "strategy_review", label: "Strategy Review" },
  { value: "delivery_review", label: "Delivery Review" },
  { value: "support_call", label: "Support Call" },
];

function meetingTypelabel(type) {
  return MEETING_TYPES.find(t => t.value === type)?.label || type;
}

export function ClientMeetingsPage() {
  const { token } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ title: "", type: "discovery_session", preferredDate: "", preferredTime: "", agenda: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi.getMeetings(token).then(m => {
      setMeetings(m);
      setSelected(m.find(x => x.status === "confirmed") || m[0] || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  async function handleRequest(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Meeting title is required."); return; }
    setSubmitting(true);
    setError("");
    try {
      const m = await clientApi.requestMeeting(form, token);
      setMeetings(prev => [m, ...prev]);
      setSelected(m);
      setForm({ title: "", type: "discovery_session", preferredDate: "", preferredTime: "", agenda: "" });
      setSuccess("Meeting request sent! We'll confirm shortly.");
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to request meeting.");
    } finally {
      setSubmitting(false);
    }
  }

  const statusBadge = (s) => {
    const map = {
      requested: { type: "warning", label: "Requested" },
      confirmed: { type: "primary", label: "Confirmed" },
      completed: { type: "success", label: "Completed" },
      cancelled: { type: "neutral", label: "Cancelled" },
    };
    return map[s] || { type: "neutral", label: s };
  };

  return (
    <PageShell title="Meetings" subtitle="Manage your scheduled calls and request new sessions with our team.">
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Past meetings table */}
            {meetings.length > 0 && (
              <Card>
                <div className="px-6 py-4 border-b" style={{ borderColor: CS.outlineVariant }}>
                  <h3 className="font-semibold" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>All Meetings</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: CS.surfaceLow, color: CS.secondary, fontSize: 12, letterSpacing: "0.05em" }}>
                        <th className="px-6 py-3 text-left font-semibold uppercase">Meeting</th>
                        <th className="px-6 py-3 text-left font-semibold uppercase">Type</th>
                        <th className="px-6 py-3 text-left font-semibold uppercase">Date / Time</th>
                        <th className="px-6 py-3 text-left font-semibold uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meetings.map(m => (
                        <tr key={m._id}
                          className="cursor-pointer transition-colors"
                          onClick={() => setSelected(m)}
                          style={{ background: selected?._id === m._id ? CS.surfaceLow : "transparent" }}>
                          <td className="px-6 py-4 text-sm font-medium" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>{m.title}</td>
                          <td className="px-6 py-4 text-sm" style={{ color: CS.secondary }}>{meetingTypelabel(m.type)}</td>
                          <td className="px-6 py-4 text-sm" style={{ color: CS.secondary }}>
                            {m.scheduledAt
                              ? new Date(m.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                              : m.preferredDate
                                ? `Preferred: ${new Date(m.preferredDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                                : "TBD"}
                          </td>
                          <td className="px-6 py-4"><Badge {...statusBadge(m.status)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Request form */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-5" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Request a Meeting</h3>
              <form onSubmit={handleRequest} className="space-y-4">
                <CsInput label="Meeting Title *" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="e.g. Brand strategy review" required />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <CsSelect
                    label="Meeting Type"
                    value={form.type}
                    onChange={v => setForm(f => ({ ...f, type: v }))}
                    options={MEETING_TYPES}
                  />
                  <CsInput label="Preferred Date" type="date" value={form.preferredDate} onChange={v => setForm(f => ({ ...f, preferredDate: v }))} />
                  <CsInput label="Preferred Time" type="time" value={form.preferredTime} onChange={v => setForm(f => ({ ...f, preferredTime: v }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: CS.secondary, fontFamily: "Inter, sans-serif" }}>Message (Optional)</label>
                  <textarea
                    value={form.agenda}
                    onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))}
                    placeholder="Tell us about the meeting goals..."
                    rows={3}
                    className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none resize-none copper-focus"
                    style={{ background: "#fff", borderColor: CS.outlineVariant, color: CS.onSurface, fontFamily: "Inter, sans-serif" }}
                  />
                </div>
                {error && <p className="text-xs font-medium px-3 py-2 rounded-lg" style={{ background: "#fde8e8", color: CS.error }}>{error}</p>}
                {success && <p className="text-xs font-medium px-3 py-2 rounded-lg" style={{ background: "#e8f5e9", color: "#388e3c" }}>{success}</p>}
                <div className="flex justify-end">
                  <CsBtn type="submit" disabled={submitting} icon={submitting ? "progress_activity" : "send"}>
                    {submitting ? "Sending…" : "Request Meeting"}
                  </CsBtn>
                </div>
              </form>
            </Card>
          </div>

          {/* Right: selected meeting detail */}
          <div className="space-y-5">
            {selected ? (
              <Card>
                <div className="px-5 py-4 border-b" style={{ borderColor: CS.outlineVariant, background: `${CS.surfaceLow}80` }}>
                  <h3 className="font-semibold" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>{selected.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: CS.secondary }}>
                    <span className="material-symbols-outlined text-[15px]">schedule</span>
                    {selected.scheduledAt
                      ? new Date(selected.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: true })
                      : "Awaiting confirmation"}
                    {selected.duration ? ` (${selected.duration} mins)` : ""}
                  </div>
                </div>
                <div className="p-5 space-y-5">
                  <div><Badge {...{ requested: { type: "warning", label: "Requested" }, confirmed: { type: "primary", label: "Confirmed" }, completed: { type: "success", label: "Completed" }, cancelled: { type: "neutral", label: "Cancelled" } }[selected.status] || { type: "neutral", label: selected.status }} /></div>

                  {selected.meetingLink && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: CS.secondary }}>Meeting Link</p>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: CS.surfaceContainer }}>
                        <code className="text-xs flex-1 truncate" style={{ color: CS.primary }}>{selected.meetingLink}</code>
                        <button
                          onClick={() => navigator.clipboard.writeText(selected.meetingLink)}
                          className="p-1 rounded transition-colors"
                          style={{ color: CS.primary }}
                          title="Copy link">
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {selected.agenda && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: CS.secondary }}>Agenda / Notes</p>
                      <p className="text-sm leading-relaxed" style={{ color: CS.onSurface }}>{selected.agenda}</p>
                    </div>
                  )}

                  {selected.participants?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-3" style={{ color: CS.secondary }}>Participants</p>
                      <div className="flex flex-wrap gap-2">
                        {selected.participants.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
                            style={{ background: CS.surfaceLow, borderColor: CS.outlineVariant }}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                              style={{ background: CS.primaryFixed, color: CS.primary }}>
                              {p.initials || p.name?.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium" style={{ color: CS.onSurface }}>{p.name}</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
                          style={{ background: CS.surfaceLow, borderColor: CS.outlineVariant }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: CS.primary }}>CS</div>
                          <span className="text-xs font-medium" style={{ color: CS.onSurface }}>Copper Studio</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selected.status === "confirmed" && selected.meetingLink && (
                    <a href={selected.meetingLink} target="_blank" rel="noreferrer"
                      className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all active:scale-95"
                      style={{ background: CS.primary, color: CS.onPrimary }}>
                      <span className="material-symbols-outlined text-[18px]">videocam</span>
                      Join Video Call
                    </a>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-6">
                <EmptyState icon="video_chat" title="Select a meeting" description="Click on a meeting to view its details, or request a new one." />
              </Card>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}

/* ─── DOCUMENTS ─── */

function fileIcon(type) {
  const map = { pdf: "picture_as_pdf", doc: "article", docx: "article", png: "image", jpg: "image", jpeg: "image", xlsx: "table_chart", zip: "folder_zip" };
  return map[type?.toLowerCase()] || "insert_drive_file";
}

function docStatusBadge(s) {
  return {
    pending_review: { type: "warning", label: "Pending Review" },
    approved: { type: "primary", label: "Approved" },
    final_delivery: { type: "success", label: "Final Delivery" },
  }[s] || { type: "neutral", label: s };
}

export function ClientDocumentsPage() {
  const { token } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    clientApi.getDocuments(token).then(setDocs).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const filtered = docs.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || d.status === filter;
    return matchesSearch && matchesFilter;
  });

  const filterOpts = [
    { value: "all", label: "All" },
    { value: "final_delivery", label: "Final Delivery" },
    { value: "approved", label: "Approved" },
    { value: "pending_review", label: "Pending Review" },
  ];

  return (
    <PageShell title="Documents & Deliverables" subtitle="Access all files shared with you by The Copper Studio team.">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: CS.secondary }}>search</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm outline-none copper-focus"
            style={{ background: "#fff", borderColor: CS.outlineVariant, color: CS.onSurface, fontFamily: "Inter, sans-serif" }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filterOpts.map(o => (
            <button key={o.value} onClick={() => setFilter(o.value)}
              className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filter === o.value ? CS.primary : "#fff",
                color: filter === o.value ? CS.onPrimary : CS.secondary,
                border: `1px solid ${filter === o.value ? CS.primary : CS.outlineVariant}`,
              }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon="folder_open" title="No documents" description={search || filter !== "all" ? "No documents match your filter." : "No documents have been shared with you yet."} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <Card key={doc._id} className="p-5 flex flex-col gap-4 transition-all hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: CS.primaryFixed, color: CS.primary }}>
                  <span className="material-symbols-outlined text-[24px]">{fileIcon(doc.fileType)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>{doc.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: CS.secondary }}>
                    {doc.fileType?.toUpperCase()} {doc.fileSize ? `· ${doc.fileSize}` : ""} · v{doc.version || "1.0"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge {...docStatusBadge(doc.status)} />
                <span className="text-xs" style={{ color: CS.secondary }}>
                  {doc.uploadedByName || "Copper Studio"}
                </span>
              </div>
              <div className="pt-3 border-t flex gap-2" style={{ borderColor: CS.outlineVariant }}>
                {doc.fileUrl ? (
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: CS.primary, color: CS.onPrimary }}>
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    Download
                  </a>
                ) : (
                  <button disabled className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold opacity-40 cursor-not-allowed"
                    style={{ background: CS.surfaceContainer, color: CS.secondary }}>
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    Download
                  </button>
                )}
              </div>
              <p className="text-xs" style={{ color: CS.secondary }}>
                Uploaded {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </p>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}

/* ─── BILLING & INVOICES ─── */

export function ClientBillingPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    clientApi.getOrders(token).then(o => {
      setOrders(o);
      setSelectedOrder(o[0] || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const totalPaid = orders.filter(o => o.payment?.status === "paid").reduce((sum, o) => sum + (o.package?.total || 0), 0);

  return (
    <PageShell title="Billing & Invoices" subtitle="View your payment history and download invoices.">
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { icon: "payments", label: "Total Paid", value: `₹${totalPaid.toLocaleString("en-IN")}`, color: CS.primary },
              { icon: "receipt_long", label: "Total Invoices", value: orders.length, color: "#4caf50" },
              { icon: "pending_actions", label: "Pending", value: orders.filter(o => o.payment?.status !== "paid").length, color: "#ff9800" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border p-5 flex items-center gap-4"
                style={{ background: CS.surfaceLowest, borderColor: CS.outlineVariant }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.color + "15" }}>
                  <span className="material-symbols-outlined text-[22px]" style={{ color: s.color }}>{s.icon}</span>
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>{s.value}</p>
                  <p className="text-xs" style={{ color: CS.secondary }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <div className="px-6 py-4 border-b" style={{ borderColor: CS.outlineVariant }}>
                  <h3 className="font-semibold" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Invoice History</h3>
                </div>
                {orders.length === 0 ? (
                  <EmptyState icon="receipt_long" title="No invoices" description="Your invoices will appear here after purchasing a package." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: CS.surfaceLow, color: CS.secondary, fontSize: 12, letterSpacing: "0.05em" }}>
                          <th className="px-6 py-3 text-left font-semibold uppercase">Invoice</th>
                          <th className="px-6 py-3 text-left font-semibold uppercase">Package</th>
                          <th className="px-6 py-3 text-left font-semibold uppercase">Date</th>
                          <th className="px-6 py-3 text-right font-semibold uppercase">Amount</th>
                          <th className="px-6 py-3 text-left font-semibold uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o._id}
                            className="cursor-pointer border-t transition-colors"
                            onClick={() => setSelectedOrder(o)}
                            style={{
                              borderColor: CS.outlineVariant,
                              background: selectedOrder?._id === o._id ? CS.surfaceLow : "transparent",
                            }}>
                            <td className="px-6 py-4 text-sm font-medium" style={{ color: CS.primary, fontFamily: "Inter, sans-serif" }}>
                              #{o.payment?.invoiceId || "—"}
                            </td>
                            <td className="px-6 py-4 text-sm" style={{ color: CS.onSurface }}>{o.package?.name}</td>
                            <td className="px-6 py-4 text-sm" style={{ color: CS.secondary }}>
                              {o.payment?.paidAt
                                ? new Date(o.payment.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                : o.createdAt
                                  ? new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                  : "—"}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: CS.onSurface }}>
                              ₹{(o.package?.total || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-6 py-4">
                              <Badge
                                label={o.payment?.status === "paid" ? "Paid" : o.payment?.status === "failed" ? "Failed" : "Pending"}
                                type={o.payment?.status === "paid" ? "success" : o.payment?.status === "failed" ? "error" : "warning"}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            {/* Invoice detail */}
            <div>
              {selectedOrder ? (
                <Card>
                  <div className="px-5 py-4 border-b" style={{ borderColor: CS.outlineVariant, background: `${CS.surfaceLow}80` }}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>
                        Invoice #{selectedOrder.payment?.invoiceId}
                      </h3>
                      <Badge
                        label={selectedOrder.payment?.status === "paid" ? "Paid" : "Pending"}
                        type={selectedOrder.payment?.status === "paid" ? "success" : "warning"}
                      />
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-3">
                      {[
                        { label: "Package", value: selectedOrder.package?.name },
                        { label: "Amount", value: `₹${(selectedOrder.package?.total || 0).toLocaleString("en-IN")}` },
                        { label: "Provider", value: selectedOrder.payment?.provider || "Razorpay" },
                        { label: "Payment ID", value: selectedOrder.payment?.razorpayPaymentId || "—" },
                        {
                          label: "Date", value: selectedOrder.payment?.paidAt
                            ? new Date(selectedOrder.payment.paidAt).toLocaleDateString("en-IN", { dateStyle: "long" })
                            : "—"
                        },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between items-start gap-2">
                          <span className="text-xs font-semibold" style={{ color: CS.secondary }}>{r.label}</span>
                          <span className="text-xs text-right font-medium max-w-[60%]" style={{ color: CS.onSurface }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                    {selectedOrder.package?.includes?.length > 0 && (
                      <div className="pt-3 border-t" style={{ borderColor: CS.outlineVariant }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: CS.secondary }}>Includes</p>
                        <ul className="space-y-1.5">
                          {selectedOrder.package.includes.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="material-symbols-outlined text-[14px] mt-0.5" style={{ color: CS.primary }}>check_circle</span>
                              <span className="text-xs" style={{ color: CS.onSurface }}>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="p-6">
                  <EmptyState icon="receipt" title="Select an invoice" description="Click an invoice to see its details." />
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

/* ─── SETTINGS ─── */

const TABS = ["Account", "Notifications", "Security"];

export function ClientSettingsPage() {
  const auth = useAuth();
  const token = auth.token;
  const user = auth.user;

  const [tab, setTab] = useState("Account");
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    company: user?.company || "",
    jobTitle: user?.jobTitle || "",
  });
  const [prefs, setPrefs] = useState({
    email: user?.preferences?.notifications?.email ?? true,
    browser: user?.preferences?.notifications?.browser ?? false,
    weeklyReports: user?.preferences?.notifications?.weeklyReports ?? true,
    meetingReminders: user?.preferences?.notifications?.meetingReminders ?? true,
    billingAlerts: user?.preferences?.notifications?.billingAlerts ?? false,
  });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      const updated = await clientApi.updateProfile({
        ...form,
        preferences: { notifications: prefs }
      }, token);
      if (auth.updateUser) auth.updateUser(updated.user);
      setSuccess("Profile updated successfully.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to save.");
    } finally { setSaving(false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { setError("New passwords do not match."); return; }
    setSavingPw(true); setError(""); setSuccess("");
    try {
      await clientApi.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }, token);
      setSuccess("Password updated successfully.");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to change password.");
    } finally { setSavingPw(false); }
  }

  const initials = (user?.name || "U").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <PageShell title="Settings" subtitle="Manage your account preferences, notifications, and portal experience.">
      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6 overflow-x-auto" style={{ borderColor: CS.outlineVariant }}>
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setError(""); setSuccess(""); }}
            className="px-4 pb-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all"
            style={{
              borderColor: tab === t ? CS.primary : "transparent",
              color: tab === t ? CS.primary : CS.secondary,
              fontFamily: "Inter, sans-serif",
            }}>
            {t}
          </button>
        ))}
      </div>

      {success && <p className="text-xs font-medium px-4 py-3 rounded-lg mb-4" style={{ background: "#e8f5e9", color: "#388e3c" }}>{success}</p>}
      {error && <p className="text-xs font-medium px-4 py-3 rounded-lg mb-4" style={{ background: "#fde8e8", color: CS.error }}>{error}</p>}

      <div className="max-w-3xl space-y-5">
        {tab === "Account" && (
          <>
            {/* Profile */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-5" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Profile Settings</h3>
              <form onSubmit={saveProfile} className="space-y-5">
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  {/* Avatar */}
                  <div className="flex flex-col items-center gap-3 flex-shrink-0">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2"
                      style={{ background: CS.primary, borderColor: CS.outlineVariant }}>
                      {initials}
                    </div>
                  </div>
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CsInput label="Full Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
                    <CsInput label="Email Address" value={user?.email || ""} disabled />
                    <CsInput label="Job Title" value={form.jobTitle} onChange={v => setForm(f => ({ ...f, jobTitle: v }))} placeholder="e.g. Marketing Director" />
                    <CsInput label="Phone Number" type="tel" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+91 98765 43210" />
                    <CsInput label="Company" value={form.company} onChange={v => setForm(f => ({ ...f, company: v }))} placeholder="Your company name" wrapperClass="sm:col-span-2" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <CsBtn type="submit" disabled={saving} icon={saving ? "progress_activity" : "save"}>
                    {saving ? "Saving…" : "Save Changes"}
                  </CsBtn>
                </div>
              </form>
            </Card>

            {/* Account Preferences */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-5" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Account Preferences</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CsSelect label="Language" value="en" onChange={() => {}} options={[
                  { value: "en", label: "English - US" },
                  { value: "en-uk", label: "English - UK" },
                  { value: "hi", label: "Hindi" },
                ]} />
                <CsSelect label="Timezone" value="Asia/Kolkata" onChange={() => {}} options={[
                  { value: "Asia/Kolkata", label: "(GMT +5:30) Mumbai, New Delhi" },
                  { value: "UTC", label: "(GMT +0:00) London" },
                  { value: "America/New_York", label: "(GMT -5:00) New York" },
                ]} />
              </div>
            </Card>
          </>
        )}

        {tab === "Notifications" && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-5" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Notification Preferences</h3>
            <div className="space-y-4">
              {[
                { key: "email", label: "Email Notifications", description: "Receive updates via email" },
                { key: "browser", label: "Browser Notifications", description: "Push notifications in browser" },
                { key: "weeklyReports", label: "Weekly Project Reports", description: "Summary email every Monday" },
                { key: "meetingReminders", label: "Meeting Reminders", description: "Reminders 24h before meetings" },
                { key: "billingAlerts", label: "Billing Alerts", description: "Invoice and payment notifications" },
              ].map((item, i) => (
                <div key={item.key} className={`flex items-center justify-between py-3.5 ${i > 0 ? "border-t" : ""}`} style={{ borderColor: CS.outlineVariant + "50" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>{item.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: CS.secondary }}>{item.description}</p>
                  </div>
                  <Toggle checked={prefs[item.key]} onChange={v => setPrefs(p => ({ ...p, [item.key]: v }))} />
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-5 pt-4 border-t" style={{ borderColor: CS.outlineVariant }}>
              <CsBtn onClick={saveProfile} disabled={saving} icon={saving ? "progress_activity" : "save"}>
                {saving ? "Saving…" : "Save Preferences"}
              </CsBtn>
            </div>
          </Card>
        )}

        {tab === "Security" && (
          <>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-5" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Change Password</h3>
              <form onSubmit={changePassword} className="space-y-4">
                <CsInput label="Current Password" type="password" value={pwForm.currentPassword} onChange={v => setPwForm(f => ({ ...f, currentPassword: v }))} required />
                <CsInput label="New Password (min 8 chars)" type="password" value={pwForm.newPassword} onChange={v => setPwForm(f => ({ ...f, newPassword: v }))} required />
                <CsInput label="Confirm New Password" type="password" value={pwForm.confirmPassword} onChange={v => setPwForm(f => ({ ...f, confirmPassword: v }))} required />
                <div className="flex justify-end">
                  <CsBtn type="submit" disabled={savingPw} icon="lock">
                    {savingPw ? "Updating…" : "Update Password"}
                  </CsBtn>
                </div>
              </form>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-1" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Active Sessions</h3>
              <p className="text-sm mb-4" style={{ color: CS.secondary }}>Devices currently logged into your account.</p>
              <div className="rounded-lg p-4 flex items-center gap-4" style={{ background: CS.surfaceLow }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center border"
                  style={{ background: "#fff", borderColor: CS.outlineVariant }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: CS.primary }}>devices</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Current Browser</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: CS.primaryFixed, color: CS.primary }}>Current</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: CS.secondary }}>
                    Last active: Just now · {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : ""}
                  </p>
                </div>
              </div>
            </Card>

            {/* Danger zone */}
            <div className="rounded-xl border p-6" style={{ borderColor: `${CS.error}30`, background: "#fde8e810" }}>
              <h3 className="text-lg font-semibold mb-1" style={{ color: CS.error, fontFamily: "Inter, sans-serif" }}>Danger Zone</h3>
              <p className="text-sm mb-4" style={{ color: CS.secondary }}>
                Deactivating your account will archive all your data and revoke portal access immediately.
              </p>
              <CsBtn variant="danger" icon="warning">Deactivate Account</CsBtn>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

/* ─── Legacy stubs for removed pages ─── */
export function ClientPurchasesPage() {
  return <ClientBillingPage />;
}

export function ClientSupportPage() {
  const { token } = useAuth();
  const [meetings, setMeetings] = useState([]);
  useEffect(() => {
    clientApi.getMeetings(token).catch(() => setMeetings([]));
  }, [token]);

  return (
    <PageShell title="Support" subtitle="Need help? Reach out to The Copper Studio team.">
      <Card className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: CS.primaryFixed, color: CS.primary }}>
            <span className="material-symbols-outlined text-[24px]">support_agent</span>
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: CS.onSurface, fontFamily: "Inter, sans-serif" }}>Get in Touch</h3>
            <p className="text-sm" style={{ color: CS.secondary }}>Our team typically responds within 24 hours.</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { icon: "mail", label: "Email us", value: "studio@coppercrm.in" },
            { icon: "video_chat", label: "Book a call", value: "Use the Meetings section to schedule a support call" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 p-4 rounded-lg" style={{ background: CS.surfaceLow }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: CS.primary }}>{item.icon}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: CS.secondary }}>{item.label}</p>
                <p className="text-sm font-medium" style={{ color: CS.onSurface }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
