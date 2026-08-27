import { supabase } from "./supabase";

export type DbCourse = {
  id: string;
  title: string;
  category: string | null;
  lessons: number;
  created_at: string;
};

export type NewCourse = { title: string; category?: string | null; lessons?: number };

export type DbProgress = {
  id: string;
  course_id: string;
  employee_id: string;
  completed: boolean;
  completed_at: string | null;
  assigned_at: string;
};

const COURSE_COLS = "id,title,category,lessons,created_at";
const PROGRESS_COLS = "id,course_id,employee_id,completed,completed_at,assigned_at";
// Ships in migrations 0034/0035 — reach the tables untyped until Lovable regenerates DB types.
const coursesTable = () => (supabase as unknown as { from: (t: string) => any }).from("courses");
const progressTable = () => (supabase as unknown as { from: (t: string) => any }).from("training_progress");

export async function listCourses(orgId: string): Promise<DbCourse[]> {
  const { data, error } = await coursesTable().select(COURSE_COLS).eq("org_id", orgId).order("created_at", { ascending: true });
  if (error) return [];
  return (data as DbCourse[]) ?? [];
}

export async function createCourse(orgId: string, c: NewCourse) {
  const { data, error } = await coursesTable().insert({ org_id: orgId, ...c }).select(COURSE_COLS).single();
  return { data: data as DbCourse | null, error: error ? new Error(error.message) : null };
}

export async function updateCourse(id: string, patch: Partial<NewCourse>) {
  const { error } = await coursesTable().update(patch).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function deleteCourse(id: string) {
  const { error } = await coursesTable().delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/** All assignments for an org (every course x employee that's been explicitly assigned). */
export async function listProgress(orgId: string): Promise<DbProgress[]> {
  const { data, error } = await progressTable().select(PROGRESS_COLS).eq("org_id", orgId);
  if (error) return [];
  return (data as DbProgress[]) ?? [];
}

/** Assign a course to an employee (a training_progress row = "assigned"). A
 *  no-op if already assigned — never resets an existing completion. */
export async function assignTraining(orgId: string, courseId: string, employeeId: string) {
  const { error } = await progressTable().upsert(
    { org_id: orgId, course_id: courseId, employee_id: employeeId, completed: false },
    { onConflict: "course_id,employee_id", ignoreDuplicates: true },
  );
  return { error: error ? new Error(error.message) : null };
}

/** Remove an assignment entirely (unassign). */
export async function unassignTraining(id: string) {
  const { error } = await progressTable().delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/** Mark an existing assignment's completion. Doesn't touch assigned_at — only
 *  set once, at assignment time. */
export async function setProgress(orgId: string, courseId: string, employeeId: string, completed: boolean) {
  const { error } = await progressTable().upsert(
    { org_id: orgId, course_id: courseId, employee_id: employeeId, completed, completed_at: completed ? new Date().toISOString() : null },
    { onConflict: "course_id,employee_id" },
  );
  return { error: error ? new Error(error.message) : null };
}
