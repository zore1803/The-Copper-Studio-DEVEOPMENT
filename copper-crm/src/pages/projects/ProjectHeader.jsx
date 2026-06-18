import { Link } from "react-router-dom";
import { Plus, Share2, Calendar, Clock3, AlertCircle } from "lucide-react";
import { Badge, Button, Avatar } from "../../components/ui";
import Breadcrumb from "../../components/Breadcrumb";

const statusColor = {
  "Requirement Gathering": "gray",
  Design: "purple",
  Development: "orange",
  "In Progress": "teal",
  Review: "blue",
  Completed: "green",
};

const priorityPill = {
  urgent: { label: "Urgent", color: "red", icon: AlertCircle },
  upcoming: { label: "Due Soon", color: "orange", icon: Clock3 },
  "on-track": { label: "On Time", color: "teal", icon: Calendar },
};

function tabsFor(company, project) {
  const base = `/admin/companies/${company.id || company._id}/projects/${project.id || project._id}`;
  return [
    { label: "Overview", to: base },
    { label: "Timeline", to: `${base}/tasks` },
    { label: "Files", to: `${base}/files` },
  ];
}

export default function ProjectHeader({ company, project, activeTab, onShare, onNewTask }) {
  const pill = priorityPill[project.priority] || priorityPill["on-track"];
  const tabs = tabsFor(company, project);
  const team = project.team || project.assignedTeam || [];

  return (
    <>
      <section className="flex flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <Breadcrumb
            items={[
              { label: "Companies", to: "/admin/companies" },
              { label: company.name, to: `/admin/companies/${company.id || company._id}` },
              { label: "Projects", to: `/admin/companies/${company.id || company._id}` },
              { label: project.name, to: null },
            ]}
          />
          <h2 className="text-3xl font-semibold tracking-tight text-[#0E121B]">{project.name}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge color={statusColor[project.status] || "gray"}>{project.status}</Badge>
            <Badge color={pill.color}>
              <pill.icon size={12} className="mr-1 inline" />{pill.label}
            </Badge>
            {team.length > 0 && (
              <div className="ml-1 flex -space-x-2">
                {team.slice(0, 3).map((member, index) => (
                  <div key={index} className="rounded-full ring-2 ring-white">
                    <Avatar name={member} size="sm" />
                  </div>
                ))}
                {team.length > 3 && (
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-[#525866] text-[10px] font-bold text-white ring-2 ring-white">
                    +{team.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap shrink-0 gap-3">
          <Button variant="secondary" size="lg" onClick={onShare}><Share2 size={15} /> Share Project</Button>
          <Button variant="primary" size="lg" onClick={onNewTask}><Plus size={15} /> New Task</Button>
        </div>
      </section>

      <div className="flex gap-7 overflow-x-auto border-b border-[#E1E4EA]">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            to={tab.to}
            className={`whitespace-nowrap pb-3 text-xs font-bold ${
              tab.label === activeTab ? "border-b-2 border-[#C57E5B] text-[#C57E5B]" : "text-[#525866] hover:text-[#111827]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </>
  );
}
