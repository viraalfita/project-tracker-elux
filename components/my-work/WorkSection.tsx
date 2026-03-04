"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useDataStore } from "@/contexts/DataStore";
import { TaskStatus, Task, Subtask } from "@/lib/types";
import { TaskRow, SubtaskRow } from "@/components/my-work/WorkRow";

interface WorkSectionProps {
  status: TaskStatus;
  tasks: Task[];
  subtasks: { subtask: Subtask; parentTaskId: string }[];
  defaultExpanded?: boolean;
}

export function WorkSection({ status, tasks, subtasks, defaultExpanded = true }: WorkSectionProps) {
  const { tasks: allTasks } = useDataStore();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const total = tasks.length + subtasks.length;

  if (total === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 mb-2 w-full text-left group"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold text-foreground">{status}</span>
        <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {total}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 ml-6 mb-4">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
          {subtasks.map(({ subtask, parentTaskId }) => {
            const parent = allTasks.find((t) => t.id === parentTaskId)!;
            return <SubtaskRow key={subtask.id} subtask={subtask} parentTask={parent} />;
          })}
        </div>
      )}
    </div>
  );
}
