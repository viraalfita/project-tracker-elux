"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task, TaskStatus } from "@/lib/types";
import { TaskCard } from "@/components/board/TaskCard";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  canDragDrop: boolean;
}

const columnColors: Record<TaskStatus, string> = {
  "To Do": "bg-slate-50 border-slate-200",
  "In Progress": "bg-blue-50 border-blue-200",
  "Review": "bg-amber-50 border-amber-200",
  "Done": "bg-green-50 border-green-200",
};

const headerColors: Record<TaskStatus, string> = {
  "To Do": "text-slate-700",
  "In Progress": "text-blue-700",
  "Review": "text-amber-700",
  "Done": "text-green-700",
};

export function KanbanColumn({ status, tasks, canDragDrop }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: !canDragDrop,
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border ${columnColors[status]} min-h-[500px] w-full transition-all ${
        isOver && canDragDrop
          ? "ring-2 ring-inset ring-indigo-400 brightness-[0.97]"
          : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-inherit">
        <span className={`text-sm font-semibold ${headerColors[status]}`}>{status}</span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-muted-foreground border border-inherit">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 flex-1">
          {tasks.length === 0 && (
            <div className="flex items-center justify-center flex-1 py-8">
              <p className="text-xs text-muted-foreground">No tasks</p>
            </div>
          )}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} canDragDrop={canDragDrop} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
