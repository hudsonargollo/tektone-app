import { useState, useEffect, useCallback } from "react";
import { LogOut, LayoutGrid, Users, DollarSign } from "lucide-react";
import { crmApi } from "@/crm/crmApi";
import { Spinner, Avatar } from "@/components/ui";
import Login from "@/components/Login";
import LogoMark from "@/components/LogoMark";
import CrmDashboard from "@/crm/CrmDashboard";
import CrmLeads from "@/crm/CrmLeads";
import CrmLeadDetail from "@/crm/CrmLeadDetail";
import CrmSales from "@/crm/CrmSales";

// Phase D (WhatsApp/URL link manager) adds a "links" entry + CrmWaLinks import here.
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "leads", label: "Pipeline", icon: Users },
  { key: "sales", label: "Vendas", icon: DollarSign },
];

// Root of the CRM (tektone.com.br/crm) — same auth-gate shape as
// PortalApp.jsx, but gated on crm_role (migration 0009_hub_crm.sql)
// instead of access_role. A STAFF/ADMIN account with no crm_role set
// (the default) sees a clear "no access" state rather than the CRM —
// crm_role is opt-in per teammate, not implied by staff access.
export default function CrmApp() {
  const [authed, setAuthed] = useState(null);
  const [crmRole, setCrmRole] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userAvatar, setUserAvatar] = useState(null);
  const [view, setView] = useState({ tab: "dashboard" });

  const refreshMe = useCallback(() => {
    crmApi
      .me()
      .then(({ authed, email, crmRole, name, avatar }) => {
        setAuthed(Boolean(authed));
        setUserEmail(email);
        setCrmRole(crmRole);
        setUserName(name);
        setUserAvatar(avatar);
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  async function logout() {
    await crmApi.logout().catch(() => {});
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <div className="crm-dark flex h-screen items-center justify-center bg-clay">
        <Spinner />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="crm-dark bg-clay">
        <Login onAuthed={refreshMe} />
      </div>
    );
  }

  if (!crmRole) {
    return (
      <div className="crm-dark flex h-screen flex-col items-center justify-center gap-4 bg-clay px-6 text-center">
        <LogoMark className="h-10 w-auto" />
        <p className="text-sm text-stone-500">
          Sua conta ({userEmail}) não tem acesso ao CRM. Peça a um admin para conceder
          um crm_role.
        </p>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-2 font-mono text-[11px] text-stone-500 hover:border-danger/40 hover:text-danger"
        >
          <LogOut size={12} /> sair
        </button>
      </div>
    );
  }

  return (
    <div className="crm-dark flex h-screen flex-col bg-clay lg:flex-row">
      {/* Desktop left sidebar — mirrors the Hub's own AppSidebar pattern
          (icon+label nav rail), dark-themed here instead of collapsible,
          since the CRM only ever has a handful of top-level views. */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-ink/10 bg-clay lg:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <LogoMark className="h-6 w-auto" />
          <span className="font-mono text-[11px] font-semibold tracking-[0.24em] text-ink">CRM</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view.tab === item.key || (item.key === "leads" && view.tab === "lead");
            return (
              <button
                key={item.key}
                onClick={() => setView({ tab: item.key })}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-mono text-[11px] tracking-wide transition-colors ${
                  active ? "bg-action text-clay" : "text-stone-500 hover:bg-ink/[0.05] hover:text-ink"
                }`}
              >
                <Icon size={15} className="shrink-0" /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-ink/10 p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Avatar name={userName || userEmail} src={userAvatar} />
            <span className="truncate font-mono text-[11px] text-stone-500">{userName || userEmail}</span>
          </div>
          <a
            href="/hub"
            className="mb-1.5 flex items-center rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-stone-500 hover:border-action/40"
          >
            ← hub
          </a>
          <button
            onClick={logout}
            className="flex w-full items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-stone-500 hover:border-danger/40 hover:text-danger"
          >
            <LogOut size={12} /> sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar — the sidebar's nav collapses to a horizontal pill
          row here instead (small-screen fallback, same as the rest of the
          Hub distinguishes desktop-rail vs. mobile-bar navigation). */}
      <header className="flex shrink-0 items-center justify-between border-b border-ink/10 bg-clay/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          <LogoMark className="h-6 w-auto" />
          <span className="font-mono text-[11px] font-semibold tracking-[0.24em] text-ink">CRM</span>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-ink/15 p-1.5 text-stone-500 hover:border-danger/40 hover:text-danger"
        >
          <LogOut size={13} />
        </button>
      </header>
      {view.tab !== "lead" && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink/10 bg-clay px-3 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setView({ tab: item.key })}
              className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-[11px] transition-colors ${
                view.tab === item.key ? "bg-action text-clay" : "text-stone-500"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {view.tab === "dashboard" && <CrmDashboard />}
        {view.tab === "leads" && <CrmLeads onOpenLead={(id) => setView({ tab: "lead", leadId: id })} />}
        {view.tab === "lead" && <CrmLeadDetail leadId={view.leadId} onBack={() => setView({ tab: "leads" })} />}
        {view.tab === "sales" && <CrmSales />}
      </div>
    </div>
  );
}
