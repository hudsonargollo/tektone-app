import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import Login from "@/components/Login";
import CustomerShell from "@/components/CustomerShell";

// Root of the standalone customer portal (tektone.com.br/portal) — a
// deliberately minimal mirror of App.jsx's auth-gate + CUSTOMER branch
// (see App.jsx lines 66-84, 207-210, 428-449), without any of the staff
// board/admin state that branch never needed anyway. Carved out so the
// customer-facing bundle is its own product/deployment, not a hidden path
// through the staff app (see plan at ~/.claude/plans/wise-riding-wirth.md,
// "Phase 3: Carve /portal out of tektone-hub").
export default function PortalApp() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [accessRole, setAccessRole] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userAvatar, setUserAvatar] = useState(null);

  const refreshMe = useCallback(() => {
    api
      .me()
      .then(({ authed, email, accessRole, name, avatar }) => {
        setAuthed(Boolean(authed));
        setUserEmail(email);
        setAccessRole(accessRole);
        setUserName(name);
        setUserAvatar(avatar);
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  async function logout() {
    await api.logout().catch(() => {});
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

  // Same defense-in-depth split CustomerShell.jsx documents: a STAFF/ADMIN
  // account that ends up here (e.g. someone bookmarked /portal) gets bounced
  // to the actual staff app rather than shown a customer view of nothing —
  // the API would 403 most of these calls anyway (rbac.js), this just avoids
  // the confusing empty-state UI.
  if (accessRole && accessRole !== "CUSTOMER") {
    window.location.href = "/hub";
    return null;
  }

  return (
    <CustomerShell
      userName={userName}
      userEmail={userEmail}
      userAvatar={userAvatar}
      onLogout={logout}
    />
  );
}
