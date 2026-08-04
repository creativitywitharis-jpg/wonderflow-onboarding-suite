import type { ReactNode } from "react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { useCountUp } from "@/hooks/use-count-up";
import { useInView } from "@/hooks/use-in-view";

/**
 * Shared visual + motion primitives for WonderFlow OS modules.
 * Keep module-agnostic so the dashboard, CRM, automation, etc. stay consistent.
 */

export function formatNum(v: number, decimals = 0) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Blur-rise wrapper that animates when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={cn("reveal", inView && "reveal-in", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {Icon && <Icon className="size-4 text-gold" />}
      {children}
    </h2>
  );
}

export function Delta({ value, positive = true }: { value: string; positive?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        positive ? "text-emerald-300" : "text-rose-300",
      )}
      style={{
        background: positive ? "oklch(0.72 0.14 155 / 12%)" : "oklch(0.65 0.2 22 / 14%)",
      }}
    >
      <ArrowUpRight className={cn("size-3", !positive && "rotate-90")} />
      {value}
    </span>
  );
}

/** Compact SVG sparkline with gradient fill + draw-in animation. */
export function Sparkline({ data, id }: { data: number[]; id: string }) {
  const w = 120;
  const h = 40;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.84 0.14 84 / 28%)" />
          <stop offset="100%" stopColor="oklch(0.84 0.14 84 / 0%)" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="spark-draw"
      />
    </svg>
  );
}

/** Animated progress bar that grows when scrolled into view. */
export function Bar({ value, tone = "gold" }: { value: number; tone?: "gold" | "muted" }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className="h-1.5 overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full transition-[width] duration-1000 ease-out"
        style={{
          width: inView ? `${value}%` : "0%",
          background: tone === "gold" ? "var(--gradient-gold)" : "oklch(0.7 0.015 85 / 60%)",
        }}
      />
    </div>
  );
}

/** KPI tile: icon, count-up value, optional delta badge. */
export function StatTile({
  label,
  value,
  prefix,
  suffix,
  decimals,
  delta,
  positive = true,
  icon: Icon,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delta?: string;
  positive?: boolean;
  icon: LucideIcon;
}) {
  const { ref, inView } = useInView();
  const v = useCountUp(value, { start: inView });
  return (
    <div ref={ref} className={cn("reveal h-full", inView && "reveal-in")}>
      <GlassCard className="lift h-full p-5 hover:border-gold/40">
        <div className="flex items-center justify-between">
          <span className="grid size-9 place-items-center rounded-xl border border-border bg-glass">
            <Icon className="size-4 text-gold" />
          </span>
          {delta && <Delta value={delta} positive={positive} />}
        </div>
        <p className="mt-4 text-2xl font-semibold tabular-nums">
          {prefix}
          {formatNum(v, decimals ?? 0)}
          {suffix}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      </GlassCard>
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full border border-border bg-glass text-[0.7rem] font-semibold text-foreground/80",
        className,
      )}
    >
      {initials}
    </span>
  );
}
