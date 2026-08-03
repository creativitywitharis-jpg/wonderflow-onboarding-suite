import { Link } from "@tanstack/react-router";

export function Mark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-[0.7rem] ${className}`}
      style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-1/2"
        fill="none"
        stroke="oklch(0.2 0.02 70)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 7l3.5 10L12 8l5.5 9L21 7" />
      </svg>
    </span>
  );
}

export function Brand({ subtle = false }: { subtle?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      <Mark />
      <span className="flex flex-col leading-none">
        <span className="text-[0.95rem] font-semibold tracking-tight text-foreground">
          WonderFlow <span className="gold-text">OS</span>
        </span>
        {!subtle && (
          <span className="mt-1 text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground">
            Business Intelligence
          </span>
        )}
      </span>
    </Link>
  );
}