import { PRIORITY, initials } from "@/lib/constants";

export function Avatar({ name, size = "sm" }) {
  const sz = size === "sm" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[11px]";
  // deterministic hue from name
  const hue = name ? (name.charCodeAt(0) * 47) % 360 : 200;
  return (
    <div
      title={name}
      className={`${sz} shrink-0 rounded-full flex items-center justify-center font-bold text-ink-base ring-1 ring-white/10`}
      style={{ background: `hsl(${hue} 70% 60%)` }}
    >
      {initials(name)}
    </div>
  );
}

export function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] ?? PRIORITY.low;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide"
      style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
      {p.label}
    </span>
  );
}

export function Spinner({ className = "" }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-action/30 border-t-action ${className}`}
    />
  );
}
