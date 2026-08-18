import { useState } from "react";
import { LayoutGrid, Wallet, Briefcase, Newspaper, Sparkles, ShieldCheck, ListChecks, TrendingUp, ChevronsLeft, ChevronsRight, Award, Link2 } from "lucide-react";

// Persistent, collapsible desktop-only app-level navigation — distinct from
// the project-filter <Sidebar/> shown inside the board view. Replaces the
// old pattern where Admin/Finance/Commercial/Blog opened as centered modal
// popups; those are now full-screen views switched via `view`, and this
// rail is how you get between them without losing horizontal space on the
// board (see App.jsx — collapse state defaults to true whenever `view`
// becomes "board", overriding whatever the user had set elsewhere, but
// stays independently toggleable while there).
const NAV_ITEMS = [
  { key: "board", label: "Projetos", icon: LayoutGrid, show: () => true },
  { key: "todos", label: "Minhas tarefas", icon: ListChecks, show: () => true },
  { key: "journey", label: "Jornada", icon: Award, show: () => true },
  { key: "meetings", label: "Reuniões", icon: Sparkles, show: () => true },
  { key: "finance", label: "Financeiro", icon: Wallet, show: (p) => p.financeAccess },
  { key: "commercial", label: "Comercial", icon: Briefcase, show: () => true },
  { key: "crm", label: "CRM", icon: TrendingUp, show: (p) => p.crmRole },
  { key: "links", label: "Links", icon: Link2, show: (p) => p.crmRole },
  { key: "blog", label: "Conteúdo", icon: Newspaper, show: (p) => p.isAdmin },
  { key: "admin", label: "Admin", icon: ShieldCheck, show: (p) => p.isAdmin },
];

export default function AppSidebar({ view, onNavigate, collapsed, onToggleCollapse, isAdmin, financeAccess, crmRole }) {
  const perms = { isAdmin, financeAccess, crmRole };
  const [hovered, setHovered] = useState(false);
  // "Peeking": pinned collapsed but temporarily shown wide via hover — does
  // not touch the persisted `collapsed` preference, but DOES reflow the
  // content beside it (the wrapper's own width tracks `expanded`, same as
  // the aside inside it, so there's no absolute-positioned overlay for the
  // board to hide behind).
  const peeking = collapsed && hovered;
  const expanded = !collapsed || peeking;

  return (
    <div
      className={`hidden shrink-0 transition-[width] duration-200 lg:block ${expanded ? "w-52" : "w-14"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <aside
        className={`flex h-full w-full flex-col border-r border-ink/10 py-3 transition-colors duration-150 ${
          peeking ? "bg-clay shadow-2xl" : "bg-clay/60"
        }`}
      >
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.filter((item) => item.show(perms)).map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                title={expanded ? undefined : item.label}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                  active ? "bg-action/10 text-action" : "text-stone-500 hover:bg-ink/[0.05] hover:text-ink"
                }`}
              >
                <Icon size={17} className="shrink-0" />
                {expanded && <span className="truncate font-mono text-[11px] tracking-wide">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <button
          onClick={onToggleCollapse}
          title={expanded ? undefined : collapsed ? "Expandir menu" : "Recolher menu"}
          className="mx-2 flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-stone-400 transition-colors hover:bg-ink/[0.05] hover:text-ink"
        >
          {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          {expanded && <span className="font-mono text-[11px] tracking-wide">recolher</span>}
        </button>
      </aside>
    </div>
  );
}
