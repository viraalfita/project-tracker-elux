"use client";

import { GoalKpi } from "@/lib/types";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface KpiEditDialogProps {
  open: boolean;
  kpi?: GoalKpi | null; // null = new KPI
  onClose: () => void;
  onSave: (data: Omit<GoalKpi, "id">) => void;
}

const DEFAULTS: Omit<GoalKpi, "id"> = {
  label: "",
  target: 100,
  current: 0,
  unit: "",
  greenThreshold: 80,
  yellowThreshold: 50,
};

export function KpiEditDialog({
  open,
  kpi,
  onClose,
  onSave,
}: KpiEditDialogProps) {
  const [form, setForm] = useState<Omit<GoalKpi, "id">>(DEFAULTS);

  useEffect(() => {
    if (open) {
      setForm(
        kpi
          ? {
              label: kpi.label,
              target: kpi.target,
              current: kpi.current,
              unit: kpi.unit,
              greenThreshold: kpi.greenThreshold,
              yellowThreshold: kpi.yellowThreshold,
            }
          : DEFAULTS,
      );
    }
  }, [open, kpi]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  function setField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {kpi ? "Edit KPI" : "Add KPI"}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Name
            </label>
            <input
              type="text"
              required
              value={form.label}
              onChange={(e) => setField("label", e.target.value)}
              placeholder="e.g. Monthly Recurring Revenue"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Target / Current / Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Target
              </label>
              <input
                type="number"
                step="any"
                required
                value={form.target}
                onChange={(e) =>
                  setField("target", parseFloat(e.target.value) || 0)
                }
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Current
              </label>
              <input
                type="number"
                step="any"
                value={form.current}
                onChange={(e) =>
                  setField("current", parseFloat(e.target.value) || 0)
                }
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Unit
              </label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setField("unit", e.target.value)}
                placeholder="USD, %, s…"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Thresholds */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Green ≥ (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.greenThreshold}
                onChange={(e) =>
                  setField("greenThreshold", parseFloat(e.target.value) || 0)
                }
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Yellow ≥ (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.yellowThreshold}
                onChange={(e) =>
                  setField("yellowThreshold", parseFloat(e.target.value) || 0)
                }
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
