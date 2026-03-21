export type Priority = "low" | "medium" | "high";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  created_at: string;
}

export interface Column {
  id: string;
  title: string;
  position: number;
  color: string;
  created_at: string;
}

export interface TaskAssignee {
  user_id: string;
  user: User;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  column_id: string;
  priority: Priority;
  due_date: string | null;
  position: number;
  google_calendar_event_id: string | null;
  reviewer_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignees?: TaskAssignee[];
  reviewer?: User | null;
  creator?: { id: string; name: string | null; avatar_url: string | null } | null;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface TaskTag {
  task_id: string;
  tag_id: string;
}

export interface BoardData {
  columns: Column[];
  tasks: Record<string, Task[]>;
}
