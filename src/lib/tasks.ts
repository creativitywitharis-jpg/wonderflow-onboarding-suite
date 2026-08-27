import { supabase } from "./supabase";

export type TaskPriority = "High" | "Normal";
export type TaskStatus = "To do" | "In progress" | "Review" | "Done";
export const TASK_COLUMNS: TaskStatus[] = ["To do", "In progress", "Review", "Done"];

export type DbTask = {
  id: string;
  title: string;
  assignee_id: string | null;
  assignee_name: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  notes: string | null;
  created_at: string;
};

export type NewTask = {
  title: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  notes?: string | null;
};

const COLS = "id,title,assignee_id,assignee_name,priority,status,due_date,notes,created_at";
// Ships in migration 0031 — reach the table untyped until Lovable regenerates DB types.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("tasks");

/** All tasks for an org, newest first (RLS-scoped to members). */
export async function listTasks(orgId: string): Promise<DbTask[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId).order("created_at", { ascending: false });
  if (error) return [];
  return (data as DbTask[]) ?? [];
}

export async function createTask(orgId: string, t: NewTask) {
  const { data, error } = await table().insert({ org_id: orgId, ...t }).select(COLS).single();
  return { data: data as DbTask | null, error: error ? new Error(error.message) : null };
}

export async function updateTask(id: string, patch: Partial<NewTask>) {
  const { data, error } = await table().update(patch).eq("id", id).select(COLS).single();
  return { data: data as DbTask | null, error: error ? new Error(error.message) : null };
}

export async function deleteTask(id: string) {
  const { error } = await table().delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
