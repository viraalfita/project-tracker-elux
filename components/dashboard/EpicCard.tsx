"use client";

import { EpicFormDialog } from "@/components/epic/EpicFormDialog";
import { AvatarChip } from "@/components/shared/AvatarChip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { useToast } from "@/contexts/ToastContext";
import { getEpicProgress } from "@/lib/mock";
import { canDelete, canEdit } from "@/lib/permissions";
import { Epic } from "@/lib/types";
import { CalendarDays, ChevronRight, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface EpicCardProps {
  epic: Epic;
}

export function EpicCard({ epic }: EpicCardProps) {
  const { deleteEpic, tasks } = useDataStore();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [showEdit, setShowEdit] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Live task counts from the store
  const liveTasks = tasks.filter((t) => t.epicId === epic.id);
  const doneTasks = liveTasks.filter((t) => t.status === "Done").length;
  const progress = getEpicProgress(epic.id);

  const allowEdit = canEdit(currentUser, epic.memberIds);
  const allowDelete = canDelete(currentUser, epic.memberIds);

  function handleDelete() {
    deleteEpic(epic.id);
    toast(`Epic "${epic.title}" deleted.`, "info");
    setShowConfirm(false);
  }

  return (
    <div className="relative group/epiccard">
      <Link href={`/epic/${epic.id}`}>
        <div className="group rounded-lg border border-border bg-white p-5 hover:shadow-sm hover:border-indigo-200 transition-all cursor-pointer">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-foreground truncate group-hover:text-indigo-700 transition-colors">
                  {epic.title}
                </h3>
                <StatusBadge status={epic.status} />
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {epic.description}
              </p>

              <ProgressBar value={progress} className="mb-3" />

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <AvatarChip user={epic.owner} size="sm" showName />
                <span className="flex items-center gap-1">
                  <span className="text-foreground font-medium">
                    {doneTasks}
                  </span>
                  &nbsp;/ {liveTasks.length} tasks done
                </span>
                {epic.endDate && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Due {epic.endDate}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0 group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>
      </Link>

      {/* Action buttons — outside the Link so they don't trigger navigation */}
      {(allowEdit || allowDelete) && (
        <div className="absolute top-3 right-10 hidden group-hover/epiccard:flex items-center gap-1 z-10">
          {allowEdit && (
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-sm"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
          {allowDelete && (
            <button
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors shadow-sm"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
        </div>
      )}

      <EpicFormDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        epic={epic}
      />
      <ConfirmDialog
        open={showConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
        title="Delete epic?"
        description={`"${epic.title}" and all its tasks will be permanently deleted.`}
      />
    </div>
  );
}
