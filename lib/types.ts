export type TaskStatus = "To Do" | "In Progress" | "Review" | "Done";
export type Priority = "Low" | "Medium" | "High";
export type EpicStatus = "Not Started" | "In Progress" | "Done" | "On Hold";
export type Role = "Admin" | "Manager" | "Member" | "Viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  role: Role;
  weeklyCapacity: number; // hours per week (default 40)
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color?: string;
  icon?: string;
  createdAt: string;
  archivedAt?: string;
  memberIds: string[];
}

export interface Comment {
  id: string;
  taskId: string;
  author: User;
  text: string;
  createdAt: string;
  mentions?: string[]; // array of user IDs mentioned
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  assignee?: User;
  dueDate?: string;
  status?: TaskStatus;
}

export interface Task {
  id: string;
  epicId: string;
  projectId?: string;
  title: string;
  description: string;
  owner?: User;
  assignee: User | null;
  status: TaskStatus;
  priority: Priority;
  startDate?: string; // YYYY-MM-DD, derived from created timestamp
  dueDate: string;
  estimate?: number;
  order?: number;
  subtasks: Subtask[];
  comments: Comment[];
}

export interface Epic {
  id: string;
  projectId?: string;
  title: string;
  description: string;
  owner: User;
  watchers: User[];
  status: EpicStatus;
  startDate?: string;
  endDate?: string;
}

export interface EpicDoc {
  id: string;
  epicId: string;
  title: string;
  content: string;
  createdBy: User;
  createdAt: string;
  updatedAt: string;
}

export type GoalStatus = "On Track" | "At Risk" | "Completed";

export type InviteStatus = "pending" | "accepted" | "expired";

export interface Invite {
  id: string;
  name: string;
  email: string;
  role: Role;
  invitedBy: User;
  status: InviteStatus;
  expiresAt: string;
  created: string;
}

export interface GoalKpi {
  id: string;
  label: string;
  target: number;
  current: number;
  unit: string;
  greenThreshold: number; // % of target — status is On Track when (current/target)*100 >= this
  yellowThreshold: number; // % of target — status is At Risk when (current/target)*100 >= this
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  owner: User;
  kpis: GoalKpi[];
  linkedEpicIds: string[];
}
