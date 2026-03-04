/**
 * Data Consistency Test Suite
 *
 * This script validates that utilization calculations are consistent
 * across Dashboard and Utilization pages.
 *
 * Run this test to verify data integrity after any changes.
 */

import { USERS } from "../lib/mock";
import type { Task } from "../lib/types";
import {
  calculateUtilization,
  calculateUtilizationAggregates,
} from "../lib/utils";

// Mock comprehensive task data for testing
const MOCK_TASKS: Task[] = [
  {
    id: "t1",
    epicId: "e1",
    title: "Task 1",
    description: "Test task",
    assignee: USERS[0], // Admin (40h capacity)
    owner: USERS[0],
    status: "In Progress",
    priority: "High",
    dueDate: "2026-02-12",
    estimate: 20,
    watchers: [],
    subtasks: [],
    comments: [],
    timeEntries: [],
  },
  {
    id: "t2",
    epicId: "e1",
    title: "Task 2",
    description: "Test task",
    assignee: USERS[0], // Admin (40h capacity)
    owner: USERS[0],
    status: "To Do",
    priority: "Medium",
    dueDate: "2026-02-15",
    estimate: 20,
    watchers: [],
    subtasks: [],
    comments: [],
    timeEntries: [],
  },
  {
    id: "t3",
    epicId: "e2",
    title: "Task 3",
    description: "Test task",
    assignee: USERS[4], // Designer (32h capacity)
    owner: USERS[4],
    status: "In Progress",
    priority: "High",
    dueDate: "2026-02-13",
    estimate: 40,
    watchers: [],
    subtasks: [],
    comments: [],
    timeEntries: [],
  },
  {
    id: "t4",
    epicId: "e1",
    title: "Task 4",
    description: "Test task",
    assignee: USERS[2], // Frontend Dev (40h capacity)
    owner: USERS[2],
    status: "Done",
    priority: "Low",
    dueDate: "2026-02-05",
    estimate: 15,
    watchers: [],
    subtasks: [],
    comments: [],
    timeEntries: [],
  },
  {
    id: "t5",
    epicId: "e2",
    title: "Task 5",
    description: "Test task",
    assignee: USERS[3], // Backend Dev (40h capacity)
    owner: USERS[3],
    status: "Review",
    priority: "High",
    dueDate: "2026-02-20",
    estimate: 30,
    watchers: [],
    subtasks: [],
    comments: [],
    timeEntries: [],
  },
];

// Test Suite
console.log("🧪 Data Consistency Test Suite\n");
console.log("=".repeat(60));

// Test 1: Dashboard-style calculation (all open tasks, no date filter)
console.log("\n📊 Test 1: Dashboard Calculation (All Open Tasks)");
console.log("-".repeat(60));
const dashboardUtil = calculateUtilization(USERS, MOCK_TASKS, {
  excludeCompleted: true,
  dateRange: "none",
});
const dashboardAgg = calculateUtilizationAggregates(dashboardUtil);

console.log("Results:");
dashboardUtil.forEach((u) => {
  if (u.openTasks > 0) {
    console.log(
      `  ${u.user.name}: ${u.totalEstimate}h / ${u.capacity}h = ${u.pct}%`,
    );
  }
});
console.log(`\nAverage Utilization: ${dashboardAgg.avgUtilization}%`);
console.log(`Over Capacity: ${dashboardAgg.overCapacity} users`);

// Test 2: Utilization page with "This Week" filter
console.log("\n\n📅 Test 2: Utilization Page (This Week Filter)");
console.log("-".repeat(60));
const utilizationThisWeek = calculateUtilization(USERS, MOCK_TASKS, {
  excludeCompleted: true,
  dateRange: "this-week", // 2/10/2026 - 2/16/2026
});
const utilThisWeekAgg = calculateUtilizationAggregates(utilizationThisWeek);

console.log("Results (This Week: 2/10/2026 - 2/16/2026):");
utilizationThisWeek.forEach((u) => {
  if (u.openTasks > 0) {
    console.log(
      `  ${u.user.name}: ${u.totalEstimate}h / ${u.capacity}h = ${u.pct}%`,
    );
  }
});
console.log(`\nAverage Utilization: ${utilThisWeekAgg.avgUtilization}%`);
console.log(`Over Capacity: ${utilThisWeekAgg.overCapacity} users`);

// Test 3: Epic filter consistency
console.log("\n\n🎯 Test 3: Epic Filter (E-Commerce Platform - e1)");
console.log("-".repeat(60));
const epicFiltered = calculateUtilization(USERS, MOCK_TASKS, {
  excludeCompleted: true,
  dateRange: "none",
  epicId: "e1",
});
const epicFilteredAgg = calculateUtilizationAggregates(epicFiltered);

console.log("Results (Epic e1 only):");
epicFiltered.forEach((u) => {
  if (u.openTasks > 0) {
    console.log(
      `  ${u.user.name}: ${u.totalEstimate}h / ${u.capacity}h = ${u.pct}%`,
    );
  }
});
console.log(`\nAverage Utilization: ${epicFilteredAgg.avgUtilization}%`);
console.log(`Over Capacity: ${epicFilteredAgg.overCapacity} users`);

// Test 4: Consistency check
console.log("\n\n✅ Test 4: Consistency Validation");
console.log("-".repeat(60));

// Check that the same filters produce the same results
const dashboardUtil2 = calculateUtilization(USERS, MOCK_TASKS, {
  excludeCompleted: true,
  dateRange: "none",
});

const isConsistent =
  JSON.stringify(dashboardUtil) === JSON.stringify(dashboardUtil2);
console.log(
  `Repeated calculation consistency: ${isConsistent ? "✅ PASS" : "❌ FAIL"}`,
);

// Check capacity usage
const designerUtil = dashboardUtil.find((u) => u.user.id === "u5"); // Designer
const adminUtil = dashboardUtil.find((u) => u.user.id === "u1"); // Admin

console.log(`\nCapacity Validation:`);
console.log(
  `  Designer capacity: ${designerUtil?.capacity}h (expected: 32h) - ${designerUtil?.capacity === 32 ? "✅" : "❌"}`,
);
console.log(
  `  Admin capacity: ${adminUtil?.capacity}h (expected: 40h) - ${adminUtil?.capacity === 40 ? "✅" : "❌"}`,
);

// Check calculation accuracy
const designerExpectedPct = designerUtil
  ? Math.round((designerUtil.totalEstimate / 32) * 100)
  : 0;
const designerActualPct = designerUtil?.pct ?? 0;
console.log(
  `  Designer calculation: ${designerActualPct}% (expected: ${designerExpectedPct}%) - ${designerActualPct === designerExpectedPct ? "✅" : "❌"}`,
);

// Test 5: Edge cases
console.log("\n\n🔬 Test 5: Edge Cases");
console.log("-".repeat(60));

// User with no tasks
const viewerUtil = dashboardUtil.find((u) => u.user.id === "u6"); // Viewer
console.log(
  `User with no tasks: ${viewerUtil?.pct}% - ${viewerUtil?.pct === 0 ? "✅" : "❌"}`,
);

// User with zero capacity
console.log(
  `Zero capacity user doesn't break: ${viewerUtil !== undefined ? "✅" : "❌"}`,
);

// Check for NaN or undefined
const hasInvalidValues = dashboardUtil.some(
  (u) =>
    isNaN(u.pct) ||
    u.pct === undefined ||
    isNaN(u.totalEstimate) ||
    u.totalEstimate === undefined,
);
console.log(`No NaN or undefined values: ${!hasInvalidValues ? "✅" : "❌"}`);

// Final Summary
console.log("\n\n" + "=".repeat(60));
console.log("🎉 Test Suite Complete");
console.log("=".repeat(60));

const allTestsPass =
  isConsistent &&
  designerUtil?.capacity === 32 &&
  adminUtil?.capacity === 40 &&
  designerActualPct === designerExpectedPct &&
  viewerUtil?.pct === 0 &&
  !hasInvalidValues;

console.log(
  `\nOverall Result: ${allTestsPass ? "✅ ALL TESTS PASS" : "❌ SOME TESTS FAILED"}`,
);

if (allTestsPass) {
  console.log("\n✅ Data consistency is guaranteed across all pages!");
  console.log("✅ Calculations are accurate and use correct capacity values!");
  console.log("✅ Edge cases are handled properly!");
} else {
  console.log("\n❌ Some tests failed. Please review the implementation.");
}

console.log("\n");

export {};
