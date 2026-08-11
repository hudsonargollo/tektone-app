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
      <div className="flex h-screen items-center justify-center bg-clay">
        <Spinner />
      </div>
    );
  }

  if (!authed) return <Login onAuthed={refreshMe} />;

  if (!crmRole) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-clay px-6 text-center">
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
    <div className="flex min-h-screen flex-col bg-clay">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink/10 bg-clay/80 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2">
          <LogoMark className="h-7 w-auto" />
          <span className="text-sm font-semibold tracking-[0.28em] text-ink">TEKTONE CRM</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 sm:flex">
            <Avatar name={userName || userEmail} src={userAvatar} />
            <span className="font-mono text-[11px] text-stone-500">{userName || userEmail}</span>
          </span>
          <a
            href="/hub"
            className="rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-stone-500 hover:border-action/40"
          >
            hub
          </a>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-stone-500 hover:border-danger/40 hover:text-danger"
          >
            <LogOut size={12} /> sair
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {view.tab !== "lead" && (
          <div className="mb-6 flex gap-1 rounded-lg surface-3 p-1">
            <NavBtn active={view.tab === "dashboard"} onClick={() => setView({ tab: "dashboard" })}>
              <LayoutGrid size={13} /> dashboard
            </NavBtn>
            <NavBtn active={view.tab === "leads"} onClick={() => setView({ tab: "leads" })}>
              <Users size={13} /> leads
            </NavBtn>
            <NavBtn active={view.tab === "sales"} onClick={() => setView({ tab: "sales" })}>
              <DollarSign size={13} /> vendas
            </NavBtn>
          </div>
        )}

        {view.tab === "dashboard" && <CrmDashboard />}
        {view.tab === "leads" && <CrmLeads onOpenLead={(id) => setView({ tab: "lead", leadId: id })} />}
        {view.tab === "lead" && <CrmLeadDetail leadId={view.leadId} onBack={() => setView({ tab: "leads" })} />}
        {view.tab === "sales" && <CrmSales />}
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 font-mono text-[11px] transition-colors ${
        active ? "bg-clay text-ink shadow-sm" : "text-stone-500"
      }`}
    >
      {children}
    </button>
  );
}
