// Shared "which project is the customer looking at" state for the
// (customer)/ tab group — onboarding/contracts/invoices/marketplace are
// four separate screens (unlike web's CustomerShell.jsx, which switches
// tabs inside one component), so the project selection + progress header
// need to live above them instead of being re-fetched/re-picked per tab.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";

type Project = {
  id: string;
  name: string;
  progress?: { pct?: number; done?: number; total?: number };
};

type CustomerProjectContextValue = {
  projects: Project[] | null;
  activeProjectId: string | null;
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  error: string;
};

const CustomerProjectContext = createContext<CustomerProjectContextValue | null>(null);

export function CustomerProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { projects } = await api.listProjects();
      setProjects(projects);
      setActiveProjectId((prev) => prev || projects[0]?.id || null);
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeProject = projects?.find((p) => p.id === activeProjectId) || null;

  return (
    <CustomerProjectContext.Provider value={{ projects, activeProjectId, activeProject, setActiveProjectId, error }}>
      {children}
    </CustomerProjectContext.Provider>
  );
}

export function useCustomerProject() {
  const ctx = useContext(CustomerProjectContext);
  if (!ctx) throw new Error("useCustomerProject must be used within CustomerProjectProvider");
  return ctx;
}
