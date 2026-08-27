import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Bot,
  Brain,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Gauge,
  GraduationCap,
  Hash,
  Home,
  LayoutGrid,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Pencil,
  Phone,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Users,
  UsersRound,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Bar, Donut, Reveal, Ring, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useInView } from "@/hooks/use-in-view";
import { useOrg } from "@/lib/org-context";
import { CsvImport } from "@/components/wf/CsvImport";
import type { FieldSpec } from "@/lib/csv";
import { DatePicker } from "@/components/wf/DatePicker";
import {
  createEmployee,
  deleteEmployee,
  insertEmployees,
  listEmployees,
  updateEmployee,
  type DbEmployee,
  type EmployeeStatus,
  type NewEmployee,
} from "@/lib/employees";
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  TASK_COLUMNS,
  type DbTask,
  type NewTask,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import { listShifts, upsertShift, WEEKDAYS, type DbShift, type Weekday } from "@/lib/shifts";
import {
  assignTraining,
  createCourse,
  deleteCourse,
  listCourses,
  listProgress,
  setProgress,
  unassignTraining,
  updateCourse,
  type DbCourse,
  type DbProgress,
  type NewCourse,
} from "@/lib/training";

/* ──────────────────────────────────────────────────────────────────────
 * Types + data
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey = "dashboard" | "people" | "tasks" | "assistant" | "schedule" | "performance" | "training" | "comms";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "people", label: "People", icon: Users },
  { key: "tasks", label: "Tasks", icon: LayoutGrid },
  { key: "assistant", label: "Staff assistant", icon: Bot },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "performance", label: "Performance", icon: Gauge },
  { key: "training", label: "Training", icon: GraduationCap },
  { key: "comms", label: "Communication", icon: MessageSquare },
];

const statusColor: Record<EmployeeStatus, string> = { Active: "oklch(0.72 0.14 155)", "On leave": "oklch(0.84 0.14 84)", Offboarded: "oklch(0.62 0.02 260)" };
const DEPT_PALETTE = ["oklch(0.84 0.14 84)", "oklch(0.7 0.11 60)", "oklch(0.66 0.09 200)", "oklch(0.75 0.13 150)", "oklch(0.62 0.12 300)", "oklch(0.7 0.02 250)"];

/** Real department breakdown derived from the org's own employees (not hard-coded). */
function deriveDepartments(emps: DbEmployee[]): { label: string; share: number; color: string }[] {
  const counts = new Map<string, number>();
  for (const e of emps) counts.set(e.department?.trim() || "Unassigned", (counts.get(e.department?.trim() || "Unassigned") ?? 0) + 1);
  const total = emps.length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n], i) => ({ label, share: Math.round((n / total) * 100), color: DEPT_PALETTE[i % DEPT_PALETTE.length] }));
}

type EmployeesState = {
  employees: DbEmployee[];
  loading: boolean;
  addEmployee: (e: NewEmployee) => Promise<void>;
  importEmployees: (rows: NewEmployee[]) => Promise<{ error: Error | null }>;
  editEmployee: (id: string, patch: Partial<NewEmployee>) => Promise<{ error: Error | null }>;
  removeEmployee: (id: string) => Promise<void>;
};
const EmployeesCtx = createContext<EmployeesState | null>(null);
function useEmployeesData() {
  const ctx = useContext(EmployeesCtx);
  if (!ctx) throw new Error("useEmployeesData must be used within EmployeesProvider");
  return ctx;
}
function EmployeesProvider({ children }: { children: ReactNode }) {
  const { org } = useOrg();
  const [employees, setEmployees] = useState<DbEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setEmployees(await listEmployees(org.id));
    } catch {
      setEmployees([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);
  useEffect(() => { void load(); }, [load]);

  const addEmployee = useCallback(
    async (e: NewEmployee) => {
      if (!org) return;
      await createEmployee(org.id, e);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );
  const importEmployees = useCallback(
    async (rows: NewEmployee[]) => {
      if (!org) return { error: new Error("No active workspace.") };
      const { error } = await insertEmployees(org.id, rows);
      await load();
      return { error };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );
  const editEmployee = useCallback(
    async (id: string, patch: Partial<NewEmployee>) => {
      const { error } = await updateEmployee(id, patch);
      await load();
      return { error };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );
  const removeEmployee = useCallback(
    async (id: string) => {
      await deleteEmployee(id);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  return (
    <EmployeesCtx.Provider value={{ employees, loading, addEmployee, importEmployees, editEmployee, removeEmployee }}>
      {children}
    </EmployeesCtx.Provider>
  );
}

const EMPLOYEE_IMPORT_FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", required: true, aliases: ["employee", "full name", "staff"] },
  { key: "role", label: "Role / title", aliases: ["title", "job title", "position"] },
  { key: "department", label: "Department", aliases: ["dept", "team"] },
  { key: "status", label: "Status", enum: ["Active", "On leave", "Offboarded"], aliases: ["employment status"] },
  { key: "email", label: "Email", aliases: ["e-mail", "email address"] },
  { key: "phone", label: "Phone", aliases: ["tel", "telephone", "mobile"] },
  { key: "location", label: "Location", aliases: ["city", "office"] },
  { key: "since", label: "Since", aliases: ["start date", "joined", "hire date"] },
  { key: "skills", label: "Skills", type: "tags", aliases: ["tags", "specialties"] },
];

type TasksState = {
  tasks: DbTask[];
  loading: boolean;
  addTask: (t: NewTask) => Promise<void>;
  editTask: (id: string, patch: Partial<NewTask>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
};
const TasksCtx = createContext<TasksState | null>(null);
function useTasksData() {
  const ctx = useContext(TasksCtx);
  if (!ctx) throw new Error("useTasksData must be used within TasksProvider");
  return ctx;
}
function TasksProvider({ children }: { children: ReactNode }) {
  const { org } = useOrg();
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTasks(await listTasks(org.id));
    } catch {
      setTasks([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);
  useEffect(() => { void load(); }, [load]);

  const addTask = useCallback(
    async (t: NewTask) => {
      if (!org) return;
      await createTask(org.id, t);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );
  const editTask = useCallback(
    async (id: string, patch: Partial<NewTask>) => {
      await updateTask(id, patch);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );
  const removeTask = useCallback(
    async (id: string) => {
      await deleteTask(id);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  return <TasksCtx.Provider value={{ tasks, loading, addTask, editTask, removeTask }}>{children}</TasksCtx.Provider>;
}

/** "Today" / "Tomorrow" / short date, from a YYYY-MM-DD due_date. */
function formatDue(due: string | null): string {
  if (!due) return "No date";
  const d = new Date(due + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 864e5);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const channels = [{ name: "general", unread: 0 }, { name: "operations", unread: 3 }, { name: "marketing", unread: 1 }, { name: "wins", unread: 0 }];
const seedMessages = [
  { author: "Marcus Reid", text: "Fulfilment SLA back to 97% — nice work team 💪", time: "12m" },
  { author: "Ava Chen", text: "Referral campaign is live. Early CTR looks great.", time: "34m" },
  { author: "WonderFlow AI", text: "Heads up: Thursday afternoon has a coverage gap in Support.", time: "1h" },
];

/* ──────────────────────────────────────────────────────────────────────
 * Small pieces
 * ─────────────────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: EmployeeStatus }) {
  const c = statusColor[status];
  return <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: c }}><span className="size-1.5 rounded-full" style={{ background: c }} />{status}</span>;
}

function Bars({ data }: { data: number[] }) {
  const { ref, inView } = useInView();
  const max = Math.max(...data);
  const min = Math.min(...data) * 0.9;
  return (
    <div ref={ref} className="flex items-end gap-1.5" style={{ height: 150 }}>
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col justify-end">
          <div className="rounded-t-md transition-all duration-700 ease-out" style={{ height: inView ? `${((v - min) / (max - min)) * 90 + 10}%` : "0%", transitionDelay: `${i * 40}ms`, background: i === data.length - 1 ? "var(--gradient-gold)" : "oklch(0.84 0.14 84 / 22%)" }} />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

function DashboardView({ open }: { open: (id: string) => void }) {
  const { employees, loading } = useEmployeesData();
  const active = employees.filter((e) => e.status === "Active").length;
  const onLeave = employees.filter((e) => e.status === "On leave").length;
  const departments = deriveDepartments(employees);
  const deptCount = departments.length;

  if (!loading && employees.length === 0) {
    return (
      <GlassCard className="p-8 text-center sm:p-10">
        <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
          <Users className="size-6" stroke="oklch(0.2 0.02 70)" />
        </span>
        <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>No team members yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Add your staff in the People tab — manually or via CSV — and your team dashboard comes alive here.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Team members" value={employees.length} icon={Users} />
        <StatTile label="Active" value={active} icon={Zap} />
        <StatTile label="On leave" value={onLeave} positive={onLeave === 0} icon={Clock} />
        <StatTile label="Departments" value={deptCount} icon={Building2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="glass-strong relative flex h-full flex-col overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex items-start gap-4">
              <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Brain className="size-5" stroke="oklch(0.2 0.02 70)" /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Team snapshot</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/90">
                  You have <span className="text-gold">{employees.length}</span> team member{employees.length === 1 ? "" : "s"} across <span className="text-gold">{deptCount}</span> department{deptCount === 1 ? "" : "s"}
                  {onLeave > 0 ? <>, with <span className="text-gold">{onLeave}</span> currently on leave</> : null}. Tasks, scheduling and performance will layer in as those modules go live.
                </p>
              </div>
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Building2}>By department</SectionLabel>
            {departments.length > 0 ? (
              <div className="mt-4 flex items-center gap-6">
                <Donut data={departments} size={140} center={<div><div className="text-xl font-semibold tabular-nums gold-text">{employees.length}</div><div className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">people</div></div>} />
                <ul className="min-w-0 flex-1 space-y-2">
                  {departments.map((d) => (<li key={d.label} className="flex items-center gap-2 text-sm"><span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} /><span className="flex-1 truncate text-foreground/85">{d.label}</span><span className="tabular-nums text-muted-foreground">{d.share}%</span></li>))}
                </ul>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Add employees to see the breakdown.</p>
            )}
          </GlassCard>
        </Reveal>
      </div>

      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={Users}>Team</SectionLabel>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {employees.slice(0, 6).map((e) => (
              <button key={e.id} onClick={() => open(e.id)} className="lift flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left hover:border-gold/30 hover:bg-glass">
                <Avatar name={e.name} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{e.name}</p><p className="truncate text-xs text-muted-foreground">{e.role || "—"}</p></div>
                <StatusPill status={e.status} />
              </button>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

const PPL_INPUT = "w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50";

function PeopleView({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { org } = useOrg();
  const { employees, loading, addEmployee, importEmployees } = useEmployeesData();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", department: "", email: "", status: "Active" as EmployeeStatus });

  if (selectedId) {
    const e = employees.find((x) => x.id === selectedId);
    if (e) return <EmployeeProfile e={e} onBack={() => onSelect(null)} />;
    onSelect(null);
  }

  const departments = ["All", ...new Set(employees.map((e) => e.department?.trim()).filter((d): d is string => !!d))];
  const filtered = employees.filter(
    (e) =>
      (dept === "All" || e.department === dept) &&
      (q === "" || (e.name + (e.role ?? "") + (e.department ?? "")).toLowerCase().includes(q.toLowerCase())),
  );

  const submit = async () => {
    if (!form.name.trim() || busy) return;
    setBusy(true);
    await addEmployee({
      name: form.name.trim(),
      role: form.role.trim() || undefined,
      department: form.department.trim() || undefined,
      email: form.email.trim() || undefined,
      status: form.status,
    });
    setBusy(false);
    setForm({ name: "", role: "", department: "", email: "", status: "Active" });
    setAdding(false);
  };

  const addForm = (
    <div className="grid gap-3 rounded-2xl border border-border bg-background/30 p-4 text-left sm:grid-cols-2">
      <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name *" className={PPL_INPUT} />
      <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Role / title" className={PPL_INPUT} />
      <input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="Department" className={PPL_INPUT} />
      <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className={PPL_INPUT} />
      <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EmployeeStatus }))} className={PPL_INPUT}>
        {(["Active", "On leave", "Offboarded"] as EmployeeStatus[]).map((s) => <option key={s}>{s}</option>)}
      </select>
      <div className="flex gap-2 sm:col-span-2">
        <button onClick={submit} disabled={!form.name.trim() || busy} className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>
          <Plus className="size-3.5" /> {busy ? "Saving…" : "Save employee"}
        </button>
        <button onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </div>
  );

  const importer = importing && org ? (
    <CsvImport entityLabel="employees" fields={EMPLOYEE_IMPORT_FIELDS} orgId={org.id} onImport={(rows) => importEmployees(rows as NewEmployee[])} onClose={() => setImporting(false)} />
  ) : null;

  if (!loading && employees.length === 0) {
    return (
      <Reveal>
        <GlassCard className="p-8 text-center sm:p-10">
          <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
            <Users className="size-6" stroke="oklch(0.2 0.02 70)" />
          </span>
          <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>No team members yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Add your staff one at a time, or import a roster from a CSV.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => setAdding((a) => !a)} className="rounded-full border border-border bg-glass px-5 py-2.5 text-sm text-foreground/85 transition-colors hover:border-gold/40">Add manually</button>
            <button onClick={() => setImporting(true)} className="rounded-full border border-border bg-glass px-5 py-2.5 text-sm text-foreground/85 transition-colors hover:border-gold/40">Import CSV</button>
          </div>
          {adding && <div className="mx-auto mt-6 max-w-lg">{addForm}</div>}
        </GlassCard>
        {importer}
      </Reveal>
    );
  }

  return (
    <Reveal>
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-full border border-border bg-background/40 px-4 py-2.5 focus-within:border-gold/50">
            <Search className="size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
          </label>
          <button onClick={() => setImporting(true)} className="rounded-full border border-border bg-glass px-4 py-2.5 text-sm text-foreground/85 transition-colors hover:border-gold/40">Import CSV</button>
          <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
            <Plus className="size-4" stroke="oklch(0.2 0.02 70)" /> New employee
          </button>
        </div>

        {adding && <div className="mt-4">{addForm}</div>}

        {departments.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {departments.map((d) => (
              <button key={d} onClick={() => setDept(d)} className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", dept === d ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground")} style={dept === d ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
                {d}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <button key={e.id} onClick={() => onSelect(e.id)} className="lift flex flex-col items-start rounded-2xl border border-border bg-background/30 p-4 text-left hover:border-gold/40">
              <div className="flex w-full items-center gap-3">
                <Avatar name={e.name} className="size-10 text-xs" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{e.name}</p><p className="truncate text-xs text-muted-foreground">{e.role || "—"}</p></div>
              </div>
              <div className="mt-3 flex w-full items-center justify-between text-xs"><span className="text-muted-foreground">{e.department || "Unassigned"}</span><StatusPill status={e.status} /></div>
            </button>
          ))}
        </div>
      </GlassCard>
      {importer}
    </Reveal>
  );
}

function EmployeeProfile({ e, onBack }: { e: DbEmployee; onBack: () => void }) {
  const { editEmployee, removeEmployee } = useEmployeesData();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ef, setEf] = useState({
    name: e.name, role: e.role ?? "", department: e.department ?? "", status: e.status,
    email: e.email ?? "", phone: e.phone ?? "", location: e.location ?? "", since: e.since ?? "", skills: e.skills.join(", "),
  });

  const saveEdit = async () => {
    if (!ef.name.trim() || busy) return;
    setBusy(true);
    await editEmployee(e.id, {
      name: ef.name.trim(),
      role: ef.role.trim() || undefined,
      department: ef.department.trim() || undefined,
      status: ef.status,
      email: ef.email.trim() || undefined,
      phone: ef.phone.trim() || undefined,
      location: ef.location.trim() || undefined,
      since: ef.since.trim() || undefined,
      skills: ef.skills.split(",").map((s) => s.trim()).filter(Boolean),
    });
    setBusy(false);
    setEditing(false);
  };
  const remove = async () => {
    await removeEmployee(e.id);
    onBack();
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" /> All people</button>
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col items-center p-6 text-center">
            <span className="grid size-20 place-items-center rounded-2xl text-2xl font-semibold" style={{ background: "var(--gradient-gold)", color: "oklch(0.2 0.02 70)" }}>{e.name.split(" ").map((p) => p[0]).join("")}</span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{e.name}</h2>
            <p className="text-sm text-muted-foreground">{e.role || "—"}</p>
            <div className="mt-2"><StatusPill status={e.status} /></div>
            <div className="mt-5 grid w-full grid-cols-2 gap-2 border-t border-border pt-5 text-center">
              <div><p className="truncate text-sm font-semibold">{e.department || "—"}</p><p className="text-[0.6rem] uppercase text-muted-foreground">Department</p></div>
              <div><p className="truncate text-sm font-semibold">{e.since || "—"}</p><p className="text-[0.6rem] uppercase text-muted-foreground">Since</p></div>
            </div>
            {e.location && <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3" /> {e.location}</p>}
            {e.email && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="size-3" /> {e.email}</p>}
            {e.phone && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="size-3" /> {e.phone}</p>}

            <div className="mt-5 flex w-full gap-2">
              <button onClick={editing ? () => setEditing(false) : () => setEditing(true)} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-glass px-4 py-2 text-xs text-foreground/80 transition-colors hover:border-gold/40">
                <Pencil className="size-3.5" /> {editing ? "Close editor" : "Edit details"}
              </button>
              <button onClick={remove} aria-label="Delete" className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-rose-400/50 hover:text-rose-300"><Trash2 className="size-3.5" /></button>
            </div>

            {editing && (
              <div className="mt-4 w-full space-y-2.5 border-t border-border pt-4 text-left">
                <label className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">Name
                  <input value={ef.name} onChange={(ev) => setEf((f) => ({ ...f, name: ev.target.value }))} className={cn(PPL_INPUT, "mt-1")} />
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Role
                    <input value={ef.role} onChange={(ev) => setEf((f) => ({ ...f, role: ev.target.value }))} className={cn(PPL_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Department
                    <input value={ef.department} onChange={(ev) => setEf((f) => ({ ...f, department: ev.target.value }))} className={cn(PPL_INPUT, "mt-1")} />
                  </label>
                </div>
                <label className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">Status
                  <select value={ef.status} onChange={(ev) => setEf((f) => ({ ...f, status: ev.target.value as EmployeeStatus }))} className={cn(PPL_INPUT, "mt-1")}>
                    {(["Active", "On leave", "Offboarded"] as EmployeeStatus[]).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">Email
                  <input value={ef.email} onChange={(ev) => setEf((f) => ({ ...f, email: ev.target.value }))} className={cn(PPL_INPUT, "mt-1")} />
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Phone
                    <input value={ef.phone} onChange={(ev) => setEf((f) => ({ ...f, phone: ev.target.value }))} className={cn(PPL_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Location
                    <input value={ef.location} onChange={(ev) => setEf((f) => ({ ...f, location: ev.target.value }))} className={cn(PPL_INPUT, "mt-1")} />
                  </label>
                </div>
                <label className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">Since
                  <input value={ef.since} onChange={(ev) => setEf((f) => ({ ...f, since: ev.target.value }))} placeholder="e.g. 2023" className={cn(PPL_INPUT, "mt-1")} />
                </label>
                <label className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">Skills (comma separated)
                  <input value={ef.skills} onChange={(ev) => setEf((f) => ({ ...f, skills: ev.target.value }))} className={cn(PPL_INPUT, "mt-1")} />
                </label>
                <button onClick={saveEdit} disabled={!ef.name.trim() || busy} className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>
                  <Check className="size-3.5" /> {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </GlassCard>
        </Reveal>

        <div className="space-y-4">
          <Reveal>
            <GlassCard className="p-6">
              <SectionLabel icon={Star}>Skills</SectionLabel>
              {e.skills.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">{e.skills.map((s) => <span key={s} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/85">{s}</span>)}</div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No skills logged yet — add some via Edit details.</p>
              )}
            </GlassCard>
          </Reveal>
          <Reveal delay={80}>
            <GlassCard className="p-6 text-sm text-muted-foreground">
              Tasks, performance and training history for {e.name.split(" ")[0]} will appear here once those modules are built.
            </GlassCard>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

const TSK_INPUT = "w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50";

function TaskForm({
  employees,
  initial,
  onCancel,
  onSave,
  saving,
}: {
  employees: DbEmployee[];
  initial?: Partial<NewTask>;
  onCancel: () => void;
  onSave: (t: NewTask) => void;
  saving: boolean;
}) {
  const [f, setF] = useState({
    title: initial?.title ?? "",
    assignee_id: initial?.assignee_id ?? "",
    priority: (initial?.priority ?? "Normal") as TaskPriority,
    status: (initial?.status ?? "To do") as TaskStatus,
    due_date: initial?.due_date ?? "",
  });
  const submit = () => {
    if (!f.title.trim()) return;
    const emp = employees.find((e) => e.id === f.assignee_id);
    onSave({
      title: f.title.trim(),
      assignee_id: f.assignee_id || null,
      assignee_name: emp?.name ?? null,
      priority: f.priority,
      status: f.status,
      due_date: f.due_date || null,
    });
  };
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-2">
      <input value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} placeholder="Task title *" className={cn(TSK_INPUT, "sm:col-span-2")} />
      <select value={f.assignee_id} onChange={(e) => setF((x) => ({ ...x, assignee_id: e.target.value }))} className={TSK_INPUT}>
        <option value="">Unassigned</option>
        {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <select value={f.priority} onChange={(e) => setF((x) => ({ ...x, priority: e.target.value as TaskPriority }))} className={TSK_INPUT}>
        <option value="Normal">Normal priority</option>
        <option value="High">High priority</option>
      </select>
      <select value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value as TaskStatus }))} className={TSK_INPUT}>
        {TASK_COLUMNS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <DatePicker value={f.due_date} onChange={(v) => setF((x) => ({ ...x, due_date: v }))} placeholder="Due date" className={TSK_INPUT} />
      <div className="flex gap-2 sm:col-span-2">
        <button onClick={submit} disabled={!f.title.trim() || saving} className="rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{saving ? "Saving…" : "Save task"}</button>
        <button onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}

function TasksView() {
  const { tasks, loading, addTask, editTask, removeTask } = useTasksData();
  const { employees } = useEmployeesData();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Stamps completed_at whenever a task newly enters/leaves Done — the only
  // honest way to later compute on-time rate or a real completion trend
  // (current status alone doesn't tell us WHEN it was finished).
  const advance = async (t: DbTask) => {
    const i = TASK_COLUMNS.indexOf(t.status);
    if (i >= TASK_COLUMNS.length - 1) return;
    const next = TASK_COLUMNS[i + 1];
    await editTask(t.id, { status: next, completed_at: next === "Done" ? new Date().toISOString() : t.completed_at });
  };
  const save = async (t: NewTask) => {
    setBusy(true);
    const prev = editingId ? tasks.find((x) => x.id === editingId) : undefined;
    const patch: NewTask = { ...t };
    if (t.status === "Done" && prev?.status !== "Done") patch.completed_at = new Date().toISOString();
    else if (t.status !== "Done" && prev?.status === "Done") patch.completed_at = null;
    if (editingId) await editTask(editingId, patch);
    else await addTask(patch);
    setBusy(false);
    setAdding(false);
    setEditingId(null);
  };

  if (!loading && tasks.length === 0 && !adding) {
    return (
      <GlassCard className="p-8 text-center sm:p-10">
        <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
          <LayoutGrid className="size-6" stroke="oklch(0.2 0.02 70)" />
        </span>
        <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>No tasks yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Add your first task and assign it to a real team member.</p>
        <button onClick={() => setAdding(true)} className="mt-6 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] mx-auto" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
          <Plus className="size-4" /> New task
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tasks.length} task{tasks.length === 1 ? "" : "s"}</p>
        <button onClick={() => { setAdding((a) => !a); setEditingId(null); }} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
          <Plus className="size-3.5" /> New task
        </button>
      </div>
      {adding && <TaskForm employees={employees} onCancel={() => setAdding(false)} onSave={save} saving={busy} />}

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-4">
          {TASK_COLUMNS.map((col) => {
            const list = tasks.filter((t) => t.status === col);
            return (
              <div key={col} className="w-72 shrink-0">
                <div className="mb-3 flex items-center justify-between px-1"><span className="text-sm font-semibold">{col}</span><span className="rounded-full bg-glass px-2 py-0.5 text-xs text-muted-foreground">{list.length}</span></div>
                <div className="space-y-3">
                  {list.map((t) =>
                    editingId === t.id ? (
                      <TaskForm key={t.id} employees={employees} initial={t} onCancel={() => setEditingId(null)} onSave={save} saving={busy} />
                    ) : (
                      <div key={t.id} className="lift group rounded-2xl border border-border bg-background/40 p-4">
                        <div className="flex items-center justify-between">
                          {t.priority === "High" ? <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-medium text-gold" style={{ background: "oklch(0.84 0.14 84 / 12%)" }}>High</span> : <span className="text-[0.65rem] text-muted-foreground">Normal</span>}
                          <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground"><Clock className="size-3" /> {formatDue(t.due_date)}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-foreground">{t.title}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar name={t.assignee_name ?? "?"} className="size-6 text-[0.55rem]" />
                            <span className="text-xs text-muted-foreground">{t.assignee_name?.split(" ")[0] ?? "Unassigned"}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => { setEditingId(t.id); setAdding(false); }} aria-label="Edit task" className="grid size-6 place-items-center rounded-lg border border-border text-muted-foreground hover:border-gold/40 hover:text-foreground"><Pencil className="size-3" /></button>
                            <button onClick={() => removeTask(t.id)} aria-label="Delete task" className="grid size-6 place-items-center rounded-lg border border-border text-muted-foreground hover:border-rose-400/50 hover:text-rose-300"><Trash2 className="size-3" /></button>
                          </div>
                        </div>
                        {t.status !== "Done" ? (
                          <button onClick={() => advance(t)} className="mt-3 w-full rounded-full border border-border bg-glass px-2.5 py-1 text-[0.7rem] text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">Advance →</button>
                        ) : (
                          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="size-3.5" /> Done</div>
                        )}
                      </div>
                    ),
                  )}
                  {list.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ChatMsg = { role: "ai" | "user"; text: string };
const assistantPrompts = ["How many PTO days do I have?", "What are my tasks today?", "Who's on call this weekend?", "Start onboarding a new hire"];

function AssistantView() {
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "ai", text: "Hi! I'm your work assistant. Ask me about your tasks, schedule, PTO, policies, or getting a new hire set up." }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);
  const answerFor = (q: string) => {
    const s = q.toLowerCase();
    if (s.includes("pto") || s.includes("vacation")) return "You have 14 PTO days remaining this year, plus 3 sick days. Want me to draft a request?";
    if (s.includes("task")) return "Today you have 3 tasks: launch the referral sequence (high), review the Q3 supplier contract, and resolve the top 5 support tickets.";
    if (s.includes("call") || s.includes("weekend")) return "This weekend Noah Reed covers fulfilment and Sam Idris is on support. No gaps detected.";
    if (s.includes("onboard") || s.includes("hire")) return "I'll set up a new-hire checklist: accounts, role & permissions, a training path, and a buddy. Who are we onboarding?";
    return "I've noted that. I can help with tasks, scheduling, PTO, policies, and onboarding — just say the word.";
  };
  function send(text: string) { const q = text.trim(); if (!q || thinking) return; setMessages((m) => [...m, { role: "user", text: q }]); setInput(""); setThinking(true); window.setTimeout(() => { setThinking(false); setMessages((m) => [...m, { role: "ai", text: answerFor(q) }]); }, 1200); }
  return (
    <Reveal>
      <GlassCard className="glass-strong mx-auto flex h-[32rem] max-w-3xl flex-col p-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Bot className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
          <div><p className="text-sm font-semibold tracking-tight">Staff Assistant</p><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-400" /> Here to help you succeed</p></div>
        </div>
        <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (<div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}><div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-br-sm bg-glass text-foreground/90" : "rounded-bl-sm border border-border bg-background/40 text-foreground/85")}>{m.text}</div></div>))}
          {thinking && <div className="flex justify-start"><div className="typing flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background/40 px-3.5 py-3"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div></div>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{assistantPrompts.map((p) => <button key={p} onClick={() => send(p)} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground">{p}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your assistant…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
          <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="grid size-8 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}><Send className="size-3.5" stroke="oklch(0.2 0.02 70)" /></button>
        </form>
      </GlassCard>
    </Reveal>
  );
}

/** "09:00" -> "9a", "17:30" -> "5:30p" — compact 12h display for the grid. */
function fmtShiftTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "p" : "a";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${period}` : `${h12}${period}`;
}

function ShiftCell({
  shift,
  onSave,
}: {
  shift: DbShift | undefined;
  onSave: (patch: { start_time: string | null; end_time: string | null; is_off: boolean }) => Promise<{ error: Error | null }>;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(shift?.start_time ?? "09:00");
  const [end, setEnd] = useState(shift?.end_time ?? "17:00");
  const [off, setOff] = useState(shift?.is_off ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setStart(shift?.start_time ?? "09:00");
    setEnd(shift?.end_time ?? "17:00");
    setOff(shift?.is_off ?? false);
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await onSave({ start_time: off ? null : start, end_time: off ? null : end, is_off: off });
    setSaving(false);
    if (err) setError(err.message);
    else setEditing(false);
  };

  // Renders inline (normal document flow, not absolutely positioned) so it can
  // never be clipped by the table's horizontal-scroll container — an
  // overflow-x-auto ancestor silently clips vertical overflow too, which cut
  // off the Save button when this was an absolute overlay. The row simply
  // grows a bit taller while a cell is being edited.
  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-gold/40 bg-background p-2 shadow-lg">
        <label className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
          <input type="checkbox" checked={off} onChange={(e) => setOff(e.target.checked)} className="size-3 accent-[oklch(0.84_0.14_84)]" /> Off
        </label>
        {!off && (
          <div className="flex flex-col gap-1">
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded border border-border bg-background/60 px-1 py-1 text-[0.65rem] text-foreground outline-none" />
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded border border-border bg-background/60 px-1 py-1 text-[0.65rem] text-foreground outline-none" />
          </div>
        )}
        {error && <p className="text-[0.6rem] leading-tight text-rose-300">{error}</p>}
        <div className="flex gap-1">
          <button onClick={save} disabled={saving} className="flex-1 rounded bg-gold/90 py-1 text-[0.65rem] font-semibold text-background">{saving ? "…" : "Save"}</button>
          <button onClick={() => setEditing(false)} className="flex-1 rounded border border-border py-1 text-[0.65rem] text-muted-foreground">Cancel</button>
        </div>
      </div>
    );
  }

  const label = shift?.is_off ? "Off" : shift?.start_time && shift?.end_time ? `${fmtShiftTime(shift.start_time)}–${fmtShiftTime(shift.end_time)}` : "—";
  return (
    <button
      onClick={open}
      className="relative grid h-8 w-full place-items-center rounded-lg text-xs tabular-nums transition-colors hover:border hover:border-gold/40"
      style={{ background: shift?.is_off || !shift ? "transparent" : "oklch(0.84 0.14 84 / 12%)", color: !shift || shift.is_off ? "var(--color-muted-foreground)" : "var(--color-foreground)" }}
    >
      {label}
    </button>
  );
}

function ScheduleView() {
  const { org } = useOrg();
  const { employees, loading: employeesLoading } = useEmployeesData();
  const [shifts, setShifts] = useState<DbShift[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) { setShifts([]); setLoading(false); return; }
    setLoading(true);
    setShifts(await listShifts(org.id));
    setLoading(false);
  }, [org?.id]);
  useEffect(() => { void load(); }, [load]);

  const setCell = async (employeeId: string, day: Weekday, patch: { start_time: string | null; end_time: string | null; is_off: boolean }) => {
    if (!org) return { error: new Error("No active workspace.") };
    const { error } = await upsertShift(org.id, employeeId, day, patch);
    await load();
    return { error };
  };

  if (!employeesLoading && employees.length === 0) {
    return (
      <GlassCard className="p-8 text-center sm:p-10">
        <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
          <CalendarDays className="size-6" stroke="oklch(0.2 0.02 70)" />
        </span>
        <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>No one to schedule yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Add employees in the People tab, then set their weekly shifts here.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <Reveal>
        <GlassCard className="overflow-x-auto p-6">
          <div className="flex items-baseline justify-between">
            <SectionLabel icon={CalendarDays}>This week</SectionLabel>
            <span className="text-xs text-muted-foreground">Click a cell to set hours</span>
          </div>
          <div className="mt-4 min-w-[54rem]">
            <div className="grid grid-cols-[8rem_repeat(7,1fr)] gap-2 border-b border-border pb-2 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              <span>Member</span>{WEEKDAYS.map((d) => <span key={d} className="text-center">{d}</span>)}
            </div>
            {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
            {!loading && employees.map((emp) => (
              <div key={emp.id} className="grid grid-cols-[8rem_repeat(7,1fr)] items-start gap-2 border-b border-border/60 py-2.5">
                <span className="flex items-center gap-2 text-sm text-foreground/85"><Avatar name={emp.name} className="size-6 text-[0.55rem]" /> {emp.name.split(" ")[0]}</span>
                {WEEKDAYS.map((day) => (
                  <div key={day} className="relative">
                    <ShiftCell shift={shifts.find((s) => s.employee_id === emp.id && s.day === day)} onSave={(patch) => setCell(emp.id, day, patch)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function PerformanceView() {
  const { tasks, loading } = useTasksData();

  if (!loading && tasks.length === 0) {
    return (
      <GlassCard className="p-8 text-center sm:p-10">
        <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
          <Gauge className="size-6" stroke="oklch(0.2 0.02 70)" />
        </span>
        <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>No performance data yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Add and complete tasks in the Tasks tab — completion rate, on-time rate and a real trend build up here.</p>
      </GlassCard>
    );
  }

  const done = tasks.filter((t) => t.status === "Done");
  const open = tasks.length - done.length;
  const completionRate = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;

  const period = new Date().toISOString().slice(0, 7);
  const doneThisMonth = done.filter((t) => (t.completed_at ?? "").slice(0, 7) === period).length;

  // On-time rate only counts completed tasks that HAD a due date — nothing to
  // judge "on time" against otherwise.
  const doneWithDue = done.filter((t) => t.due_date && t.completed_at);
  const onTime = doneWithDue.filter((t) => new Date(t.completed_at!) <= new Date(t.due_date + "T23:59:59"));
  const onTimeRate = doneWithDue.length ? Math.round((onTime.length / doneWithDue.length) * 100) : null;

  // Real completions per week, last 8 weeks (from actual completed_at timestamps).
  const weeks = 8;
  const buckets = new Array(weeks).fill(0);
  const now = new Date();
  for (const t of done) {
    if (!t.completed_at) continue;
    const diffDays = Math.floor((now.getTime() - new Date(t.completed_at).getTime()) / 864e5);
    const w = Math.floor(diffDays / 7);
    if (w >= 0 && w < weeks) buckets[weeks - 1 - w]++;
  }
  const hasTrend = buckets.some((v) => v > 0);

  // Most tasks completed, by assignee — an honest ranking (a count, not a
  // fabricated "performance score").
  const counts = new Map<string, number>();
  for (const t of done) if (t.assignee_name) counts.set(t.assignee_name, (counts.get(t.assignee_name) ?? 0) + 1);
  const topDoers = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));
  const maxDoer = Math.max(1, ...topDoers.map((t) => t.value));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Completion rate" value={completionRate} suffix="%" icon={Gauge} />
        <StatTile label="Tasks completed (mo)" value={doneThisMonth} icon={CheckCircle2} />
        <StatTile label="Total tasks" value={tasks.length} icon={Award} />
        <StatTile label="Open tasks" value={open} positive={open === 0} icon={LayoutGrid} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <div className="flex items-baseline justify-between">
              <SectionLabel icon={TrendingUp}>Tasks completed per week</SectionLabel>
              <span className="text-xs text-muted-foreground">{onTimeRate !== null ? <><span className="text-gold">{onTimeRate}%</span> on-time · </> : null}Last 8 weeks</span>
            </div>
            {hasTrend ? <div className="mt-6"><Bars data={buckets} /></div> : <p className="py-10 text-center text-sm text-muted-foreground">Complete a few tasks and this trend fills in.</p>}
          </GlassCard>
        </Reveal>
        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Award}>Most tasks completed</SectionLabel>
            {topDoers.length > 0 ? (
              <div className="mt-5 space-y-4">
                {topDoers.map((l) => (
                  <div key={l.label}>
                    <div className="flex items-baseline justify-between text-sm"><span className="truncate text-foreground/85">{l.label}</span><span className="ml-2 shrink-0 tabular-nums text-gold">{l.value}</span></div>
                    <div className="mt-1.5"><Bar value={(l.value / maxDoer) * 100} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-center text-sm text-muted-foreground">No completed, assigned tasks yet.</p>
            )}
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}

const TRN_INPUT = "w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50";

function CourseCard({
  course,
  employees,
  progress,
  onAssign,
  onUnassign,
  onToggle,
  onEdit,
  onDelete,
}: {
  course: DbCourse;
  employees: DbEmployee[];
  progress: DbProgress[]; // this course's assignments only
  onAssign: (employeeId: string) => void;
  onUnassign: (progressId: string) => void;
  onToggle: (employeeId: string, completed: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pickEmployee, setPickEmployee] = useState("");
  const assignedIds = new Set(progress.map((p) => p.employee_id));
  const unassigned = employees.filter((e) => !assignedIds.has(e.id));
  const doneCount = progress.filter((p) => p.completed).length;
  const pct = progress.length ? Math.round((doneCount / progress.length) * 100) : 0;

  const assign = () => {
    if (!pickEmployee) return;
    onAssign(pickEmployee);
    setPickEmployee("");
  };

  return (
    <GlassCard className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-2xl border border-border bg-glass"><GraduationCap className="size-5 text-gold" /></span>
        <div className="flex items-center gap-1.5">
          {course.category && <span className="rounded-full border border-border bg-glass px-2.5 py-0.5 text-[0.65rem] text-muted-foreground">{course.category}</span>}
          <button onClick={onEdit} aria-label="Edit course" className="grid size-6 place-items-center rounded-lg border border-border text-muted-foreground hover:border-gold/40 hover:text-foreground"><Pencil className="size-3" /></button>
          <button onClick={onDelete} aria-label="Delete course" className="grid size-6 place-items-center rounded-lg border border-border text-muted-foreground hover:border-rose-400/50 hover:text-rose-300"><Trash2 className="size-3" /></button>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{course.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{course.lessons} lesson{course.lessons === 1 ? "" : "s"}</p>
      <div className="mt-4">
        {progress.length > 0 ? (
          <>
            <div className="flex items-baseline justify-between text-xs"><span className="text-muted-foreground">{doneCount} of {progress.length} assigned completed</span><span className="tabular-nums text-gold">{pct}%</span></div>
            <div className="mt-1.5"><Bar value={pct} /></div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Not assigned to anyone yet.</p>
        )}
      </div>
      <button onClick={() => setExpanded((v) => !v)} className="mt-4 flex items-center justify-center gap-2 rounded-full border border-border bg-glass px-4 py-2 text-xs text-foreground/80 transition-colors hover:border-gold/40">
        {expanded ? "Hide" : "Manage"} assignments
      </button>
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {progress.length === 0 && <p className="text-center text-xs text-muted-foreground">No one assigned yet.</p>}
            {progress.map((p) => {
              const emp = employees.find((e) => e.id === p.employee_id);
              return (
                <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-glass">
                  <input type="checkbox" checked={p.completed} onChange={(ev) => onToggle(p.employee_id, ev.target.checked)} className="size-3.5 accent-[oklch(0.84_0.14_84)]" />
                  <Avatar name={emp?.name ?? "?"} className="size-5 text-[0.55rem]" />
                  <span className={cn("flex-1 truncate", p.completed ? "text-foreground" : "text-muted-foreground")}>{emp?.name ?? "Unknown"}</span>
                  {p.completed && <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />}
                  <button onClick={() => onUnassign(p.id)} aria-label="Unassign" className="shrink-0 text-muted-foreground hover:text-rose-300"><X className="size-3.5" /></button>
                </div>
              );
            })}
          </div>
          {unassigned.length > 0 && (
            <div className="flex gap-2">
              <select value={pickEmployee} onChange={(e) => setPickEmployee(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background/40 px-2 py-1.5 text-xs text-foreground outline-none focus:border-gold/50">
                <option value="">Assign to…</option>
                {unassigned.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button onClick={assign} disabled={!pickEmployee} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>Assign</button>
            </div>
          )}
          {employees.length === 0 && <p className="text-center text-xs text-muted-foreground">Add employees in the People tab first.</p>}
        </div>
      )}
    </GlassCard>
  );
}

function CourseForm({ initial, onCancel, onSave, saving }: { initial?: Partial<NewCourse>; onCancel: () => void; onSave: (c: NewCourse) => Promise<{ error: Error | null }>; saving: boolean }) {
  const [f, setF] = useState({ title: initial?.title ?? "", category: initial?.category ?? "", lessons: String(initial?.lessons ?? 1) });
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!f.title.trim()) return;
    setError(null);
    const { error: err } = await onSave({ title: f.title.trim(), category: f.category.trim() || undefined, lessons: Math.max(1, Number(f.lessons) || 1) });
    if (err) setError(err.message);
  };
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-2">
      <input value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} placeholder="Course title *" className={cn(TRN_INPUT, "sm:col-span-2")} />
      <input value={f.category} onChange={(e) => setF((x) => ({ ...x, category: e.target.value }))} placeholder="Category (e.g. Sales)" className={TRN_INPUT} />
      <input type="number" min={1} value={f.lessons} onChange={(e) => setF((x) => ({ ...x, lessons: e.target.value }))} placeholder="Lessons" className={TRN_INPUT} />
      {error && <p className="text-xs text-rose-300 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button onClick={submit} disabled={!f.title.trim() || saving} className="rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{saving ? "Saving…" : "Save course"}</button>
        <button onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}

function AssignmentsTable({
  progress,
  employees,
  courses,
  onToggle,
  onUnassign,
}: {
  progress: DbProgress[];
  employees: DbEmployee[];
  courses: DbCourse[];
  onToggle: (courseId: string, employeeId: string, completed: boolean) => void;
  onUnassign: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"All" | "Pending" | "Completed">("All");
  const rows = progress
    .filter((p) => filter === "All" || (filter === "Completed" ? p.completed : !p.completed))
    .map((p) => ({ p, emp: employees.find((e) => e.id === p.employee_id), course: courses.find((c) => c.id === p.course_id) }))
    .sort((a, b) => new Date(b.p.assigned_at).getTime() - new Date(a.p.assigned_at).getTime());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["All", "Pending", "Completed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", filter === f ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground")} style={filter === f ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
            {f}
          </button>
        ))}
      </div>
      <GlassCard className="p-4 sm:p-6">
        {rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No assignments{filter !== "All" ? ` (${filter.toLowerCase()})` : ""} yet.</p>}
        <div className="space-y-1">
          {rows.map(({ p, emp, course }) => (
            <div key={p.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-glass sm:grid-cols-[auto_1fr_1fr_auto_auto_auto]">
              <Avatar name={emp?.name ?? "?"} className="size-7 text-[0.6rem]" />
              <span className="truncate text-sm text-foreground/90">{emp?.name ?? "Unknown"}</span>
              <span className="hidden truncate text-sm text-muted-foreground sm:block">{course?.title ?? "Unknown course"}</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium", p.completed ? "text-emerald-400" : "text-gold")} style={{ background: p.completed ? "oklch(0.72 0.14 155 / 14%)" : "oklch(0.84 0.14 84 / 12%)" }}>
                {p.completed ? "Completed" : "Pending"}
              </span>
              <button onClick={() => onToggle(p.course_id, p.employee_id, !p.completed)} className="rounded-full border border-border px-2.5 py-1 text-[0.65rem] text-foreground/80 transition-colors hover:border-gold/40">
                {p.completed ? "Mark pending" : "Mark done"}
              </button>
              <button onClick={() => onUnassign(p.id)} aria-label="Unassign" className="grid size-6 place-items-center rounded-lg border border-border text-muted-foreground hover:border-rose-400/50 hover:text-rose-300"><X className="size-3.5" /></button>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function TrainingView() {
  const { org } = useOrg();
  const { employees } = useEmployeesData();
  const [tab, setTab] = useState<"courses" | "assignments">("courses");
  const [courses, setCourses] = useState<DbCourse[]>([]);
  const [progress, setProgressList] = useState<DbProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!org) { setCourses([]); setProgressList([]); setLoading(false); return; }
    setLoading(true);
    const [c, p] = await Promise.all([listCourses(org.id), listProgress(org.id)]);
    setCourses(c);
    setProgressList(p);
    setLoading(false);
  }, [org?.id]);
  useEffect(() => { void load(); }, [load]);

  const save = async (c: NewCourse) => {
    if (!org) return { error: new Error("No active workspace.") };
    setBusy(true);
    const { error } = editingId ? await updateCourse(editingId, c) : await createCourse(org.id, c);
    setBusy(false);
    if (!error) { setAdding(false); setEditingId(null); }
    await load();
    return { error };
  };
  const remove = async (id: string) => { await deleteCourse(id); await load(); };
  const toggle = async (courseId: string, employeeId: string, completed: boolean) => {
    if (!org) return;
    await setProgress(org.id, courseId, employeeId, completed);
    await load();
  };
  const assign = async (courseId: string, employeeId: string) => {
    if (!org) return;
    await assignTraining(org.id, courseId, employeeId);
    await load();
  };
  const unassign = async (progressId: string) => {
    await unassignTraining(progressId);
    await load();
  };

  // Real, honest stats — teamCompletion is over actual assignments (not every
  // course x employee pair, since courses no longer implicitly apply to
  // everyone); fullyTrained excludes anyone with zero assignments (otherwise
  // an employee assigned nothing would vacuously count as "fully trained").
  const teamCompletion = progress.length ? Math.round((progress.filter((p) => p.completed).length / progress.length) * 100) : 0;
  const fullyTrained = employees.filter((e) => {
    const mine = progress.filter((p) => p.employee_id === e.id);
    return mine.length > 0 && mine.every((p) => p.completed);
  }).length;
  const pendingCount = progress.filter((p) => !p.completed).length;

  if (!loading && courses.length === 0 && !adding) {
    return (
      <GlassCard className="p-8 text-center sm:p-10">
        <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
          <GraduationCap className="size-6" stroke="oklch(0.2 0.02 70)" />
        </span>
        <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>No courses yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Add your first training course, then assign it to whoever needs it.</p>
        <button onClick={() => setAdding(true)} className="mt-6 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] mx-auto" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
          <Plus className="size-4" /> New course
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label="Courses" value={courses.length} icon={GraduationCap} />
        <StatTile label="Team completion" value={teamCompletion} suffix="%" icon={Target} />
        <StatTile label="Pending" value={pendingCount} positive={pendingCount === 0} icon={Play} />
        <StatTile label="Fully trained" value={fullyTrained} icon={CheckCircle2} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button onClick={() => setTab("courses")} className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", tab === "courses" ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground")} style={tab === "courses" ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>Courses</button>
          <button onClick={() => setTab("assignments")} className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", tab === "assignments" ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground")} style={tab === "assignments" ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>Assignments</button>
        </div>
        {tab === "courses" && (
          <button onClick={() => { setAdding((a) => !a); setEditingId(null); }} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
            <Plus className="size-3.5" /> New course
          </button>
        )}
      </div>

      {tab === "courses" ? (
        <>
          {adding && <CourseForm onCancel={() => setAdding(false)} onSave={save} saving={busy} />}
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((c, i) =>
              editingId === c.id ? (
                <CourseForm key={c.id} initial={c} onCancel={() => setEditingId(null)} onSave={save} saving={busy} />
              ) : (
                <Reveal key={c.id} delay={i * 50} className="h-full">
                  <CourseCard
                    course={c}
                    employees={employees}
                    progress={progress.filter((p) => p.course_id === c.id)}
                    onAssign={(empId) => assign(c.id, empId)}
                    onUnassign={unassign}
                    onToggle={(empId, completed) => toggle(c.id, empId, completed)}
                    onEdit={() => { setEditingId(c.id); setAdding(false); }}
                    onDelete={() => remove(c.id)}
                  />
                </Reveal>
              ),
            )}
          </div>
        </>
      ) : (
        <AssignmentsTable progress={progress} employees={employees} courses={courses} onToggle={toggle} onUnassign={unassign} />
      )}
    </div>
  );
}

function CommsView() {
  const [active, setActive] = useState("operations");
  const [messages, setMessages] = useState(seedMessages);
  const [input, setInput] = useState("");
  const post = () => { const t = input.trim(); if (!t) return; setMessages((m) => [...m, { author: "You", text: t, time: "now" }]); setInput(""); };
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Reveal className="hidden lg:block">
        <GlassCard className="p-4">
          <p className="px-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Channels</p>
          <div className="mt-2 space-y-1">
            {channels.map((c) => (
              <button key={c.name} onClick={() => setActive(c.name)} className={cn("flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors", active === c.name ? "bg-glass text-foreground" : "text-muted-foreground hover:bg-glass hover:text-foreground")}>
                <Hash className="size-3.5 shrink-0" /><span className="flex-1 truncate">{c.name}</span>{c.unread > 0 && <span className="rounded-full bg-gold/20 px-1.5 text-[0.6rem] text-gold">{c.unread}</span>}
              </button>
            ))}
          </div>
        </GlassCard>
      </Reveal>

      <Reveal>
        <GlassCard className="flex h-[32rem] flex-col p-6">
          <div className="flex items-center gap-2 border-b border-border pb-4"><Hash className="size-4 text-gold" /><p className="text-sm font-semibold">{active}</p></div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-gold/25 bg-glass p-3"><Megaphone className="size-4 shrink-0 text-gold" /><p className="text-xs text-foreground/80">Pinned: All-hands Friday 10 AM. AI notes will be shared after.</p></div>
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div key={i} className="flex gap-3">
                <Avatar name={m.author === "You" ? "Y O" : m.author} />
                <div className="min-w-0"><p className="flex items-center gap-2 text-sm"><span className="font-medium text-foreground">{m.author}</span><span className="text-[0.65rem] text-muted-foreground">{m.time}</span></p><p className="mt-0.5 text-sm text-foreground/85">{m.text}</p></div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); post(); }} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Message #${active}…`} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
            <button type="submit" aria-label="Send" disabled={!input.trim()} className="grid size-8 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}><Send className="size-3.5" stroke="oklch(0.2 0.02 70)" /></button>
          </form>
        </GlassCard>
      </Reveal>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Workspace shell
 * ─────────────────────────────────────────────────────────────────── */

const viewMeta: Record<ViewKey, { title: string; sub: string }> = {
  dashboard: { title: "Team Operations", sub: "An assistant for every employee" },
  people: { title: "People", sub: "Your team, at a glance" },
  tasks: { title: "AI task management", sub: "Work that moves itself forward" },
  assistant: { title: "Staff assistant", sub: "Help for everyone, on tap" },
  schedule: { title: "Scheduling intelligence", sub: "The right people at the right time" },
  performance: { title: "Performance analytics", sub: "How the team is growing" },
  training: { title: "Training center", sub: "Level up every skill" },
  comms: { title: "Internal communication", sub: "Keep everyone in sync" },
};

export function TeamWorkspace() {
  return (
    <EmployeesProvider>
      <TasksProvider>
        <TeamWorkspaceInner />
      </TasksProvider>
    </EmployeesProvider>
  );
}

function TeamWorkspaceInner() {
  const [active, setActive] = useState<ViewKey>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const meta = viewMeta[active];
  const open = (id: string) => { setSelectedId(id); setActive("people"); };
  return (
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
        <Brand subtle />
        <p className="mt-6 flex items-center gap-1.5 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-gold"><UsersRound className="size-3" /> Team Ops</p>
        <nav className="mt-2 space-y-1 overflow-y-auto">
          {views.map((v) => (
            <button key={v.key} onClick={() => { setActive(v.key); if (v.key !== "people") setSelectedId(null); }} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active === v.key ? "text-foreground" : "text-muted-foreground hover:bg-glass hover:text-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
              <v.icon className={cn("size-4", active === v.key && "text-gold")} />
              {v.label}
            </button>
          ))}
        </nav>
        <Link to="/dashboard" className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground"><ArrowLeft className="size-4" /> Command center</Link>
      </aside>

      <section className="min-w-0 flex-1 space-y-5">
        <div className="rise flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{meta.sub}</p>
            <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}><span className="gold-text italic">{meta.title}</span></h1>
          </div>
          <button onClick={() => setActive("assistant")} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}><Bot className="size-4" stroke="oklch(0.2 0.02 70)" /> Staff assistant</button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {views.map((v) => (
            <button key={v.key} onClick={() => { setActive(v.key); if (v.key !== "people") setSelectedId(null); }} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors", active === v.key ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
              <v.icon className="size-3.5" />{v.label}
            </button>
          ))}
        </div>

        <div key={active + (selectedId ?? "")} className="rise">
          {active === "dashboard" && <DashboardView open={open} />}
          {active === "people" && <PeopleView selectedId={selectedId} onSelect={setSelectedId} />}
          {active === "tasks" && <TasksView />}
          {active === "assistant" && <AssistantView />}
          {active === "schedule" && <ScheduleView />}
          {active === "performance" && <PerformanceView />}
          {active === "training" && <TrainingView />}
          {active === "comms" && <CommsView />}
        </div>
      </section>
    </div>
  );
}
