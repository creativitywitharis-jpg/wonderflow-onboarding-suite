import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GoldButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}
    />
  );
}

export function GhostButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-glass px-6 py-3 text-sm font-medium text-foreground/85 transition-colors hover:border-gold/40 hover:text-foreground disabled:opacity-40",
        className,
      )}
    />
  );
}

export function GlassCard({
  className,
  children,
  ...props
}: ComponentProps<"div"> & { children?: ReactNode }) {
  return (
    <div {...props} className={cn("glass rounded-3xl", className)}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-glass px-3.5 py-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
      <span className="size-1.5 rounded-full bg-gold orb" />
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-border bg-background/40 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold/50 focus:ring-2 focus:ring-ring";