// HISTORICAL: No longer imported by the running app.
// Used only by scripts/setup-pocketbase.ts for the one-time seed.
import { generateComprehensiveTasks } from "./mock-data";
import { Epic, EpicDoc, Goal, Subtask, Task, User } from "./types";

// ─── Users ────────────────────────────────────────────────────────────────────

export const USERS: User[] = [
  {
    id: "u1",
    name: "Arya Pradana",
    email: "arya.pradana@elux.space",
    initials: "AP",
    avatarColor: "#6366f1",
    role: "Admin",
    weeklyCapacity: 40,
  },
  {
    id: "u2",
    name: "Lintang",
    email: "lintang@elux.space",
    initials: "LI",
    avatarColor: "#3b82f6",
    role: "Manager",
    weeklyCapacity: 40,
  },
  {
    id: "u3",
    name: "Dewi",
    email: "dewi@elux.space",
    initials: "DW",
    avatarColor: "#10b981",
    role: "Manager",
    weeklyCapacity: 40,
  },
  {
    id: "u4",
    name: "Ahrasya",
    email: "ahrasya@elux.space",
    initials: "AH",
    avatarColor: "#f59e0b",
    role: "Manager",
    weeklyCapacity: 40,
  },
  {
    id: "u5",
    name: "Vira",
    email: "vira@elux.space",
    initials: "VI",
    avatarColor: "#ec4899",
    role: "Member",
    weeklyCapacity: 32,
  },
  {
    id: "u6",
    name: "Aurel",
    email: "aurelia@elux.space",
    initials: "AU",
    avatarColor: "#8b5cf6",
    role: "Member",
    weeklyCapacity: 32,
  },
];

// Kept for places that need a default fallback; components should prefer useAuth()
export const CURRENT_USER: User = USERS[0];

// ─── Epics ────────────────────────────────────────────────────────────────────

export const EPICS: Epic[] = [
  {
    id: "e1",
    title: "E-Commerce Platform Redesign",
    description:
      "Complete UI/UX overhaul of the customer-facing e-commerce platform. Includes responsive design, checkout flow optimization, and accessibility improvements.",
    owner: USERS[0], // Arya (Admin)
    watchers: [USERS[1], USERS[2]], // Lintang, Dewi
    status: "In Progress",
    startDate: "2026-01-15",
    endDate: "2026-03-15",
  },
  {
    id: "e2",
    title: "Payment Gateway Integration",
    description:
      "Integrate Stripe and PayPal payment processing with fraud detection, recurring billing support, and multi-currency handling.",
    owner: USERS[3], // Ahrasya (Manager)
    watchers: [USERS[0], USERS[1]], // Arya, Lintang
    status: "In Progress",
    startDate: "2026-02-01",
    endDate: "2026-02-28",
  },
  {
    id: "e3",
    title: "Mobile App MVP",
    description:
      "Native iOS and Android apps with core features: product browsing, wishlist, push notifications, and quick checkout.",
    owner: USERS[2], // Dewi (Manager)
    watchers: [USERS[0], USERS[4]], // Arya, Vira
    status: "Not Started",
    startDate: "2026-03-01",
    endDate: "2026-04-30",
  },
  {
    id: "e4",
    title: "Analytics & Reporting System",
    description:
      "Real-time analytics dashboard for sales, user behavior, conversion tracking, and automated reporting exports.",
    owner: USERS[0], // Arya (Admin)
    watchers: [USERS[1], USERS[3]], // Lintang, Ahrasya
    status: "In Progress",
    startDate: "2026-01-20",
    endDate: "2026-02-25",
  },
  {
    id: "e5",
    title: "Customer Support Portal",
    description:
      "Self-service portal with ticket system, live chat integration, knowledge base, and order tracking.",
    owner: USERS[4], // Vira (Member)
    watchers: [USERS[0], USERS[2]], // Arya, Dewi
    status: "On Hold",
    startDate: "2026-02-10",
    endDate: "2026-03-20",
  },
  {
    id: "e6",
    title: "Infrastructure Migration",
    description:
      "Migrate from AWS EC2 to Kubernetes cluster with auto-scaling, improved monitoring, and disaster recovery setup.",
    owner: USERS[3], // Ahrasya (Manager)
    watchers: [USERS[0]], // Arya only
    status: "Done",
    startDate: "2025-12-01",
    endDate: "2026-01-31",
  },
];

// ─── Goals ────────────────────────────────────────────────────────────────────

export const GOALS: Goal[] = [
  {
    id: "g1",
    title: "Launch Refreshed Digital Storefront",
    description:
      "Deliver a modern, performant e-commerce experience that increases conversion rate and reduces cart abandonment.",
    owner: USERS[0], // Arya (Admin)
    kpis: [
      {
        id: "k1",
        label: "Conversion Rate",
        current: 2.1,
        target: 4,
        unit: "%",
        greenThreshold: 80,
        yellowThreshold: 50,
      },
      {
        id: "k2",
        label: "Cart Abandonment",
        current: 68,
        target: 45,
        unit: "%",
        greenThreshold: 80,
        yellowThreshold: 50,
      },
      {
        id: "k3",
        label: "Page Load Time",
        current: 3.2,
        target: 1.5,
        unit: "s",
        greenThreshold: 80,
        yellowThreshold: 50,
      },
    ],
    linkedEpicIds: ["e1", "e2"],
  },
  {
    id: "g2",
    title: "Expand Mobile Presence",
    description:
      "Reach mobile users with native apps and a responsive experience to capture untapped market share.",
    owner: USERS[1], // Lintang (Manager)
    kpis: [
      {
        id: "k4",
        label: "Mobile DAU",
        current: 1200,
        target: 5000,
        unit: "users",
        greenThreshold: 80,
        yellowThreshold: 50,
      },
      {
        id: "k5",
        label: "App Store Rating",
        current: 3.8,
        target: 4.5,
        unit: "stars",
        greenThreshold: 80,
        yellowThreshold: 50,
      },
    ],
    linkedEpicIds: ["e3"],
  },
  {
    id: "g3",
    title: "Data-Driven Operations",
    description:
      "Build a robust analytics and reporting infrastructure to enable data-informed decision making across the business.",
    owner: USERS[0], // Arya (Admin)
    kpis: [
      {
        id: "k6",
        label: "Reports Automated",
        current: 3,
        target: 12,
        unit: "reports",
        greenThreshold: 80,
        yellowThreshold: 50,
      },
      {
        id: "k7",
        label: "Avg Query Time",
        current: 4.1,
        target: 0.8,
        unit: "s",
        greenThreshold: 80,
        yellowThreshold: 50,
      },
    ],
    linkedEpicIds: ["e4", "e6"],
  },
];

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const TASKS: Task[] = generateComprehensiveTasks(USERS);

// ─── EpicDocs ─────────────────────────────────────────────────────────────────

export const EPIC_DOCS: EpicDoc[] = [
  {
    id: "d1",
    epicId: "e1",
    title: "Overview",
    content:
      "The E-Commerce Platform Redesign covers a full UI/UX overhaul of the customer-facing storefront. This epic aligns with the new design system and focuses on responsive layouts, checkout flow optimization, and WCAG AA accessibility compliance.",
    createdBy: USERS[0],
    createdAt: "2026-01-15T09:00:00Z",
    updatedAt: "2026-01-20T14:30:00Z",
  },
  {
    id: "d2",
    epicId: "e1",
    title: "Technical Spec",
    content:
      "## Stack\n- Next.js 15 (App Router)\n- Tailwind CSS v4\n- Radix UI primitives\n\n## Key decisions\n- Server components for product listing pages\n- Client components for cart and checkout\n- Image optimization via next/image with blur placeholders",
    createdBy: USERS[1],
    createdAt: "2026-01-16T11:00:00Z",
    updatedAt: "2026-01-18T16:00:00Z",
  },
  {
    id: "d3",
    epicId: "e2",
    title: "Integration Plan",
    content:
      "## Payment Providers\n- Stripe for card payments and subscriptions\n- PayPal for wallet payments\n\n## Fraud detection\n- Stripe Radar rules enabled\n- Order velocity checks on backend\n\n## Currency support\n- Multi-currency via Stripe's presentment currency feature",
    createdBy: USERS[3],
    createdAt: "2026-02-01T10:00:00Z",
    updatedAt: "2026-02-03T12:00:00Z",
  },
];

// ─── Rollup helpers ───────────────────────────────────────────────────────────

export function getTaskProgress(task: Task): number {
  if (task.subtasks.length === 0) {
    if (task.status === "Done") return 100;
    if (task.status === "In Progress" || task.status === "Review") return 50;
    return 0;
  }
  const done = task.subtasks.filter((s) => s.done).length;
  return Math.round((done / task.subtasks.length) * 100);
}

export function getTasksByEpic(epicId: string): Task[] {
  return TASKS.filter((t) => t.epicId === epicId);
}

export function getTaskById(taskId: string): Task | undefined {
  return TASKS.find((t) => t.id === taskId);
}

export function getEpicById(epicId: string): Epic | undefined {
  return EPICS.find((e) => e.id === epicId);
}

export function getEpicForTask(taskId: string): Epic | undefined {
  const task = getTaskById(taskId);
  if (!task) return undefined;
  return EPICS.find((e) => e.id === task.epicId);
}

export function getMyTasks(userId: string): Task[] {
  return TASKS.filter((t) => t.assignee?.id === userId);
}

export function getMySubtasks(userId: string): Subtask[] {
  return TASKS.flatMap((t) => t.subtasks).filter(
    (s) => s.assignee?.id === userId,
  );
}

export function getEpicProgress(epicId: string): number {
  const epicTasks = TASKS.filter((t) => t.epicId === epicId);
  if (epicTasks.length === 0) return 0;
  const total = epicTasks.reduce((sum, t) => sum + getTaskProgress(t), 0);
  return Math.round(total / epicTasks.length);
}

export function getEpicHealthIndicators(epicId: string): {
  overdueCount: number;
  atRiskCount: number;
} {
  const epicTasks = TASKS.filter((t) => t.epicId === epicId);

  // Mock health indicators (in real app would calculate from dates/progress)
  const overdueCount = epicTasks.filter((t) => {
    const due = new Date(t.dueDate);
    const now = new Date("2026-02-10");
    return due < now && t.status !== "Done";
  }).length;

  const atRiskCount = epicTasks.filter((t) => {
    return t.status === "In Progress" && t.priority === "High";
  }).length;

  return { overdueCount, atRiskCount };
}
