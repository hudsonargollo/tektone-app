import { LayoutGrid, Wallet, Briefcase, Newspaper, Sparkles, ShieldCheck, ListChecks, TrendingUp, ChevronsLeft, ChevronsRight, Award, Instagram } from "lucide-react";

// Persistent, collapsible desktop-only app-level navigation — distinct from
// the project-filter <Sidebar/> shown inside the board view. Replaces the
// old pattern where Admin/Finance/Commercial/Blog opened as centered modal
// popups; those are now full-screen views switched via `view`, and this
// rail is how you get between them without losing horizontal space on the
// board (see App.jsx — collapse state defaults to true whenever `view`
// becomes "board", overriding whatever the user had set elsewhere, but
// stays independently toggleable while there).
const NAV_ITEMS = [
  { key: "board", label: "Quadro", icon: LayoutGrid, show: () => true },
  { key: "todos", label: "Minhas tarefas", icon: ListChecks, show: () => true },
  { key: "journey", label: "Jornada", icon: Award, show: () => true },
  { key: "meetings", label: "Reuniões", icon: Sparkles, show: () => true },
  { key: "finance", label: "Financeiro", icon: Wallet, show: (p) => p.financeAccess },
  { key: "commercial", label: "Comercial", icon: Briefcase, show: () => true },
  { key: "blog", label: "Blog", icon: Newspaper, show: (p) => p.isAdmin },
  { key: "social", label: "Posts", icon: Instagram, show: () => true },
  { key: "admin", label: "Admin", icon: ShieldCheck, show: (p) => p.isAdmin },
];

export default function AppSidebar({ view, onNavigate, collapsed, onToggleCollapse, isAdmin, financeAccess, crmRole }) {
  const perms = { isAdmin, financeAccess, crmRole };

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-ink/10 bg-clay/60 py-3 transition-[width] duration-200 lg:flex ${
        collapsed ? "w-14" : "w-52"
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
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                active ? "bg-action/10 text-action" : "text-stone-500 hover:bg-ink/[0.05] hover:text-ink"
              }`}
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span className="truncate font-mono text-[11px] tracking-wide">{item.label}</span>}
            </button>
          );
        })}
        {crmRole && (
          <a
            href="/crm"
            title={collapsed ? "CRM" : undefined}
            className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <TrendingUp size={17} className="shrink-0" />
            {!collapsed && <span className="truncate font-mono text-[11px] tracking-wide">CRM</span>}
          </a>
        )}
      </nav>

      <button
        onClick={onToggleCollapse}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        className="mx-2 flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-stone-400 transition-colors hover:bg-ink/[0.05] hover:text-ink"
      >
        {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
        {!collapsed && <span className="font-mono text-[11px] tracking-wide">recolher</span>}
      </button>
    </aside>
  );
}
