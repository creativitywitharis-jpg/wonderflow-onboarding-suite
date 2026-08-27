import { supabase } from "./supabase";

export type EmployeeStatus = "Active" | "On leave" | "Offboarded";

export type DbEmployee = {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  status: EmployeeStatus;
  email: string | null;
  phone: string | null;
  location: string | null;
  since: string | null;
  skills: string[];
  created_at: string;
};

export type NewEmployee = {
  name: string;
  role?: string | null;
  department?: string | null;
  status?: EmployeeStatus;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  since?: string | null;
  skills?: string[];
};

const COLS = "id,name,role,department,status,email,phone,location,since,skills,created_at";
// Ships in migration 0030 — reach the table untyped until Lovable regenerates DB types.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("employees");

/** All employees for an org (RLS-scoped to members). */
export async function listEmployees(orgId: string): Promise<DbEmployee[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId).order("name", { ascending: true });
  if (error) return [];
  return (data as DbEmployee[]) ?? [];
}

export async function createEmployee(orgId: string, e: NewEmployee) {
  const { data, error } = await table().insert({ org_id: orgId, ...e }).select(COLS).single();
  return { data: data as DbEmployee | null, error: error ? new Error(error.message) : null };
}

export async function insertEmployees(orgId: string, rows: NewEmployee[]) {
  const { error } = await table().insert(rows.map((r) => ({ org_id: orgId, ...r })));
  return { error: error ? new Error(error.message) : null };
}

export async function updateEmployee(id: string, patch: Partial<NewEmployee>) {
  const { data, error } = await table().update(patch).eq("id", id).select(COLS).single();
  return { data: data as DbEmployee | null, error: error ? new Error(error.message) : null };
}

export async function deleteEmployee(id: string) {
  const { error } = await table().delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
