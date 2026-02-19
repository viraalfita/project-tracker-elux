"use client";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { getEpicHealthIndicators } from "@/lib/mock";
import { Epic, Goal, GoalStatus } from "@/lib/types";
import { AlertTriangle, CheckCircle2, Target, TrendingUp } from "lucide-react";
import Link from "next/link";

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
  const { goals, epics } = useDataStore();
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs items={[{ label: "Goals" }]} />
      </div>

      <div className="flex-1 px-6 py-6 space-y-6 overflow-auto">
        {/* Page heading */}
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Goals</h1>
            <p className="text-sm text-muted-foreground">
              Track strategic objectives and their linked epics
            </p>
          </div>
        </div>

        {/* Goals list */}
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
            All Goals — {goals.length}
          </h2>

          {goals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">No goals defined.</p>
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
                  <Link
                    key={goal.id}
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
