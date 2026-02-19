import { USERS } from "./mock";
import { Epic, Task, User } from "./types";

// ============================================================================
// MEMBERSHIP-BASED PERMISSION HELPERS
//
// New model:
// - Epic membership (epic.memberIds) is the sole gate for create/edit/delete
//   within an Epic.
// - Admin has global access to ALL Epics regardless of membership.
// - Any logged-in user can CREATE a new Epic (creator becomes owner + member
//   + watcher automatically).
// - All other roles (Manager, Member, Viewer) can only interact with Epics
//   they are explicitly listed in (epic.memberIds).
//
// Helpers accept `epicMemberIds: string[]` (from epic.memberIds in DataStore
// state) instead of a static epicId lookup, so newly created/updated epics
// are reflected correctly in real time.
// ============================================================================

/** Convenience: returns true if the user is an Admin. */
export function isAdmin(user: User | null): boolean {
  return user?.role === "Admin";
}

/**
 * Returns true if the user is an explicit member of the epic.
 * Admin always satisfies this regardless of memberIds contents.
 */
export function isEpicMember(
  user: User | null,
  epicMemberIds: string[],
): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  return epicMemberIds.includes(user.id);
}

/**
 * Returns true if the user can view an epic.
 * - Admin: ALL epics (global access).
 * - Everyone else: ONLY epics where they appear in epicMemberIds.
 */
export function canViewEpic(
  user: User | null,
  epicMemberIds: string[],
): boolean {
  return isEpicMember(user, epicMemberIds);
}

/**
 * Returns true if the user can create a new Epic at the workspace level.
 * Any logged-in user may create an Epic. On creation the creator is
 * auto-added as owner, member, and watcher.
 */
export function canManageEpics(user: User | null): boolean {
  return !!user;
}

/**
 * Returns true if the user can create entities (tasks, subtasks) within an epic.
 * Requires epic membership (or Admin).
 */
export function canCreate(
  user: User | null,
  epicMemberIds?: string[],
): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (!epicMemberIds) return false;
  return epicMemberIds.includes(user.id);
}

/**
 * Returns true if the user can edit entities (epics, tasks, subtasks) in an epic.
 * Requires epic membership (or Admin).
 */
export function canEdit(user: User | null, epicMemberIds?: string[]): boolean {
  return canCreate(user, epicMemberIds);
}

/**
 * Returns true if the user can delete an entity within an epic.
 * Requires epic membership (or Admin).
 *
 * @param resourceAuthorId - If provided, non-admin members may only delete
 *   their own resource (e.g. comments).
 */
export function canDelete(
  user: User | null,
  epicMemberIds?: string[],
  resourceAuthorId?: string,
): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (!epicMemberIds) return false;
  const inEpic = epicMemberIds.includes(user.id);
  if (!inEpic) return false;
  if (resourceAuthorId !== undefined) return user.id === resourceAuthorId;
  return true;
}

/**
 * Returns true if the user can update task/epic status.
 * Requires epic membership (or Admin).
 */
export function canUpdateStatus(
  user: User | null,
  epicMemberIds?: string[],
): boolean {
  return canCreate(user, epicMemberIds);
}

/**
 * Returns true if the user can assign tasks to other users.
 * Requires epic membership (or Admin).
 */
export function canAssignTask(
  user: User | null,
  epicMemberIds?: string[],
): boolean {
  return canCreate(user, epicMemberIds);
}

/**
 * Returns true if the user can post comments on tasks within an epic.
 * Requires epic membership (or Admin).
 */
export function canComment(
  user: User | null,
  epicMemberIds?: string[],
): boolean {
  return canCreate(user, epicMemberIds);
}

/**
 * Returns the list of user IDs that can be assigned to tasks/subtasks in an epic.
 * - Admin: all workspace users.
 * - Epic members: only other users who share epicMemberIds.
 * - Non-members / unauthenticated: empty array.
 */
export function getAssignableUsers(
  user: User | null,
  epicMemberIds: string[],
): string[] {
  if (!user) return [];
  if (user.role === "Admin") return USERS.map((u) => u.id);
  if (!epicMemberIds.includes(user.id)) return [];
  return epicMemberIds;
}

/**
 * Returns true if the user can move a task from "Review" to "Done".
 * Requires epic membership (or Admin).
 */
export function canMoveFromReview(
  user: User | null,
  epicMemberIds?: string[],
): boolean {
  return canCreate(user, epicMemberIds);
}

/**
 * Returns true if the user can manage watchers on an Epic/Task.
 * Requires epic membership (or Admin).
 */
export function canManageWatchers(
  user: User | null,
  epicMemberIds?: string[],
): boolean {
  return canCreate(user, epicMemberIds);
}

/**
 * Returns true if the user can link or unlink Epics on a Goal.
 * Any logged-in user can manage goal links.
 */
export function canManageGoalLinks(user: User | null): boolean {
  return !!user;
}

/**
 * Legacy helper — kept for backward compatibility; prefer specific helpers.
 * @deprecated Use canCreate, canEdit, canUpdateStatus, etc. instead.
 */
export function canWrite(user: User | null): boolean {
  return !!user;
}

/**
 * Returns the set of userIds explicitly allowed in an epic.
 *
 * allowedUserIds = {owner.id} ∪ {watcher.id…} ∪ {memberIds…}
 *
 * This is the single source of truth for epic access control.
 * Task/subtask assignments must never be used to infer epic visibility —
 * all assignees must already be in this set.
 */
export function getEpicAllowedUserIds(epic: Epic): Set<string> {
  const ids = new Set<string>();
  ids.add(epic.owner.id);
  epic.watchers.forEach((w) => ids.add(w.id));
  epic.memberIds.forEach((id) => ids.add(id));
  return ids;
}

/**
 * Returns true if the user is allowed to access an epic.
 *
 * Allowed means the userId appears in:
 *   - epic.owner.id, OR
 *   - epic.watchers (any watcher id), OR
 *   - epic.memberIds
 *
 * Task / subtask assignments are intentionally NOT checked here —
 * all assignees must be in the explicit membership fields above.
 *
 * The `_tasks` parameter is accepted but ignored; it is kept only so
 * existing call-sites do not need updating.
 */
export function isUserInvolvedInEpic(
  epic: Epic,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tasks?: Task[],
): boolean {
  return getEpicAllowedUserIds(epic).has(userId);
}
