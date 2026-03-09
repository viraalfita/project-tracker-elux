"use client";

import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { CommandPalette } from "@/components/search/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";
import { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BarChart2,
  CheckSquare,
  Folder,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  LogOut,
  Search,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: Role[]; // undefined = visible to all roles
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/epics", label: "Epics", icon: Folder },
  { href: "/board", label: "Board", icon: Kanban },
  { href: "/my-work", label: "My Work", icon: CheckSquare },
  { href: "/utilization", label: "Team Workload", icon: BarChart2 },
  { href: "/workspace", label: "Workspace", icon: Users, roles: ["Admin"] },
];

const ROLE_BADGE: Record<Role, string> = {
  Admin: "bg-indigo-100 text-indigo-700",
  Manager: "bg-blue-100 text-blue-700",
  Member: "bg-green-100 text-green-700",
  Viewer: "bg-slate-100 text-slate-600",
};

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!currentUser) return null;

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(currentUser.role),
  );

  return (
    <>
      <aside className="flex h-screen w-56 flex-col border-r border-border bg-white">
        {/* Workspace header */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <FolderKanban className="h-5 w-5 text-indigo-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              Elux Workspace (Dev)
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentUser.role}
            </p>
          </div>
        </div>

        {/* Search trigger */}
        <div className="px-2 pt-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 rounded-md border border-border bg-accent/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="rounded border border-border px-1 text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-2 py-3 flex-1">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white shrink-0"
              style={{ backgroundColor: currentUser.avatarColor }}
            >
              {currentUser.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">
                {currentUser.name}
              </p>
              <span
                className={cn(
                  "inline-block rounded-full px-1.5 py-0 text-xs font-medium leading-5",
                  ROLE_BADGE[currentUser.role],
                )}
              >
                {currentUser.role}
              </span>
            </div>
            <NotificationPanel />
            <button
              onClick={logout}
              title="Log out"
              className="rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
