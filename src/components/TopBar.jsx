import { Search, Plus, X } from "lucide-react";
import { PRIORITY } from "@/lib/constants";
import { Spinner } from "@/components/ui";

export default function TopBar({
  title,
  titleColor,
  stats,
  query,
  setQuery,
  priorityFilter,
  setPriorityFilter,
  saving,
  onNew,
  searchRef,
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex items-center gap-3">
          {titleColor && (
            <span className="h-3 w-3 rounded-full" style={{ background: titleColor }} />
          )}
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {saving && <Spinner />}
        </div>
        <p className="mt-1 font-mono text-xs text-zinc-500">
          <span className="text-zinc-300 tnum">{stats.active}</span> ativas ·{" "}
          <span className="text-zinc-300 tnum">{stats.done}</span> concluídas
          {stats.overdue > 0 && (
            <span className="text-danger">
              {" "}· <span className="tnum">{stats.overdue}</span> atrasadas
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…  ( / )"
            className="w-44 rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-7 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-action focus:w-56"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Priority filter */}
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {["all", ...Object.keys(PRIORITY)].map((p) => {
            const active = priorityFilter === p;
            const label = p === "all" ? "Todas" : PRIORITY[p].label;
            return (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`rounded-md px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                  active ? "bg-action text-ink-base" : "text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <button
          onClick={onNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 text-sm font-bold text-ink-base transition-all hover:brightness-110 ring-action"
        >
          <Plus size={14} /> Nova tarefa
        </button>
      </div>
    </header>
  );
}
