import { Epic, Task, User } from "./types";

// ============================================================================
// OWNERSHIP + WATCHER PERMISSION HELPERS
//
// New model:
// - Epic access is determined by ownership and watcher membership only.
// - Owner: the user who created the epic (permanent, cannot be transferred).
// - Watchers: users explicitly added by the owner to collaborate on the epic.
// - Admin has full access to all epics and tasks, regardless of ownership.
// - Admin and Manager can create new epics. Only Admin can manage goals.
// - Roles (Admin/Manager/Member/Viewer) do NOT gate epic or task access.
//
// Helpers accept `epic: Epic` (the full epic object) so that ownership and
// watcher relationships are evaluated directly from the data, without any
// intermediate memberIds array.
// ============================================================================

/** Returns true if the user has the Admin role. */
export function isAdmin(user: User | null): boolean {
  return user?.role === "Admin";
}

/**
 * Returns true if the user can access an epic.
 * Admin has full access; others must be the owner or an explicit watcher.
 */
export function isEpicMember(user: User | null, epic: Epic): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  return (
    epic.owner.id === user.id ||
    epic.watchers.some((w) => w.id === user.id)
  );
}

/**
 * Returns true if the user can view an epic.
 * Requires epic membership (owner, watcher, or Admin).
 */
export function canViewEpic(user: User | null, epic: Epic): boolean {
  return isEpicMember(user, epic);
}

/**
 * Returns true if the user can create a new Epic at the workspace level.
 * Only Admin and Manager roles may create Epics.
 */
export function canManageEpics(user: User | null): boolean {
  if (!user) return false;
  return isAdmin(user) || user.role === "Manager";
}

/**
 * Returns true if the user can create entities (tasks, subtasks) within an epic.
 * Requires epic membership (owner, watcher, or Admin).
 */
export function canCreate(user: User | null, epic?: Epic): boolean {
  if (!user || !epic) return false;
  return isEpicMember(user, epic);
}

/**
 * Returns true if the user can edit entities (tasks, subtasks) within an epic.
 * Requires epic membership (owner, watcher, or Admin).
 */
export function canEdit(user: User | null, epic?: Epic): boolean {
  return canCreate(user, epic);
}

/**
 * Returns true if the user can edit the epic's own metadata (title, description,
 * status, dates). Only Admin and Manager roles may edit epic metadata.
 * Members and Viewers are not allowed, even if they are watchers.
 */
export function canEditEpicMeta(user: User | null, epic?: Epic): boolean {
  if (!user || !epic) return false;
  if (isAdmin(user)) return true;
  return user.role === "Manager" && isEpicMember(user, epic);
}

/**
 * Returns true if the user can delete an entity within an epic.
 * Requires epic membership (owner, watcher, or Admin).
 *
 * @param resourceAuthorId - If provided, non-admin members may only delete
 *   their own resource (e.g. a comment they authored).
 */
export function canDelete(
  user: User | null,
  epic?: Epic,
  resourceAuthorId?: string,
): boolean {
  if (!user || !epic) return false;
  if (!isEpicMember(user, epic)) return false;
  if (resourceAuthorId !== undefined) {
    return isAdmin(user) || user.id === resourceAuthorId;
  }
  return true;
}

/**
 * Returns true if the user can update task/epic status.
 * Requires epic membership (owner, watcher, or Admin).
 */
export function canUpdateStatus(user: User | null, epic?: Epic): boolean {
  return canCreate(user, epic);
}

/**
 * Returns true if the user can assign tasks to other users.
 * Requires epic membership (owner, watcher, or Admin).
 */
export function canAssignTask(user: User | null, epic?: Epic): boolean {
  return canCreate(user, epic);
}

/**
 * Returns true if the user can post comments on tasks within an epic.
 * Requires epic membership (owner, watcher, or Admin).
 */
export function canComment(user: User | null, epic?: Epic): boolean {
  return canCreate(user, epic);
}

/**
 * Returns the IDs of users that can be assigned to tasks/subtasks.
 * Only users who are members of the epic (owner + watchers) are assignable.
 * This ensures non-members cannot be assigned to tasks in an epic they can't access.
 */
export function getAssignableUsers(
  user: User | null,
  epic: Epic | undefined,
  allUsers: User[] = [],
): string[] {
  if (!user || !epic) return [];
  if (!isEpicMember(user, epic)) return [];
  // Restrict to epic members: owner + watchers
  const epicMemberIds = new Set(getEpicAllowedUserIds(epic));
  return allUsers.filter((u) => epicMemberIds.has(u.id)).map((u) => u.id);
}

/**
 * Returns true if the user can move a task from "Review" to "Done".
 * Requires epic membership (owner, watcher, or Admin).
 */
export function canMoveFromReview(user: User | null, epic?: Epic): boolean {
  return canCreate(user, epic);
}

/**
 * Returns true if the user can manage watchers on an Epic or Task.
 * Only the epic owner and Admin can add or remove watchers.
 * (Adding a watcher grants that person access to the epic.)
 */
export function canManageWatchers(user: User | null, epic?: Epic): boolean {
  if (!user || !epic) return false;
  if (isAdmin(user)) return true;
  return epic.owner.id === user.id;
}

/**
 * Returns true if the user can create, edit, or delete Goals and their KPIs.
 * Only Admin can manage goals.
 */
export function canManageGoal(user: User | null): boolean {
  return isAdmin(user);
}

/**
 * Returns true if the user can link or unlink Epics on a Goal.
 * Only Admin can manage goal links.
 * @deprecated Use canManageGoal instead.
 */
export function canManageGoalLinks(user: User | null): boolean {
  return canManageGoal(user);
}

/**
 * Legacy helper — kept for backward compatibility; prefer specific helpers.
 * @deprecated Use canCreate, canEdit, canUpdateStatus, etc. instead.
 */
export function canWrite(user: User | null): boolean {
  return !!user;
}

/**
 * Returns the set of user IDs allowed to access an epic.
 * Allowed set = {owner.id} ∪ {watcher.id…}
 */
export function getEpicAllowedUserIds(epic: Epic): Set<string> {
  const ids = new Set<string>();
  if (epic?.owner?.id) ids.add(epic.owner.id);
  (epic?.watchers ?? []).forEach((w) => {
    if (w?.id) ids.add(w.id);
  });
  return ids;
}

/**
 * Returns true if the user has any involvement in an epic.
 * Involvement means: user is the owner or an explicit watcher.
 * (Admin access is handled at call sites before invoking this function.)
 *
 * The `_tasks` parameter is accepted but ignored; kept so existing call-sites
 * that pass tasks do not need to be updated.
 */
export function isUserInvolvedInEpic(
  epic: Epic,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tasks?: Task[],
): boolean {
  if (!epic || !userId) return false;
  return getEpicAllowedUserIds(epic).has(userId);
}
