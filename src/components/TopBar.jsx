import { Search, Plus, X, Package } from "lucide-react";
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
  requestsOnly,
  setRequestsOnly,
  requestCount,
  saving,
  onNew,
  searchRef,
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {titleColor && (
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: titleColor }} />
          )}
          <h1 className="truncate text-xl font-bold tracking-tight text-ink lg:text-2xl">
            {title}
          </h1>
          {saving && <Spinner />}
        </div>
        <p className="mt-1 font-mono text-xs text-stone-500">
          <span className="text-stone-600 tnum">{stats.active}</span> ativas ·{" "}
          <span className="text-stone-600 tnum">{stats.done}</span> concluídas
          {stats.overdue > 0 && (
            <span className="text-danger">
              {" "}· <span className="tnum">{stats.overdue}</span> atrasadas
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative sm:w-44">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…  ( / )"
            className="w-full rounded-lg border border-ink/15 bg-ink/[0.03] py-2 pl-9 pr-7 text-sm text-ink outline-none transition-colors placeholder:text-stone-400 focus:border-action"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-ink"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Material-requests filter */}
          <button
            onClick={() => setRequestsOnly(!requestsOnly)}
            title="Mostrar só cards com solicitação em aberto"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 font-mono text-[11px] font-semibold transition-colors ${
              requestsOnly
                ? "border-warning/50 bg-warning/15 text-warning"
                : "border-ink/15 text-stone-500 hover:text-ink"
            }`}
          >
            <Package size={13} /> {requestCount > 0 ? requestCount : ""}
            <span className="hidden sm:inline">
              {requestCount === 1 ? "solicitação" : "solicitações"}
            </span>
          </button>

          {/* Priority filter */}
          <div className="flex flex-1 items-center gap-1 overflow-x-auto rounded-lg border border-ink/15 bg-ink/[0.03] p-0.5 sm:flex-none">
            {["all", ...Object.keys(PRIORITY)].map((p) => {
              const active = priorityFilter === p;
              const label = p === "all" ? "Todas" : PRIORITY[p].label;
              return (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                    active ? "bg-action text-clay" : "text-stone-500 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            onClick={onNew}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-action px-3 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action sm:px-4"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Nova tarefa</span>
          </button>
        </div>
      </div>
    </header>
  );
}
