"use client";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { useToast } from "@/contexts/ToastContext";
import { isEpicMember } from "@/lib/permissions";
import { Epic } from "@/lib/types";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface EpicDocsTabProps {
  epicId: string;
  epic: Epic;
}

export function EpicDocsTab({ epicId, epic }: EpicDocsTabProps) {
  const { epicDocs, createEpicDoc, updateEpicDoc, deleteEpicDoc } =
    useDataStore();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const docs = epicDocs.filter((d) => d.epicId === epicId);
  const canEdit = !!currentUser && isEpicMember(currentUser, epic);

  const [activeDocId, setActiveDocId] = useState<string | null>(
    docs[0]?.id ?? null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");

  const activeDoc = docs.find((d) => d.id === activeDocId) ?? docs[0] ?? null;

  function handleStartCreate() {
    setIsCreating(true);
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
  }

  function handleStartEdit(docId: string) {
    const doc = docs.find((d) => d.id === docId);
    if (!doc) return;
    setEditingId(docId);
    setIsCreating(false);
    setFormTitle(doc.title);
    setFormContent(doc.content);
  }

  function handleCancelForm() {
    setIsCreating(false);
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
  }

  function handleSaveCreate() {
    if (!formTitle.trim() || !currentUser) return;
    const doc = createEpicDoc(
      epicId,
      formTitle.trim(),
      formContent.trim(),
      currentUser,
    );
    toast(`Doc "${formTitle.trim()}" created.`);
    setActiveDocId(doc.id);
    handleCancelForm();
  }

  function handleSaveEdit() {
    if (!editingId || !formTitle.trim()) return;
    updateEpicDoc(editingId, {
      title: formTitle.trim(),
      content: formContent.trim(),
    });
    toast("Doc updated.");
    handleCancelForm();
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const doc = docs.find((d) => d.id === deleteTarget);
    deleteEpicDoc(deleteTarget);
    toast(`Doc "${doc?.title}" deleted.`, "info");
    if (activeDocId === deleteTarget) {
      const remaining = docs.filter((d) => d.id !== deleteTarget);
      setActiveDocId(remaining[0]?.id ?? null);
    }
    setDeleteTarget(null);
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Sidebar */}
      <div className="w-48 shrink-0 flex flex-col gap-1">
        <div className="flex items-center justify-between mb-1 px-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pages
          </p>
          {canEdit && !isCreating && (
            <button
              onClick={handleStartCreate}
              className="text-muted-foreground hover:text-indigo-600 transition-colors"
              title="New doc"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {docs.length === 0 && !isCreating && (
          <p className="text-xs text-muted-foreground px-2 py-1">
            No docs yet.
          </p>
        )}

        <div className="space-y-0.5">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => {
                setActiveDocId(doc.id);
                setEditingId(null);
                setIsCreating(false);
              }}
              className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                activeDocId === doc.id || (!activeDocId && doc === docs[0])
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{doc.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 rounded-lg border border-border bg-white p-6 min-h-[400px]">
        {/* Create form */}
        {isCreating && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">New Doc</h2>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Title…"
              autoFocus
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Write content here…"
              rows={12}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveCreate}
                disabled={!formTitle.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancelForm}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editingId && !isCreating && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Edit Doc
            </h2>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Title…"
              autoFocus
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Write content here…"
              rows={12}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={!formTitle.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={handleCancelForm}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* View doc */}
        {!isCreating && !editingId && activeDoc && (
          <div>
            <div className="flex items-start justify-between gap-4 mb-1">
              <h2 className="text-lg font-bold text-foreground">
                {activeDoc.title}
              </h2>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStartEdit(activeDoc.id)}
                    className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(activeDoc.id)}
                    className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-6">
              By {activeDoc.createdBy.name}
            </p>
            <pre className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-sans">
              {activeDoc.content}
            </pre>
          </div>
        )}

        {/* Empty state */}
        {!isCreating && !editingId && !activeDoc && (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
            <FileText className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              No docs yet for this epic.
            </p>
            {canEdit && (
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Doc
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        title="Delete doc?"
        description={`"${docs.find((d) => d.id === deleteTarget)?.title}" will be permanently removed.`}
      />
    </div>
  );
}
