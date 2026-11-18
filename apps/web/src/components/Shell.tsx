"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, MessageSquare, FileText, ListChecks, ShieldCheck, FolderOpen, Settings, Moon, Sun, PanelLeft, Sparkles, Building2 } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/team", label: "AI Team", icon: Users },
  { href: "/office", label: "Office", icon: Building2 },
  { href: "/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Shell({ children, company }: { children: React.ReactNode; company: string }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(true);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    try { setCollapsed(localStorage.getItem("nav") === "1"); } catch { /* ignore */ }
  }, []);
  const toggleTheme = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("theme", d ? "dark" : "light"); } catch { /* ignore */ }
  };
  const toggleNav = () => {
    setCollapsed(!collapsed);
    try { localStorage.setItem("nav", collapsed ? "0" : "1"); } catch { /* ignore */ }
  };
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className={`border-b md:border-b-0 md:border-r border-border bg-[var(--panel-glass)] backdrop-blur-md md:sticky md:top-0 md:h-screen ${collapsed ? "md:w-16" : "md:w-56"} shrink-0`}>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2"><span className="logo-mark grid place-items-center size-8 rounded-lg shrink-0"><Sparkles size={16} /></span>{!collapsed && <span className="font-semibold tracking-tight leading-tight max-w-[9rem] truncate" title={company}>{company}<br /><span className="grad-text text-xs font-medium">AI Office</span></span>}</span>
          <button className="btn !p-1.5 hidden md:inline-flex" onClick={toggleNav} aria-label="Collapse sidebar"><PanelLeft size={16} /></button>
        </div>
        <nav aria-label="Primary" className="flex md:flex-col gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} title={label} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${active ? "nav-active" : "text-muted hover:text-ink hover:bg-[var(--glow)]"}`}>
                <Icon size={16} />{!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block px-2 pb-3 mt-auto absolute bottom-0">
          <button className="btn" onClick={toggleTheme} aria-label="Toggle dark mode">{dark ? <Sun size={14} /> : <Moon size={14} />}{!collapsed && (dark ? "Light" : "Dark")}</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
    </div>
  );
}
