"use client";

import { useDataStore } from "@/contexts/DataStore";
import { useToast } from "@/contexts/ToastContext";
import { Epic } from "@/lib/types";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";

interface LinkEpicModalProps {
  open: boolean;
  onClose: () => void;
  goalId: string;
  currentLinkedEpicIds: string[];
}

export function LinkEpicModal({
  open,
  onClose,
  goalId,
  currentLinkedEpicIds,
}: LinkEpicModalProps) {
  const { epics, updateGoalLinkedEpics } = useDataStore();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Sync selection state when modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Set(currentLinkedEpicIds));
    }
  }, [open, currentLinkedEpicIds]);

  function toggleEpic(epicId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  }

  function handleSave() {
    updateGoalLinkedEpics(goalId, Array.from(selected));
    toast("Linked epics updated.");
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <Dialog.Title className="text-base font-semibold text-foreground">
              Link Epics
            </Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="px-6 py-2 max-h-80 overflow-y-auto divide-y divide-border">
            {epics.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No epics available.
              </p>
            ) : (
              epics.map((epic: Epic) => {
                const isChecked = selected.has(epic.id);
                return (
                  <button
                    key={epic.id}
                    type="button"
                    onClick={() => toggleEpic(epic.id)}
                    className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <span
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                        isChecked
                          ? "border-indigo-600 bg-indigo-600"
                          : "border-border bg-white"
                      }`}
                    >
                      {isChecked && (
                        <Check className="h-3 w-3 text-white stroke-[3]" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {epic.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {epic.status}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {selected.size} epic{selected.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
