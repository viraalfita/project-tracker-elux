"use client";

import { GoalFormDialog } from "@/components/goal/GoalFormDialog";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { canManageGoal } from "@/lib/permissions";
import { Epic, Goal, GoalStatus } from "@/lib/types";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const NOW = new Date();
NOW.setHours(0, 0, 0, 0);

function epicIsAtRisk(epic: Epic): boolean {
  if (!epic.endDate || epic.status === "Done") return false;
  return new Date(epic.endDate) < NOW;
}

function deriveGoalStatus(goal: Goal, epics: Epic[]): GoalStatus {
  const linked = epics.filter((e) => goal.linkedEpicIds.includes(e.id));
  if (linked.length === 0) return "On Track";
  if (linked.every((e) => e.status === "Done")) return "Completed";
  const anyAtRisk = linked.some((epic) => epicIsAtRisk(epic));
  return anyAtRisk ? "At Risk" : "On Track";
}

const STATUS_STYLES: Record<GoalStatus, string> = {
  "On Track": "bg-green-100 text-green-700",
  "At Risk": "bg-orange-100 text-orange-700",
  Completed: "bg-indigo-100 text-indigo-700",
};

const STATUS_ICONS: Record<GoalStatus, React.ElementType> = {
  "On Track": TrendingUp,
  "At Risk": AlertTriangle,
  Completed: CheckCircle2,
};

export default function GoalsPage() {
  const { goals, epics, deleteGoal } = useDataStore();
  const { currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);

  if (!currentUser) return null;

  const canManage = canManageGoal(currentUser);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs items={[{ label: "Goals" }]} />
      </div>

      <div className="flex-1 px-6 py-6 space-y-6 overflow-auto">
        {/* Page heading */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Goals</h1>
              <p className="text-sm text-muted-foreground">
                Track strategic objectives and their linked epics
              </p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Goal
            </button>
          )}
        </div>

        {/* Goals list */}
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
            All Goals — {goals.length}
          </h2>

          {goals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-16 text-center">
              <Target className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                No goals defined yet
              </p>
              {canManage ? (
                <p className="text-xs text-muted-foreground">
                  Click &ldquo;New Goal&rdquo; to create your first strategic
                  goal.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Goals will appear here once an Admin creates them.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => {
                const status = deriveGoalStatus(goal, epics);
                const StatusIcon = STATUS_ICONS[status];
                const linkedEpics = epics.filter((e) =>
                  goal.linkedEpicIds.includes(e.id),
                );

                return (
                  <div key={goal.id} className="relative group">
                    <Link
                      href={`/goal/${goal.id}`}
                      className="flex items-start justify-between rounded-lg border border-border bg-white px-5 py-4 hover:shadow-sm hover:border-indigo-200 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {goal.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {goal.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {linkedEpics.length > 0
                            ? `${linkedEpics.length} epic${linkedEpics.length !== 1 ? "s" : ""} linked`
                            : "No epics linked"}
                        </p>
                      </div>
                      <span
                        className={`ml-4 inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status}
                      </span>
                    </Link>
                    {canManage && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setGoalToDelete(goal);
                        }}
                        className="absolute bottom-3 right-5 hidden group-hover:flex items-center justify-center rounded p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete goal"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <GoalFormDialog open={showForm} onClose={() => setShowForm(false)} />

      <ConfirmDialog
        open={!!goalToDelete}
        title="Delete Goal"
        description={`Are you sure you want to delete "${goalToDelete?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (goalToDelete) deleteGoal(goalToDelete.id);
          setGoalToDelete(null);
        }}
        onCancel={() => setGoalToDelete(null)}
      />
    </div>
  );
}
