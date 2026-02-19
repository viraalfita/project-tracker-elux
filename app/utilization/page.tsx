"use client";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { EPICS, USERS } from "@/lib/mock";
import { Users2 } from "lucide-react";
import { useMemo } from "react";

type WorkloadStatus = "Available" | "Balanced" | "Overloaded";

function getWorkloadStatus(activeTasks: number): WorkloadStatus {
  if (activeTasks < 3) return "Available";
  if (activeTasks <= 5) return "Balanced";
  return "Overloaded";
}

function statusStyle(status: WorkloadStatus) {
  switch (status) {
    case "Available":
      return {
        badge: "bg-green-100 text-green-700 border-green-200",
        dot: "bg-green-500",
      };
    case "Balanced":
      return {
        badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
        dot: "bg-yellow-400",
      };
    case "Overloaded":
      return {
        badge: "bg-red-100 text-red-700 border-red-200",
        dot: "bg-red-500",
      };
  }
}

export default function UtilizationPage() {
  const { tasks } = useDataStore();
  const { currentUser } = useAuth();

  const isAdmin = currentUser?.role === "Admin";

  // Determine visible users based on role
  const visibleUsers = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return USERS;

    // Non-admin: only users in epics the current user can access
    const accessibleEpics = EPICS.filter((e) =>
      e.memberIds.includes(currentUser.id),
    );
    const accessibleMemberIds = new Set(
      accessibleEpics.flatMap((e) => e.memberIds),
    );
    return USERS.filter((u) => accessibleMemberIds.has(u.id));
  }, [currentUser, isAdmin]);

  // Count "In Progress" tasks per user (idle resource metric)
  const workloadData = useMemo(() => {
    return visibleUsers.map((user) => {
      const activeTasks = tasks.filter(
        (t) => t.assignee?.id === user.id && t.status === "In Progress",
      ).length;
      const status = getWorkloadStatus(activeTasks);
      return { user, activeTasks, status };
    });
  }, [visibleUsers, tasks]);

  // Summary counts
  const summary = useMemo(() => {
    const available = workloadData.filter(
      (d) => d.status === "Available",
    ).length;
    const balanced = workloadData.filter((d) => d.status === "Balanced").length;
    const overloaded = workloadData.filter(
      (d) => d.status === "Overloaded",
    ).length;
    return { available, balanced, overloaded };
  }, [workloadData]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Team Workload" },
          ]}
        />
      </div>

      <div className="px-6 py-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Users2 className="h-5 w-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-foreground">Team Workload</h1>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">
              {summary.available}
            </p>
            <p className="text-xs text-green-600 mt-0.5">Available</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-700">
              {summary.balanced}
            </p>
            <p className="text-xs text-yellow-600 mt-0.5">Balanced</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">
              {summary.overloaded}
            </p>
            <p className="text-xs text-red-600 mt-0.5">Overloaded</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="mb-5 rounded-lg bg-indigo-50 border border-indigo-200 p-3">
          <p className="text-sm text-indigo-900">
            <strong>
              Workload = number of &quot;In Progress&quot; tasks assigned to
              each team member.
            </strong>
          </p>
          <p className="text-xs text-indigo-700 mt-1">
            Available: &lt;3 tasks · Balanced: 3–5 tasks · Overloaded: &gt;5
            tasks
            {!isAdmin &&
              " · Showing members from your accessible epics only."}
          </p>
        </div>

        {/* Member workload list */}
        <div className="space-y-3">
          {workloadData.length === 0 ? (
            <div className="rounded-lg border border-border bg-white p-8 text-center text-sm text-muted-foreground">
              No team members to display.
            </div>
          ) : (
            workloadData.map(({ user, activeTasks, status }) => {
              const style = statusStyle(status);
              return (
                <div
                  key={user.id}
                  className="rounded-lg border border-border bg-white p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: user.avatarColor }}
                    >
                      {user.initials}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {user.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.role}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">
                        {activeTasks}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        In Progress
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${style.badge}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                      />
                      {status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Available — fewer than 3 tasks in progress
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
            Balanced — 3 to 5 tasks in progress
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Overloaded — more than 5 tasks in progress
          </div>
        </div>
      </div>
    </div>
  );
}
