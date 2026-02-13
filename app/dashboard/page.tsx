"use client";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { EPICS, getEpicProgress, USERS } from "@/lib/mock";
import {
  calculateUtilization,
  calculateUtilizationAggregates,
  downloadKpiCsv,
} from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  LayoutDashboard,
  TrendingUp,
  Users as UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function DashboardPage() {
  const { epics, tasks } = useDataStore();
  const { currentUser } = useAuth();

  // ── Epic KPI filter ────────────────────────────────────────────────────────
  const [kpiEpicFilter, setKpiEpicFilter] = useState("");

  const NOW = new Date("2026-02-10");

  // Filtered tasks for KPI metrics
  const kpiTasks = useMemo(
    () =>
      kpiEpicFilter ? tasks.filter((t) => t.epicId === kpiEpicFilter) : tasks,
    [tasks, kpiEpicFilter],
  );

  // Task metrics
  const openTasks = kpiTasks.filter((t) => t.status !== "Done").length;
  const inProgressTasks = kpiTasks.filter(
    (t) => t.status === "In Progress",
  ).length;
  const reviewTasks = kpiTasks.filter((t) => t.status === "Review").length;
  const doneTasks = kpiTasks.filter((t) => t.status === "Done").length;

  // Health indicators
  const overdueCount = kpiTasks.filter((t) => {
    const due = new Date(t.dueDate);
    return due < NOW && t.status !== "Done";
  }).length;

  const atRiskCount = kpiTasks.filter((t) => {
    return t.status === "In Progress" && t.priority === "High";
  }).length;

  // Utilization summary using shared calculation utility
  // Uses all open tasks (no date range filter) for dashboard overview
  const utilization = useMemo(
    () =>
      calculateUtilization(USERS, tasks, {
        excludeCompleted: true,
        dateRange: "none", // Dashboard shows all open work
      }),
    [tasks],
  );

  const { overCapacity, avgUtilization } = useMemo(
    () => calculateUtilizationAggregates(utilization),
    [utilization],
  );

  // Epic health (for EWS)
  const epicHealth = epics.map((epic) => {
    const epicTasks = kpiTasks.filter((t) => t.epicId === epic.id);
    const progress = getEpicProgress(epic.id);
    const overdue = epicTasks.filter((t) => {
      const due = new Date(t.dueDate);
      return due < NOW && t.status !== "Done";
    }).length;
    return { epic, progress, overdue, taskCount: epicTasks.length };
  });

  const epicsAtRisk = epicHealth.filter(
    (e) => e.overdue > 0 || (e.progress < 30 && e.taskCount > 0),
  );

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs items={[{ label: "Dashboard" }]} />
      </div>

      <div className="flex-1 px-6 py-6 space-y-6 overflow-auto">
        {currentUser &&
        (currentUser.role === "Admin" || currentUser.role === "Manager") ? (
          // ═══════════════════════════════════════════════════════════════════
          // MONITORING DASHBOARD (Admin / Manager)
          // ═══════════════════════════════════════════════════════════════════
          <>
            {/* Page heading */}
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-6 w-6 text-indigo-600" />
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Management Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Monitoring & oversight — track health, utilisation, and key
                  metrics
                </p>
              </div>
            </div>

            {/* ── KPI Cards with Epic filter ──────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Key Metrics
                </h2>
                <div className="flex items-center gap-3">
                  {/* Epic filter for KPI */}
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <select
                      value={kpiEpicFilter}
                      onChange={(e) => setKpiEpicFilter(e.target.value)}
                      className="rounded border border-border bg-white px-2.5 py-1 text-xs text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">All Epics</option>
                      {EPICS.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Export KPI CSV button */}
                  <button
                    onClick={() => downloadKpiCsv(kpiTasks, EPICS)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export KPI CSV
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">Open Tasks</p>
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-blue-600">
                    {openTasks}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {inProgressTasks} in progress
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">In Review</p>
                    <Clock className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-3xl font-bold text-amber-600">
                    {reviewTasks}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Awaiting approval
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold text-green-600">
                    {doneTasks}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doneTasks + openTasks > 0
                      ? Math.round((doneTasks / (doneTasks + openTasks)) * 100)
                      : 0}
                    % completion rate
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">
                      Avg Utilisation
                    </p>
                    <UsersIcon className="h-4 w-4 text-indigo-500" />
                  </div>
                  <p className="text-3xl font-bold text-indigo-600">
                    {avgUtilization}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overCapacity} over capacity
                  </p>
                </div>
              </div>
            </div>

            {/* ── Early Warning System (compact, max 3 rows) ─────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Early Warning System
                  {epicsAtRisk.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                      {epicsAtRisk.length} at risk
                    </span>
                  )}
                </h2>
                <Link
                  href="/epics"
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  View all →
                </Link>
              </div>

              <div className="rounded-lg border border-border bg-white">
                {/* Health summary row */}
                <div className="flex divide-x divide-border border-b border-border">
                  <div className="flex-1 px-4 py-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      Overdue
                    </p>
                    <p
                      className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {overdueCount}
                    </p>
                  </div>
                  <div className="flex-1 px-4 py-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      High Priority
                    </p>
                    <p
                      className={`text-2xl font-bold ${atRiskCount > 0 ? "text-amber-600" : "text-green-600"}`}
                    >
                      {atRiskCount}
                    </p>
                  </div>
                  <div className="flex-1 px-4 py-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      Epics at Risk
                    </p>
                    <p
                      className={`text-2xl font-bold ${epicsAtRisk.length > 0 ? "text-orange-600" : "text-green-600"}`}
                    >
                      {epicsAtRisk.length}
                    </p>
                  </div>
                </div>

                {/* Epic list — max 3, scrollable */}
                {epicsAtRisk.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-muted-foreground">
                      All projects on track
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[168px] overflow-y-auto divide-y divide-border">
                    {epicsAtRisk
                      .slice(0, 3)
                      .map(({ epic, progress, overdue }) => (
                        <Link
                          key={epic.id}
                          href={`/epic/${epic.id}`}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {epic.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {overdue > 0 && `${overdue} overdue`}
                              {overdue > 0 && progress < 30 && " · "}
                              {progress < 30 && `${progress}% progress`}
                            </p>
                          </div>
                          <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 flex-shrink-0">
                            <AlertTriangle className="h-3 w-3" />
                            At Risk
                          </span>
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Resource Utilisation Board ─────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-indigo-500" />
                  Resource Utilisation
                </h2>
                <Link
                  href="/utilization"
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Full report →
                </Link>
              </div>

              <div className="rounded-lg border border-border bg-white overflow-hidden">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-border bg-slate-50">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Team Member
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                          Workload
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Utilisation
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {utilization.map(({ user, totalEstimate, pct }) => {
                        const barColor =
                          pct > 100
                            ? "bg-red-500"
                            : pct >= 80
                              ? "bg-amber-400"
                              : "bg-green-500";
                        const statusLabel =
                          pct > 100
                            ? "Over capacity"
                            : pct >= 80
                              ? "Near capacity"
                              : "Available";
                        const statusColor =
                          pct > 100
                            ? "text-red-600 bg-red-50 border-red-200"
                            : pct >= 80
                              ? "text-amber-600 bg-amber-50 border-amber-200"
                              : "text-green-600 bg-green-50 border-green-200";

                        return (
                          <tr
                            key={user.id}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0"
                                  style={{ backgroundColor: user.avatarColor }}
                                >
                                  {user.initials}
                                </span>
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {user.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {user.role} · {user.weeklyCapacity}h/wk
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell w-40">
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barColor} transition-all`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {totalEstimate}h assigned
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-semibold text-foreground">
                                {pct}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor}`}
                              >
                                {statusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                Quick Actions
              </h2>
              <div className="grid grid-cols-4 gap-3">
                <Link
                  href="/epics"
                  className="rounded-lg border border-border bg-white p-4 hover:shadow-sm hover:border-indigo-300 transition-all"
                >
                  <p className="text-sm font-medium text-foreground">
                    Browse Epics
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {epics.length} total
                  </p>
                </Link>
                <Link
                  href="/my-work"
                  className="rounded-lg border border-border bg-white p-4 hover:shadow-sm hover:border-indigo-300 transition-all"
                >
                  <p className="text-sm font-medium text-foreground">My Work</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your tasks
                  </p>
                </Link>
                <Link
                  href="/board"
                  className="rounded-lg border border-border bg-white p-4 hover:shadow-sm hover:border-indigo-300 transition-all"
                >
                  <p className="text-sm font-medium text-foreground">
                    Board View
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Kanban</p>
                </Link>
                <Link
                  href="/utilization"
                  className="rounded-lg border border-border bg-white p-4 hover:shadow-sm hover:border-indigo-300 transition-all"
                >
                  <p className="text-sm font-medium text-foreground">
                    Utilisation
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Team capacity
                  </p>
                </Link>
              </div>
            </div>
          </>
        ) : (
          // ═══════════════════════════════════════════════════════════════════
          // PERSONAL WORK DASHBOARD (Member / Viewer)
          // ═══════════════════════════════════════════════════════════════════
          <>
            {/* Page heading */}
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-6 w-6 text-indigo-600" />
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  My Work Overview
                </h1>
                <p className="text-sm text-muted-foreground">
                  Track your assigned tasks and progress
                </p>
              </div>
            </div>

            {/* My Task Progress */}
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                My Task Progress
              </h2>
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">
                      Total Assigned
                    </p>
                    <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                  </div>
                  <p className="text-3xl font-bold text-indigo-600">
                    {currentUser
                      ? tasks.filter((t) => t.assignee?.id === currentUser.id)
                          .length
                      : 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All your tasks
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">In Progress</p>
                    <Clock className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-blue-600">
                    {currentUser
                      ? tasks.filter(
                          (t) =>
                            t.assignee?.id === currentUser.id &&
                            t.status === "In Progress",
                        ).length
                      : 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Actively working
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">Overdue</p>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-3xl font-bold text-red-600">
                    {currentUser
                      ? tasks.filter((t) => {
                          const due = new Date(t.dueDate);
                          return (
                            t.assignee?.id === currentUser.id &&
                            due < NOW &&
                            t.status !== "Done"
                          );
                        }).length
                      : 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Need attention
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">At Risk</p>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-3xl font-bold text-amber-600">
                    {currentUser
                      ? tasks.filter(
                          (t) =>
                            t.assignee?.id === currentUser.id &&
                            t.status === "In Progress" &&
                            t.priority === "High",
                        ).length
                      : 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    High priority
                  </p>
                </div>
              </div>
            </div>

            {/* Completion Progress */}
            <div className="rounded-lg border border-border bg-white p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Completion Progress
              </h3>
              {currentUser &&
                (() => {
                  const myTasks = tasks.filter(
                    (t) => t.assignee?.id === currentUser.id,
                  );
                  const myDoneTasks = myTasks.filter(
                    (t) => t.status === "Done",
                  ).length;
                  const myTodoTasks = myTasks.filter(
                    (t) => t.status === "To Do",
                  ).length;
                  const myInProgressTasks = myTasks.filter(
                    (t) => t.status === "In Progress",
                  ).length;
                  const myReviewTasks = myTasks.filter(
                    (t) => t.status === "Review",
                  ).length;
                  const completionPct =
                    myTasks.length > 0
                      ? Math.round((myDoneTasks / myTasks.length) * 100)
                      : 0;

                  return (
                    <>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            Overall Progress
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {completionPct}%
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all"
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center p-3 rounded-lg bg-slate-50">
                          <p className="text-2xl font-bold text-slate-600">
                            {myTodoTasks}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            To Do
                          </p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-blue-50">
                          <p className="text-2xl font-bold text-blue-600">
                            {myInProgressTasks}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            In Progress
                          </p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-amber-50">
                          <p className="text-2xl font-bold text-amber-600">
                            {myReviewTasks}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Review
                          </p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-green-50">
                          <p className="text-2xl font-bold text-green-600">
                            {myDoneTasks}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Done
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
            </div>

            {/* Quick Links */}
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                Quick Actions
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <Link
                  href="/my-work"
                  className="rounded-lg border border-border bg-white p-4 hover:shadow-sm hover:border-indigo-300 transition-all"
                >
                  <p className="text-sm font-medium text-foreground">
                    My Tasks
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    View all tasks
                  </p>
                </Link>
                <Link
                  href="/board"
                  className="rounded-lg border border-border bg-white p-4 hover:shadow-sm hover:border-indigo-300 transition-all"
                >
                  <p className="text-sm font-medium text-foreground">
                    Board View
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Kanban</p>
                </Link>
                <Link
                  href="/epics"
                  className="rounded-lg border border-border bg-white p-4 hover:shadow-sm hover:border-indigo-300 transition-all"
                >
                  <p className="text-sm font-medium text-foreground">
                    My Epics
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assigned projects
                  </p>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
