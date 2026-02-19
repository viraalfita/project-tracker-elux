"use client";

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
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  {
    href: "/utilization",
    label: "Team Workload",
    icon: BarChart2,
    roles: ["Manager", "Admin"],
  },
  { href: "/workspace", label: "Workspace", icon: Users, roles: ["Admin"] },
];

const ROLE_BADGE: Record<Role, string> = {
  Admin: "bg-indigo-100 text-indigo-700",
  Manager: "bg-blue-100 text-blue-700",
  Member: "bg-green-100 text-green-700",
  Viewer: "bg-slate-100 text-slate-600",
};

const ALL_ROLES: Role[] = ["Admin", "Manager", "Member"];

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser, logout, switchRole } = useAuth();

  if (!currentUser) return null;

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(currentUser.role),
  );

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-white">
      {/* Workspace header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <FolderKanban className="h-5 w-5 text-indigo-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            Alpha Workspace
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {currentUser.role}
          </p>
        </div>
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

      {/* Role switcher */}
      <div className="border-t border-border px-3 py-3 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1 px-1">
            Switch role (demo)
          </p>
          <select
            value={currentUser.role}
            onChange={(e) => switchRole(e.target.value as Role)}
            className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Current user + logout */}
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
  );
}
