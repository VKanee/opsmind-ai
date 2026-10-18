import {
  Activity,
  BookOpenText,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  RadioTower,
  ScrollText,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { titleCase } from "@/lib/format";

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/incidents", label: "Incidents", icon: RadioTower },
  { to: "/knowledge", label: "Knowledge", icon: BookOpenText },
  { to: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { to: "/audit", label: "Audit trail", icon: ScrollText },
];

const pageTitles: Record<string, string> = {
  "/": "Operations overview",
  "/incidents": "Incident queue",
  "/knowledge": "Knowledge base",
  "/approvals": "Approval queue",
  "/audit": "Audit trail",
};

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const detailPath = location.pathname.startsWith("/incidents/");
  const pageTitle = detailPath
    ? "Incident workspace"
    : pageTitles[location.pathname] ?? "OpsMind AI";

  const sidebar = (
    <>
      <div className="brand">
        <div className="brand-mark">
          <Activity size={19} strokeWidth={2.4} />
        </div>
        <div>
          <strong>OpsMind</strong>
          <span>AI OPERATIONS</span>
        </div>
        <button
          className="icon-button sidebar-close"
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          title="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      <div className="workspace-chip">
        <span className="workspace-avatar">AC</span>
        <div>
          <strong>Acme Cloud</strong>
          <span>Production</span>
        </div>
        <span className="live-indicator" title="Workspace online" />
      </div>

      <nav className="primary-nav" aria-label="Primary navigation">
        <div className="nav-label">Workspace</div>
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            <Icon size={17} strokeWidth={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-security">
        <ShieldCheck size={18} />
        <div>
          <strong>Governed workspace</strong>
          <span>Approval gates enabled</span>
        </div>
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">
          {user?.display_name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div className="user-copy">
          <strong>{user?.display_name}</strong>
          <span>{user ? titleCase(user.role) : ""}</span>
        </div>
        <button
          className="icon-button icon-button-dark"
          type="button"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>{sidebar}</aside>
      {mobileOpen ? (
        <button
          className="mobile-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              title="Open navigation"
            >
              <Menu size={19} />
            </button>
            <div>
              <span className="topbar-context">Acme Cloud / Production</span>
              <strong>{pageTitle}</strong>
            </div>
          </div>
          <div className="system-status">
            <span className="status-pulse" />
            <span>Systems nominal</span>
            <span className="topbar-divider" />
            <span className="topbar-role">{user ? titleCase(user.role) : ""}</span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
