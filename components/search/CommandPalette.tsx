"use client";

import { useDataStore } from "@/contexts/DataStore";
import { Folder, Search, Target, User, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface SearchResult {
  id: string;
  type: "Epic" | "Task" | "User" | "Goal";
  title: string;
  subtitle?: string;
  href: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_ICONS: Record<SearchResult["type"], React.ElementType> = {
  Epic: Folder,
  Task: Zap,
  User: User,
  Goal: Target,
};

const TYPE_COLORS: Record<SearchResult["type"], string> = {
  Epic: "text-indigo-600 bg-indigo-50",
  Task: "text-blue-600 bg-blue-50",
  User: "text-green-600 bg-green-50",
  Goal: "text-orange-600 bg-orange-50",
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { epics, tasks, users, goals } = useDataStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results: SearchResult[] = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const found: SearchResult[] = [];

    epics
      .filter((e) => e.title.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((e) =>
        found.push({
          id: e.id,
          type: "Epic",
          title: e.title,
          subtitle: e.status,
          href: `/epic/${e.id}`,
        }),
      );

    tasks
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((t) =>
        found.push({
          id: t.id,
          type: "Task",
          title: t.title,
          subtitle: t.status,
          href: `/task/${t.id}`,
        }),
      );

    goals
      .filter((g) => g.title.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach((g) =>
        found.push({
          id: g.id,
          type: "Goal",
          title: g.title,
          subtitle: g.description || undefined,
          href: `/goal/${g.id}`,
        }),
      );

    users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
      .slice(0, 2)
      .forEach((u) =>
        found.push({
          id: u.id,
          type: "User",
          title: u.name,
          subtitle: u.role,
          href: `/workspace`,
        }),
      );

    return found;
  })();

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function navigate(result: SearchResult) {
    router.push(result.href);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      navigate(results[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search epics, tasks, goals, users..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.trim() && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </p>
            </div>
          )}
          {results.length > 0 && (
            <div className="py-1">
              {results.map((result, idx) => {
                const Icon = TYPE_ICONS[result.type];
                const colorClass = TYPE_COLORS[result.type];
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => navigate(result)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      idx === activeIndex ? "bg-indigo-50" : "hover:bg-accent"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-medium ${colorClass}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {result.title}
                      </p>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {result.type}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {!query.trim() && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-xs text-muted-foreground">
                Type to search across epics, tasks, goals, and users
              </p>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>Esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
