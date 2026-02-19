"use client";

import { KpiEditDialog } from "@/components/goal/KpiEditDialog";
import { LinkEpicModal } from "@/components/goal/LinkEpicModal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { getEpicHealthIndicators } from "@/lib/mock";
import { canManageGoalLinks } from "@/lib/permissions";
import { Epic, Goal, GoalKpi, GoalStatus } from "@/lib/types";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useState } from "react";

interface GoalPageProps {
  params: Promise<{ goalId: string }>;
}

function deriveGoalStatus(goal: Goal, epics: Epic[]): GoalStatus {
  const linked = epics.filter((e) => goal.linkedEpicIds.includes(e.id));
  if (linked.length === 0) return "On Track";
  if (linked.every((e) => e.status === "Done")) return "Completed";
  const anyAtRisk = linked.some((epic) => {
    const { overdueCount, atRiskCount } = getEpicHealthIndicators(epic.id);
    return overdueCount > 0 || atRiskCount > 0;
  });
  return anyAtRisk ? "At Risk" : "On Track";
}

function getEpicHealth(epic: Epic): "At Risk" | "On Track" {
  const { overdueCount, atRiskCount } = getEpicHealthIndicators(epic.id);
  return overdueCount > 0 || atRiskCount > 0 ? "At Risk" : "On Track";
}

const GOAL_STATUS_STYLES: Record<GoalStatus, string> = {
  "On Track": "bg-green-100 text-green-700",
  "At Risk": "bg-orange-100 text-orange-700",
  Completed: "bg-indigo-100 text-indigo-700",
};

const GOAL_STATUS_ICONS: Record<GoalStatus, React.ElementType> = {
  "On Track": TrendingUp,
  "At Risk": AlertTriangle,
  Completed: CheckCircle2,
};

export default function GoalPage({ params }: GoalPageProps) {
  const { goalId } = use(params);
  const {
    goals,
    epics,
    addGoalKpi,
    updateGoalKpi,
    deleteGoalKpi,
    updateGoalLinkedEpics,
  } = useDataStore();
  const { currentUser } = useAuth();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [kpiDialog, setKpiDialog] = useState<{
    open: boolean;
    kpi?: GoalKpi | null;
  }>({ open: false, kpi: null });

  const goal = goals.find((g) => g.id === goalId);
  if (!goal) notFound();

  const canManage = canManageGoalLinks(currentUser);
  const goalStatus = deriveGoalStatus(goal, epics);
  const GoalStatusIcon = GOAL_STATUS_ICONS[goalStatus];
  const linkedEpics = epics.filter((e) => goal.linkedEpicIds.includes(e.id));

  function handleUnlink(epicId: string) {
    if (!goal) return;
    updateGoalLinkedEpics(
      goal.id,
      goal.linkedEpicIds.filter((id) => id !== epicId),
    );
  }

  function getKpiStatus(kpi: GoalKpi): "On Track" | "At Risk" | "Off Track" {
    if (kpi.target === 0) return "On Track";
    const pct = (kpi.current / kpi.target) * 100;
    if (pct >= kpi.greenThreshold) return "On Track";
    if (pct >= kpi.yellowThreshold) return "At Risk";
    return "Off Track";
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs
          items={[{ label: "Goals", href: "/goals" }, { label: goal.title }]}
        />
      </div>

      <div className="flex-1 px-6 py-6 space-y-6 overflow-auto">
        {/* ── Goal Header ─────────────────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Target className="h-6 w-6 text-indigo-600 flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground">
                  {goal.title}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {goal.description}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${GOAL_STATUS_STYLES[goalStatus]}`}
            >
              <GoalStatusIcon className="h-3.5 w-3.5" />
              {goalStatus}
            </span>
          </div>

          {/* Owner */}
          <div className="mt-4 flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: goal.owner.avatarColor }}
            >
              {goal.owner.initials}
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Owner</p>
              <p className="text-sm font-medium text-foreground">
                {goal.owner.name}
              </p>
            </div>
          </div>
        </div>

        {/* ── KPIs ────────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              KPIs
              {goal.kpis.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {goal.kpis.length}
                </span>
              )}
            </h2>
            {canManage && (
              <button
                onClick={() => setKpiDialog({ open: true, kpi: null })}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add KPI
              </button>
            )}
          </div>

          <div className="rounded-lg border border-border bg-white overflow-hidden">
            {goal.kpis.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <Target className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No KPIs defined yet
                </p>
                {canManage && (
                  <button
                    onClick={() => setKpiDialog({ open: true, kpi: null })}
                    className="mt-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Add a KPI →
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left">Name</th>
                    <th className="px-4 py-2.5 text-right">Target</th>
                    <th className="px-4 py-2.5 text-right">Current</th>
                    <th className="px-4 py-2.5 text-right">Delta</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    {canManage && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {goal.kpis.map((kpi) => {
                    const delta = kpi.current - kpi.target;
                    const status = getKpiStatus(kpi);
                    const statusStyle =
                      status === "On Track"
                        ? "bg-green-100 text-green-700"
                        : status === "At Risk"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-red-100 text-red-600";
                    return (
                      <tr
                        key={kpi.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          {kpi.label}
                          {kpi.unit && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({kpi.unit})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {kpi.target.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {kpi.current.toLocaleString()}
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums font-medium ${
                            delta >= 0 ? "text-green-600" : "text-red-500"
                          }`}
                        >
                          {delta >= 0 ? "+" : ""}
                          {delta.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}
                          >
                            {status}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() =>
                                  setKpiDialog({ open: true, kpi })
                                }
                                title="Edit KPI"
                                className="rounded p-1 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => deleteGoalKpi(goal.id, kpi.id)}
                                title="Delete KPI"
                                className="rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Linked Epics ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Linked Epics
              {linkedEpics.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {linkedEpics.length}
                </span>
              )}
            </h2>
            {canManage && (
              <button
                onClick={() => setShowLinkModal(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Link2 className="h-3.5 w-3.5" />
                Link Epic
              </button>
            )}
          </div>

          <div className="rounded-lg border border-border bg-white overflow-hidden">
            {linkedEpics.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Link2 className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No epics linked yet
                </p>
                {canManage && (
                  <button
                    onClick={() => setShowLinkModal(true)}
                    className="mt-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Link an epic →
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {linkedEpics.map((epic) => {
                  const health = getEpicHealth(epic);
                  return (
                    <div
                      key={epic.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      {/* Epic link */}
                      <Link
                        href={`/epic/${epic.id}`}
                        className="flex-1 min-w-0 flex items-center gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground group-hover:text-indigo-600 transition-colors truncate">
                            {epic.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusBadge status={epic.status} />
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              health === "At Risk"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {health === "At Risk" ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <TrendingUp className="h-3 w-3" />
                            )}
                            {health}
                          </span>
                        </div>
                      </Link>

                      {/* Remove button (Admin/Member only) */}
                      {canManage && (
                        <button
                          onClick={() => handleUnlink(epic.id)}
                          title="Remove linked epic"
                          className="ml-1 rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <LinkEpicModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        goalId={goal.id}
        currentLinkedEpicIds={goal.linkedEpicIds}
      />

      <KpiEditDialog
        open={kpiDialog.open}
        kpi={kpiDialog.kpi}
        onClose={() => setKpiDialog({ open: false, kpi: null })}
        onSave={(data) => {
          if (kpiDialog.kpi) {
            updateGoalKpi(goal.id, kpiDialog.kpi.id, data);
          } else {
            addGoalKpi(goal.id, data);
          }
          setKpiDialog({ open: false, kpi: null });
        }}
      />
    </div>
  );
}
