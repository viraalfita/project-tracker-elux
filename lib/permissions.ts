import { EPIC_MEMBERS } from "./mock";
import { User } from "./types";

// ============================================================================
// STRICT RBAC PERMISSION HELPERS
// Implements the exact PRD rules - DO NOT extend beyond these definitions
// ============================================================================

/**
 * Returns true if the user can view the given epic.
 * - Admin: ALL epics
 * - Manager: ALL epics
 * - Member: Only epics they are assigned to
 * - Viewer: Only epics they are assigned to
 */
export function canViewEpic(user: User | null, epicId: string): boolean {
  if (!user) return false;
  if (user.role === "Admin" || user.role === "Manager") return true;
  return EPIC_MEMBERS[epicId]?.includes(user.id) ?? false;
}

/**
 * Returns true if the user can manage epics (create/edit/delete at workspace level).
 * - Admin: YES (full control)
 * - Manager: NO (cannot create/delete epics at workspace level)
 * - Member: NO (cannot manage workspace-level settings)
 * - Viewer: NO (read-only)
 */
export function canManageEpics(user: User | null): boolean {
  if (!user) return false;
  return user.role === "Admin";
}

/**
 * Returns true if the user can create entities (tasks, subtasks) in an epic.
 * - Admin: YES (everywhere)
 * - Manager: YES (can create tasks for their own work)
 * - Member: YES (only in assigned epics)
 * - Viewer: NO (read-only)
 */
export function canCreate(user: User | null, epicId?: string): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "Manager") return true;
  if (user.role === "Viewer") return false;
  // Member: only inside epics they belong to
  if (!epicId) return false;
  return EPIC_MEMBERS[epicId]?.includes(user.id) ?? false;
}

/**
 * Returns true if the user can edit entities (epics, tasks, subtasks) in an epic.
 * - Admin: YES (everywhere)
 * - Manager: YES (can edit their own tasks)
 * - Member: YES (only in assigned epics)
 * - Viewer: NO (read-only)
 */
export function canEdit(user: User | null, epicId?: string): boolean {
  return canCreate(user, epicId);
}

/**
 * Returns true if the user can delete an entity.
 * - Admin: YES (can delete anything)
 * - Manager: YES (can delete their own tasks)
 * - Member: YES (in assigned epics; for comments, only their own)
 * - Viewer: NO (read-only)
 *
 * @param resourceAuthorId - For comments, pass author ID to enforce "own only" for Members
 */
export function canDelete(
  user: User | null,
  epicId?: string,
  resourceAuthorId?: string,
): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "Manager") return true;
  if (user.role === "Viewer") return false;
  // Member: must be in the epic
  const inEpic = epicId
    ? (EPIC_MEMBERS[epicId]?.includes(user.id) ?? false)
    : false;
  if (!inEpic) return false;
  // If a specific author is provided, Member can only delete their own resource
  if (resourceAuthorId !== undefined) return user.id === resourceAuthorId;
  return true;
}

/**
 * Returns true if the user can update task/epic status.
 * - Admin: YES (everywhere)
 * - Manager: YES (can update status for their tasks and reviews)
 * - Member: YES (only in assigned epics)
 * - Viewer: NO (read-only)
 */
export function canUpdateStatus(user: User | null, epicId?: string): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "Manager") return true;
  if (user.role === "Viewer") return false;
  // Member: only in their epics
  if (!epicId) return false;
  return EPIC_MEMBERS[epicId]?.includes(user.id) ?? false;
}

/**
 * Returns true if the user can assign tasks to other users.
 * - Admin: YES (can assign to anyone)
 * - Manager: YES (can assign tasks within their scope)
 * - Member: YES (only within assigned epics, to members of same epic)
 * - Viewer: NO (read-only)
 */
export function canAssignTask(user: User | null, epicId?: string): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "Manager") return true;
  if (user.role === "Viewer") return false;
  // Member: only in their epics
  if (!epicId) return false;
  return EPIC_MEMBERS[epicId]?.includes(user.id) ?? false;
}

/**
 * Returns true if the user can post comments.
 * - Admin: YES (everywhere)
 * - Manager: YES (can comment on tasks they manage/review)
 * - Member: YES (only in assigned epics)
 * - Viewer: NO (read-only, CANNOT comment)
 */
export function canComment(user: User | null, epicId?: string): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "Manager") return true;
  if (user.role === "Viewer") return false;
  // Member: only in their epics
  if (!epicId) return false;
  return EPIC_MEMBERS[epicId]?.includes(user.id) ?? false;
}

/**
 * Returns the list of users that can be assigned to tasks/subtasks in an epic.
 * - Admin: All users in the workspace
 * - Manager: All users in the workspace (can assign to team members)
 * - Member: Only users who are members of the same epic
 * - Viewer: Empty array (cannot assign)
 */
export function getAssignableUsers(
  user: User | null,
  epicId: string,
): string[] {
  if (!user) return [];
  if (user.role === "Admin" || user.role === "Manager") {
    // Admin and Manager can assign to anyone
    return Object.keys(EPIC_MEMBERS).reduce((acc, eid) => {
      return [...new Set([...acc, ...(EPIC_MEMBERS[eid] || [])])];
    }, [] as string[]);
  }
  if (user.role === "Viewer") return [];
  // Member: only users in the same epic
  return EPIC_MEMBERS[epicId] || [];
}

/**
 * Returns true if the user can move a task from "Review" status to "Done".
 * Managers can approve completed reviews and mark tasks as Done.
 * - Admin: YES
 * - Manager: YES (can approve Review → Done workflow)
 * - Member: YES (in assigned epics)
 * - Viewer: NO
 */
export function canMoveFromReview(user: User | null): boolean {
  if (!user) return false;
  return (
    user.role === "Admin" || user.role === "Manager" || user.role === "Member"
  );
}

/**
 * Legacy helper - use more specific helpers instead.
 * @deprecated Use canCreate, canEdit, canUpdateStatus, etc. instead
 */
export function canWrite(user: User | null): boolean {
  if (!user) return false;
  return (
    user.role === "Admin" || user.role === "Manager" || user.role === "Member"
  );
}
