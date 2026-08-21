import { supabase } from "./supabase";

// ── Loyalty points program (Model B — lifetime odometer) ──────────────────
// Points = lifetime spend (1 pt per $1), so they only ever go up. Crossing a
// milestone auto-issues a one-time reward code as a bonus; redeeming it costs
// the customer no points. Past the top grade, a repeating tier keeps the best
// customers earning forever. All values here are the editable defaults.

export const POINTS_PER_DOLLAR = 1;

export type Grade = { grade: string; threshold: number; value: number; color: string };

/** Fixed milestone grades, low → high. */
export const GRADES: Grade[] = [
  { grade: "Bronze", threshold: 250, value: 10, color: "oklch(0.62 0.08 55)" },
  { grade: "Silver", threshold: 750, value: 25, color: "oklch(0.8 0.02 250)" },
  { grade: "Gold", threshold: 1500, value: 50, color: "oklch(0.82 0.14 85)" },
  { grade: "Platinum", threshold: 3000, value: 100, color: "oklch(0.9 0.05 250)" },
];

// Repeating reward beyond the top grade: every +STEP points → another code.
const REPEAT = { grade: "Elite", start: 4000, step: 1000, value: 75, color: "oklch(0.85 0.16 300)" };

export type EarnedMilestone = { grade: string; threshold: number; value: number };
export type RewardCode = {
  id: string;
  org_id: string;
  customer_id: string;
  customer_name: string | null;
  grade: string;
  threshold: number;
  points_at_issue: number;
  value: number;
  code: string;
  status: "issued" | "used" | "void";
  issued_at: string;
  used_at: string | null;
};

const COLS = "id,org_id,customer_id,customer_name,grade,threshold,points_at_issue,value,code,status,issued_at,used_at";

// `reward_codes` ships in migration 0022 and isn't in the generated Database
// types until Lovable regenerates them, so reach it through an untyped handle.
// Once types regenerate the runtime behaviour is unchanged.
const rewardsTable = () => (supabase as unknown as { from: (t: string) => any }).from("reward_codes");

/** A customer's points from their lifetime value. */
export function pointsFor(ltv: number): number {
  return Math.max(0, Math.round((Number(ltv) || 0) * POINTS_PER_DOLLAR));
}

/** The highest grade a points total has reached (null if below the first). */
export function gradeFor(points: number): Grade | null {
  let cur: Grade | null = null;
  for (const g of GRADES) if (points >= g.threshold) cur = g;
  if (points >= REPEAT.start) {
    const highest = REPEAT.start + Math.floor((points - REPEAT.start) / REPEAT.step) * REPEAT.step;
    cur = { grade: REPEAT.grade, threshold: highest, value: REPEAT.value, color: REPEAT.color };
  }
  return cur;
}

/** Points remaining to the next milestone, and progress within the band (0–100). */
export function nextMilestone(points: number): { threshold: number; remaining: number; pct: number } | null {
  const thresholds = GRADES.map((g) => g.threshold);
  let next = thresholds.find((t) => points < t);
  let prev = 0;
  if (next === undefined) {
    // Into the repeating tier — next multiple of STEP at/after start.
    const n = Math.max(REPEAT.start, Math.ceil((points + 1 - REPEAT.start) / REPEAT.step) * REPEAT.step + REPEAT.start);
    next = points < REPEAT.start ? REPEAT.start : n;
    prev = next - REPEAT.step;
  } else {
    prev = [...thresholds].reverse().find((t) => t <= points && t < (next as number)) ?? 0;
  }
  const remaining = next - points;
  const pct = next > prev ? Math.min(100, Math.max(0, Math.round(((points - prev) / (next - prev)) * 100))) : 0;
  return { threshold: next, remaining, pct };
}

/**
 * Milestones a points total has earned: every fixed grade reached, plus — for
 * the repeating tier — only the HIGHEST multiple reached. That way catching up
 * an existing (or freshly imported) customer issues a single Elite code, while
 * organic growth still yields one code each time `points` crosses a new +step.
 */
export function earnedMilestones(points: number): EarnedMilestone[] {
  const out: EarnedMilestone[] = [];
  for (const g of GRADES) if (points >= g.threshold) out.push({ grade: g.grade, threshold: g.threshold, value: g.value });
  if (points >= REPEAT.start) {
    const highest = REPEAT.start + Math.floor((points - REPEAT.start) / REPEAT.step) * REPEAT.step;
    out.push({ grade: REPEAT.grade, threshold: highest, value: REPEAT.value });
  }
  return out;
}

function makeCode(grade: string): string {
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5).padEnd(5, "X");
  return `${grade.slice(0, 4).toUpperCase()}-${rand}`;
}

/** All reward codes for an org, newest first. Fails soft (empty) if not migrated. */
export async function listRewardCodes(orgId: string): Promise<RewardCode[]> {
  const { data, error } = await rewardsTable()
    .select(COLS)
    .eq("org_id", orgId)
    .order("issued_at", { ascending: false });
  if (error) return [];
  return (data as RewardCode[]) ?? [];
}

export type IssueResult = { issued: number; error: Error | null };

/**
 * Check every customer against the ladder and issue codes for any milestones
 * they've reached but not yet been rewarded for. Idempotent — the unique
 * (customer_id, threshold) index means re-running never double-issues.
 */
export async function issueRewardCodes(
  orgId: string,
  customers: { id: string; name: string; ltv: number }[],
  existing: RewardCode[],
): Promise<IssueResult> {
  const seen = new Set(existing.map((c) => `${c.customer_id}:${c.threshold}`));
  const rows: Record<string, unknown>[] = [];
  for (const c of customers) {
    const pts = pointsFor(c.ltv);
    for (const m of earnedMilestones(pts)) {
      if (seen.has(`${c.id}:${m.threshold}`)) continue;
      rows.push({
        org_id: orgId,
        customer_id: c.id,
        customer_name: c.name,
        grade: m.grade,
        threshold: m.threshold,
        points_at_issue: pts,
        value: m.value,
        code: makeCode(m.grade),
      });
    }
  }
  if (rows.length === 0) return { issued: 0, error: null };
  // ignoreDuplicates guards against a race with the unique index.
  const { error } = await rewardsTable().upsert(rows, {
    onConflict: "customer_id,threshold",
    ignoreDuplicates: true,
  });
  return { issued: error ? 0 : rows.length, error: error ? new Error(error.message) : null };
}

/** Mark a code used (business honoured it at their checkout). */
export async function markCodeUsed(id: string, used: boolean): Promise<void> {
  await rewardsTable()
    .update({ status: used ? "used" : "issued", used_at: used ? new Date().toISOString() : null })
    .eq("id", id);
}
