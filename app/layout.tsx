import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataStoreProvider } from "@/contexts/DataStore";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ToastProvider } from "@/contexts/ToastContext";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Project Tracker",
  description: "Internal project tracker MVP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <AuthProvider>
          <DataStoreProvider>
            <NotificationProvider>
              <ToastProvider>
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </NotificationProvider>
          </DataStoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
