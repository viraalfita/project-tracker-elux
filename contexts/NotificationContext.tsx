"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/contexts/DataStore";
import { isTaskOverdue } from "@/lib/utils";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface AppNotification {
  id: string;
  type: "assigned" | "overdue";
  taskId: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotifications must be used inside NotificationProvider",
    );
  return ctx;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const { tasks } = useDataStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // Track the previous task snapshot to detect assignment changes
  const prevTasksRef = useRef(tasks);

  const upsertNotification = useCallback((notif: AppNotification) => {
    setNotifications((prev) => {
      const exists = prev.find((n) => n.id === notif.id);
      if (exists) return prev; // already present, don't duplicate
      return [notif, ...prev];
    });
  }, []);

  const checkNotifications = useCallback(() => {
    if (!currentUser) return;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const prevTasks = prevTasksRef.current;

    tasks.forEach((task) => {
      // Overdue notification
      if (
        task.assignee?.id === currentUser.id &&
        isTaskOverdue(task.dueDate, task.status)
      ) {
        upsertNotification({
          id: `overdue-${task.id}`,
          type: "overdue",
          taskId: task.id,
          message: `"${task.title}" is overdue`,
          read: false,
          createdAt: now,
        });
      }

      // Assignment notification — detect change from previous snapshot
      const prevTask = prevTasks.find((t) => t.id === task.id);
      const wasAssignedToMe = prevTask?.assignee?.id === currentUser.id;
      const isNowAssignedToMe = task.assignee?.id === currentUser.id;
      if (!wasAssignedToMe && isNowAssignedToMe) {
        upsertNotification({
          id: `assigned-${task.id}-${Date.now()}`,
          type: "assigned",
          taskId: task.id,
          message: `You were assigned to "${task.title}"`,
          read: false,
          createdAt: now,
        });
      }
    });

    prevTasksRef.current = tasks;
  }, [currentUser, tasks, upsertNotification]);

  // Run on mount + every POLL_INTERVAL_MS
  useEffect(() => {
    checkNotifications();
    const interval = setInterval(checkNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also re-check when tasks change (catches assignments in the same session)
  useEffect(() => {
    if (prevTasksRef.current !== tasks) {
      checkNotifications();
    }
  }, [tasks, checkNotifications]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAllRead, markRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
