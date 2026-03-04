"use client";

import { AvatarChip } from "@/components/shared/AvatarChip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { useToast } from "@/contexts/ToastContext";
import { canComment, canDelete } from "@/lib/permissions";
import { Comment, Epic } from "@/lib/types";
import { Send, Trash2 } from "lucide-react";
import { useState } from "react";

interface CommentsSectionProps {
  taskId: string;
  comments: Comment[];
  epic?: Epic;
}

export function CommentsSection({
  taskId,
  comments,
  epic,
}: CommentsSectionProps) {
  const { addComment, deleteComment } = useDataStore();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [draft, setDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null);

  const canPost = canComment(currentUser, epic);

  function handlePost() {
    if (!draft.trim() || !currentUser) return;
    addComment(taskId, draft.trim(), currentUser);
    toast("Comment posted.");
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handlePost();
    }
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteComment(taskId, deleteTarget.id);
    toast("Comment deleted.", "info");
    setDeleteTarget(null);
  }

  function canDeleteComment(comment: Comment): boolean {
    // Admin can delete any; Member can delete their own in their epic
    return canDelete(currentUser, epic, comment.author.id);
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Comments{" "}
        <span className="text-muted-foreground font-normal">
          ({comments.length})
        </span>
      </h3>

      {/* Comment list */}
      <div className="space-y-4 mb-4">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No comments yet. Be the first.
          </p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3 group/comment">
            <AvatarChip user={comment.author} size="sm" className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-medium text-foreground">
                  {comment.author.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {comment.createdAt}
                </span>
                {/* Delete icon — visible on hover for those who can delete */}
                {canDeleteComment(comment) && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(comment)}
                    className="ml-1 hidden group-hover/comment:inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {comment.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input — only shown if user can post */}
      {canPost && currentUser && (
        <div className="flex gap-3">
          <AvatarChip user={currentUser} size="sm" className="mt-1.5" />
          <div className="flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment… (⌘+Enter to post)"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={handlePost}
                disabled={!draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        title="Delete comment?"
        description="This comment will be permanently removed."
      />
    </div>
  );
}
