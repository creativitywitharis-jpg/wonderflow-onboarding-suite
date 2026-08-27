import { supabase } from "./supabase";

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type DbShift = {
  id: string;
  employee_id: string;
  day: Weekday;
  start_time: string | null;
  end_time: string | null;
  is_off: boolean;
};

const COLS = "id,employee_id,day,start_time,end_time,is_off";
// Ships in migration 0032 — reach the table untyped until Lovable regenerates DB types.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("shifts");

/** All shifts for an org (every employee, every day that's been set). */
export async function listShifts(orgId: string): Promise<DbShift[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId);
  if (error) return [];
  return (data as DbShift[]) ?? [];
}

/** Set (or clear) one employee's shift for one day. Upserts on (employee_id, day). */
export async function upsertShift(
  orgId: string,
  employeeId: string,
  day: Weekday,
  patch: { start_time?: string | null; end_time?: string | null; is_off?: boolean },
): Promise<{ error: Error | null }> {
  const { error } = await table().upsert(
    { org_id: orgId, employee_id: employeeId, day, ...patch },
    { onConflict: "employee_id,day" },
  );
  return { error: error ? new Error(error.message) : null };
}
