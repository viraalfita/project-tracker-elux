"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { QuickAddButton } from "@/components/shared/QuickAddButton";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPath = pathname === "/login";
  // Profile setup is a standalone page — authenticated but no sidebar
  const isStandalonePath = pathname === "/profile/setup";

  useEffect(() => {
    if (isLoading) return;
    if (!currentUser && !isPublicPath) {
      router.replace("/login");
    }
    if (currentUser && isPublicPath) {
      router.replace("/dashboard");
    }
  }, [currentUser, isLoading, isPublicPath, pathname, router]);

  // Public pages and standalone onboarding — render without sidebar
  if (isPublicPath || isStandalonePath) {
    return <>{children}</>;
  }

  // Auth check in progress — blank screen to avoid flash
  if (isLoading) return null;

  // Not yet authenticated — blank while redirect is in flight
  if (!currentUser) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <QuickAddButton />
    </div>
  );
}
