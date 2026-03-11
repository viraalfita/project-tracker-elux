"use client";

import { EpicCard } from "@/components/dashboard/EpicCard";
import { EpicFormDialog } from "@/components/epic/EpicFormDialog";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { canManageEpics, isUserInvolvedInEpic } from "@/lib/permissions";
import { Folder, Plus } from "lucide-react";
import { useState } from "react";

export default function EpicsPage() {
  const { epics, tasks } = useDataStore();
  const { currentUser } = useAuth();
  const [showNewEpic, setShowNewEpic] = useState(false);

  // Filter epics based on involvement: Admin sees all; everyone else only sees
  // epics they are owner/watcher/member of, or have a task/subtask assigned.
  const visibleEpics =
    currentUser?.role === "Admin"
      ? epics
      : epics.filter(
          (e) => currentUser && isUserInvolvedInEpic(e, currentUser.id, tasks),
        );

  // Any logged-in user can create an Epic (they become owner + member + watcher)
  const allowNewEpic = canManageEpics(currentUser);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border bg-white px-6 py-4">
        <Breadcrumbs items={[{ label: "Epics" }]} />
      </div>

      <div className="flex-1 px-6 py-6 space-y-6">
        {/* Page heading */}
        <div className="flex items-center gap-3">
          <Folder className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Epics</h1>
            <p className="text-sm text-muted-foreground">
              Browse and manage all epics
            </p>
          </div>
        </div>

        {/* Epics section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              All Epics — {visibleEpics.length}
            </h2>
            <div className="flex items-center gap-3">
              {allowNewEpic && (
                <button
                  onClick={() => setShowNewEpic(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New Epic
                </button>
              )}
            </div>
          </div>

          {visibleEpics.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No epics available.
                {allowNewEpic && " Create one to get started."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleEpics.map((epic) => (
                <EpicCard key={epic.id} epic={epic} />
              ))}
            </div>
          )}
        </div>
      </div>

      <EpicFormDialog
        open={showNewEpic}
        onClose={() => setShowNewEpic(false)}
      />
    </div>
  );
}
