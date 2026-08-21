import { supabase } from "./supabase";

// ── Loyalty points program (Model B — lifetime odometer) ──────────────────
// Points = lifetime spend, so they only ever go up. Crossing a milestone
// auto-issues a one-time reward code; redeeming it costs the customer no points.
// Every number here is PER-BUSINESS: each org's settings (see loyalty_settings)
// drive the engine, so a florist and a law firm can run different math — or none.

export type Grade = { grade: string; threshold: number; value: number };
export type RepeatTier = { enabled: boolean; start: number; step: number; value: number };
export type LoyaltySettings = {
  enabled: boolean;
  pointsPerDollar: number;
  grades: Grade[];
  repeat: RepeatTier;
};

// Defaults used when an org has no saved settings (program ON, standard ladder).
export const DEFAULT_SETTINGS: LoyaltySettings = {
  enabled: true,
  pointsPerDollar: 1,
  grades: [
    { grade: "Bronze", threshold: 250, value: 10 },
    { grade: "Silver", threshold: 750, value: 25 },
    { grade: "Gold", threshold: 1500, value: 50 },
    { grade: "Platinum", threshold: 3000, value: 100 },
  ],
  repeat: { enabled: true, start: 4000, step: 1000, value: 75 },
};

// Display palette (grades are styled by ladder position; the repeating tier is fixed).
const GRADE_COLORS = ["oklch(0.62 0.08 55)", "oklch(0.8 0.02 250)", "oklch(0.82 0.14 85)", "oklch(0.9 0.05 250)"];
const ELITE_COLOR = "oklch(0.85 0.16 300)";
export function gradeColor(index: number): string {
  return GRADE_COLORS[index % GRADE_COLORS.length];
}

export type GradeView = Grade & { color: string };

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

function sortedGrades(s: LoyaltySettings): Grade[] {
  return [...s.grades].sort((a, b) => a.threshold - b.threshold);
}

/** A customer's points from their lifetime value, at this org's earn rate. */
export function pointsFor(ltv: number, s: LoyaltySettings = DEFAULT_SETTINGS): number {
  return Math.max(0, Math.round((Number(ltv) || 0) * (Number(s.pointsPerDollar) || 1)));
}

/** The highest grade a points total has reached (null if below the first). */
export function gradeFor(points: number, s: LoyaltySettings = DEFAULT_SETTINGS): GradeView | null {
  const grades = sortedGrades(s);
  let cur: GradeView | null = null;
  grades.forEach((g, i) => {
    if (points >= g.threshold) cur = { ...g, color: gradeColor(i) };
  });
  if (s.repeat.enabled && points >= s.repeat.start) {
    const highest = s.repeat.start + Math.floor((points - s.repeat.start) / s.repeat.step) * s.repeat.step;
    cur = { grade: "Elite", threshold: highest, value: s.repeat.value, color: ELITE_COLOR };
  }
  return cur;
}

/** Points remaining to the next milestone, and progress within the band (0–100). */
export function nextMilestone(
  points: number,
  s: LoyaltySettings = DEFAULT_SETTINGS,
): { threshold: number; remaining: number; pct: number } | null {
  const thresholds = sortedGrades(s).map((g) => g.threshold);
  let next = thresholds.find((t) => points < t);
  let prev = 0;
  if (next === undefined) {
    if (!s.repeat.enabled) return null; // topped out, no repeating tier
    next = points < s.repeat.start ? s.repeat.start : s.repeat.start + Math.ceil((points + 1 - s.repeat.start) / s.repeat.step) * s.repeat.step;
    prev = next - s.repeat.step;
  } else {
    prev = [...thresholds].reverse().find((t) => t <= points && t < (next as number)) ?? 0;
  }
  const remaining = next - points;
  const pct = next > prev ? Math.min(100, Math.max(0, Math.round(((points - prev) / (next - prev)) * 100))) : 0;
  return { threshold: next, remaining, pct };
}

/**
 * Milestones a points total has earned: every fixed grade reached, plus — for the
 * repeating tier — only the HIGHEST multiple reached (so catch-up/import issues a
 * single Elite code, while organic growth still yields one per +step crossed).
 */
export function earnedMilestones(points: number, s: LoyaltySettings = DEFAULT_SETTINGS): Grade[] {
  const out: Grade[] = [];
  for (const g of sortedGrades(s)) if (points >= g.threshold) out.push(g);
  if (s.repeat.enabled && points >= s.repeat.start) {
    const highest = s.repeat.start + Math.floor((points - s.repeat.start) / s.repeat.step) * s.repeat.step;
    out.push({ grade: "Elite", threshold: highest, value: s.repeat.value });
  }
  return out;
}

function makeCode(grade: string): string {
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5).padEnd(5, "X");
  return `${grade.slice(0, 4).toUpperCase()}-${rand}`;
}

// ── Settings persistence ───────────────────────────────────────────────────
// loyalty_settings ships in migration 0023 and isn't in the generated Database
// types until Lovable regenerates them, so reach it through an untyped handle.
const settingsTable = () => (supabase as unknown as { from: (t: string) => any }).from("loyalty_settings");
const rewardsTable = () => (supabase as unknown as { from: (t: string) => any }).from("reward_codes");

function coerceSettings(row: Record<string, unknown> | null): LoyaltySettings {
  if (!row) return DEFAULT_SETTINGS;
  const grades = Array.isArray(row.grades) && row.grades.length ? (row.grades as Grade[]) : DEFAULT_SETTINGS.grades;
  const repeat = (row.repeat as RepeatTier) ?? DEFAULT_SETTINGS.repeat;
  return {
    enabled: row.enabled !== false,
    pointsPerDollar: Number(row.points_per_dollar) || 1,
    grades,
    repeat: { enabled: repeat.enabled !== false, start: Number(repeat.start) || 4000, step: Number(repeat.step) || 1000, value: Number(repeat.value) || 0 },
  };
}

/** This org's loyalty settings, falling back to defaults (fails soft if unmigrated). */
export async function getLoyaltySettings(orgId: string): Promise<LoyaltySettings> {
  const { data, error } = await settingsTable().select("*").eq("org_id", orgId).maybeSingle();
  if (error) return DEFAULT_SETTINGS;
  return coerceSettings(data as Record<string, unknown> | null);
}

/** Save this org's loyalty settings (owner/admin/manager only, per RLS). */
export async function saveLoyaltySettings(orgId: string, s: LoyaltySettings): Promise<{ error: Error | null }> {
  const { error } = await settingsTable().upsert(
    {
      org_id: orgId,
      enabled: s.enabled,
      points_per_dollar: s.pointsPerDollar,
      grades: sortedGrades(s),
      repeat: s.repeat,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );
  return { error: error ? new Error(error.message) : null };
}

/** All reward codes for an org, newest first. Fails soft (empty) if not migrated. */
export async function listRewardCodes(orgId: string): Promise<RewardCode[]> {
  const { data, error } = await rewardsTable().select(COLS).eq("org_id", orgId).order("issued_at", { ascending: false });
  if (error) return [];
  return (data as RewardCode[]) ?? [];
}

export type IssueResult = { issued: number; error: Error | null };

/**
 * Check every customer against the org's ladder and issue codes for milestones
 * reached but not yet rewarded. Idempotent (unique customer_id+threshold index).
 * Does nothing if the program is disabled for this org.
 */
export async function issueRewardCodes(
  orgId: string,
  customers: { id: string; name: string; ltv: number }[],
  existing: RewardCode[],
  settings: LoyaltySettings = DEFAULT_SETTINGS,
): Promise<IssueResult> {
  if (!settings.enabled) return { issued: 0, error: null };
  const seen = new Set(existing.map((c) => `${c.customer_id}:${c.threshold}`));
  const rows: Record<string, unknown>[] = [];
  for (const c of customers) {
    const pts = pointsFor(c.ltv, settings);
    for (const m of earnedMilestones(pts, settings)) {
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
  const { error } = await rewardsTable().upsert(rows, { onConflict: "customer_id,threshold", ignoreDuplicates: true });
  return { issued: error ? 0 : rows.length, error: error ? new Error(error.message) : null };
}

/** Mark a code used (business honoured it at their checkout). */
export async function markCodeUsed(id: string, used: boolean): Promise<void> {
  await rewardsTable()
    .update({ status: used ? "used" : "issued", used_at: used ? new Date().toISOString() : null })
    .eq("id", id);
}
