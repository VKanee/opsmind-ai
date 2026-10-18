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
  { to: "/", label: "运营总览", icon: LayoutDashboard, end: true },
  { to: "/incidents", label: "事故中心", icon: RadioTower },
  { to: "/knowledge", label: "知识库", icon: BookOpenText },
  { to: "/approvals", label: "审批中心", icon: ClipboardCheck },
  { to: "/audit", label: "审计日志", icon: ScrollText },
];

const pageTitles: Record<string, string> = {
  "/": "运营总览",
  "/incidents": "事故队列",
  "/knowledge": "知识库",
  "/approvals": "审批队列",
  "/audit": "审计日志",
};

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const detailPath = location.pathname.startsWith("/incidents/");
  const pageTitle = detailPath
    ? "事故处置工作台"
    : pageTitles[location.pathname] ?? "OpsMind AI";

  const sidebar = (
    <>
      <div className="brand">
        <div className="brand-mark">
          <Activity size={19} strokeWidth={2.4} />
        </div>
        <div>
          <strong>OpsMind</strong>
          <span>AI 运维平台</span>
        </div>
        <button
          className="icon-button sidebar-close"
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="关闭导航"
          title="关闭导航"
        >
          <X size={18} />
        </button>
      </div>

      <div className="workspace-chip">
        <span className="workspace-avatar">AC</span>
        <div>
          <strong>云启科技</strong>
          <span>生产环境</span>
        </div>
        <span className="live-indicator" title="工作区在线" />
      </div>

      <nav className="primary-nav" aria-label="主导航">
        <div className="nav-label">工作区</div>
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
          <strong>受治理工作区</strong>
          <span>生产变更需人工审批</span>
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
          aria-label="退出登录"
          title="退出登录"
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
          aria-label="关闭导航"
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
              aria-label="打开导航"
              title="打开导航"
            >
              <Menu size={19} />
            </button>
            <div>
              <span className="topbar-context">云启科技 / 生产环境</span>
              <strong>{pageTitle}</strong>
            </div>
          </div>
          <div className="system-status">
            <span className="status-pulse" />
            <span>系统运行正常</span>
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
