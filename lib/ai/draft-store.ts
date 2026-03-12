/**
 * In-memory draft store.
 *
 * Each user has at most ONE active draft.
 * The draft holds the partially-collected command fields while the LLM
 * conversation is in progress.
 *
 * Uses a generic `payload` object so it can accommodate any intent without
 * requiring a new interface for each operation.
 */

export interface DraftResolved {
  /** Resolved user PocketBase IDs */
  owner_id?: string;
  assignee_id?: string;
  member_ids?: string[];
  /** task title → assignee user ID (for create_epic_with_tasks) */
  assignee_map?: Record<string, string>;
  /** Resolved entity PocketBase IDs */
  epic_id?: string;
  task_id?: string;
  subtask_id?: string;
  goal_id?: string;
  linked_epic_ids?: string[];
}

export interface DraftJson {
  /** Intent-specific field values — keys depend on the active intent */
  payload: Record<string, unknown>;
  /** Required fields that are still null/missing */
  missing_fields: string[];
  /** Populated when status transitions to "ready" — stores resolved PocketBase IDs */
  resolved?: DraftResolved;
}

export interface AiDraft {
  userId: string;
  intent: string;
  draftJson: DraftJson;
  status: "collecting_fields" | "ready";
  createdAt: Date;
  updatedAt: Date;
}

// One draft per user, keyed by userId
const store = new Map<string, AiDraft>();

export function getDraft(userId: string): AiDraft | undefined {
  return store.get(userId);
}

export function saveDraft(
  userId: string,
  data: Pick<AiDraft, "intent" | "draftJson" | "status">,
): AiDraft {
  const existing = store.get(userId);
  const draft: AiDraft = {
    userId,
    ...data,
    createdAt: existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
  store.set(userId, draft);
  return draft;
}

export function clearDraft(userId: string): void {
  store.delete(userId);
}
