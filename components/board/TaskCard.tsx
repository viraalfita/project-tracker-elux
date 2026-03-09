"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AvatarChip, UnassignedChip } from "@/components/shared/AvatarChip";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { useDataStore } from "@/contexts/DataStore";
import { Task } from "@/lib/types";
import { AlertTriangle, CalendarDays, Clock } from "lucide-react";
import Link from "next/link";

interface TaskCardProps {
  task: Task;
  canDragDrop: boolean;
}

export function TaskCard({ task, canDragDrop }: TaskCardProps) {
  const { epics } = useDataStore();
  const epic = epics.find((e) => e.id === task.epicId);
  const now = new Date();
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate !== null && dueDate < now && task.status !== "Done";
  const isDueSoon =
    !isOverdue &&
    dueDate !== null &&
    dueDate >= now &&
    dueDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) &&
    task.status !== "Done";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !canDragDrop,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group rounded-lg border border-border bg-white p-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all select-none ${
        canDragDrop ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-40" : ""}`}
    >
      {/* Epic tag */}
      {epic && (
        <span className="inline-block mb-2 text-xs text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5 truncate max-w-full">
          {epic.title}
        </span>
      )}

      {/* Title — clickable */}
      <Link
        href={`/task/${task.id}`}
        onClick={(e) => isDragging && e.preventDefault()}
      >
        <p className="text-sm font-medium text-foreground mb-2 leading-snug group-hover:text-indigo-700 transition-colors cursor-pointer">
          {task.title}
        </p>
      </Link>

      {/* Priority + due */}
      <div className="flex items-center justify-between mb-3">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <>
            {isOverdue ? (
              <span className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </span>
            ) : isDueSoon ? (
              <span className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                <Clock className="h-3 w-3" />
                Due soon
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {task.dueDate}
              </span>
            )}
          </>
        )}
      </div>

      {/* Assignee + subtask count */}
      <div className="flex items-center justify-between">
        {task.assignee ? (
          <AvatarChip user={task.assignee} size="sm" showName />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-red-500">
            <UnassignedChip size="sm" />
            Unassigned
          </span>
        )}
        {task.subtasks.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
          </span>
        )}
      </div>
    </div>
  );
}
