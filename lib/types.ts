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

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  uploadedBy: User;
  uploadedAt: string;
}

export interface ExternalLink {
  id: string;
  url: string;
  label: string;
  addedBy: User;
  addedAt: string;
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
  watchers: User[];
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  estimate?: number;
  subtasks: Subtask[];
  comments: Comment[];
  attachments: Attachment[];
  externalLinks: ExternalLink[];
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
  memberIds: string[];
}

export type GoalStatus = "On Track" | "At Risk" | "Completed";

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
