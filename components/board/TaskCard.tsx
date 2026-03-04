"use client";

import { useDraggable } from "@dnd-kit/core";
import { AvatarChip, UnassignedChip } from "@/components/shared/AvatarChip";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { useDataStore } from "@/contexts/DataStore";
import { Task } from "@/lib/types";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

interface TaskCardProps {
  task: Task;
  canDragDrop: boolean;
}

export function TaskCard({ task, canDragDrop }: TaskCardProps) {
  const { epics } = useDataStore();
  const epic = epics.find((e) => e.id === task.epicId);
  const isOverdue = new Date(task.dueDate) < new Date("2026-02-10");

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !canDragDrop,
  });

  return (
    <div
      ref={setNodeRef}
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
          <span
            className={`flex items-center gap-1 text-xs ${
              isOverdue ? "text-red-500" : "text-muted-foreground"
            }`}
          >
            <CalendarDays className="h-3 w-3" />
            {task.dueDate}
          </span>
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
