import { RecordModel } from "pocketbase";

export interface PBUser extends RecordModel {
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  role: "Admin" | "Manager" | "Member" | "Viewer";
  weeklyCapacity: number;
}

export interface PBEpic extends RecordModel {
  title: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  owner: string;
  // PocketBase returns string when maxSelect=1, string[] when maxSelect>1.
  // Both cases must be handled defensively in mappers.
  watchers: string | string[];
  expand?: {
    owner?: PBUser;
    watchers?: PBUser | PBUser[];
  };
}

export interface PBTask extends RecordModel {
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  start_date?: string;
  estimate: number;
  order: number;
  epic: string;
  owner: string;
  assignee: string;
  expand?: {
    owner?: PBUser;
    assignee?: PBUser;
  };
}

export interface PBSubtask extends RecordModel {
  title: string;
  done: boolean;
  due_date: string;
  status: string;
  task: string;
  assignee: string;
  expand?: {
    assignee?: PBUser;
  };
}

export interface PBComment extends RecordModel {
  text: string;
  task: string;
  author: string;
  mentions: string | string[];
  expand?: {
    author?: PBUser;
    mentions?: PBUser | PBUser[];
  };
}

export interface PBEpicDoc extends RecordModel {
  title: string;
  content: string;
  epic: string;
  created_by: string;
  expand?: {
    created_by?: PBUser;
  };
}

export interface PBGoal extends RecordModel {
  title: string;
  description: string;
  owner: string;
  linked_epics: string | string[];
  expand?: {
    owner?: PBUser;
    linked_epics?: PBEpic | PBEpic[];
  };
}

export interface PBGoalKpi extends RecordModel {
  label: string;
  target: number;
  current: number;
  unit: string;
  green_threshold: number;
  yellow_threshold: number;
  goal: string;
}
