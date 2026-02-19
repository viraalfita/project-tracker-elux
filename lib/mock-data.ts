import { Task, User } from "./types";

// This file contains comprehensive integrated dummy data
// Import USERS from mock.ts to maintain consistency

// Helper function to add default fields to tasks
function enrichTask(task: Partial<Task>, USERS: User[]): Task {
  return {
    ...task,
    owner: task.owner || task.assignee || USERS[0],
    watchers: task.watchers || [],
    attachments: task.attachments || [],
    externalLinks: task.externalLinks || [],
  } as Task;
}

export function generateComprehensiveTasks(USERS: User[]): Task[] {
  const rawTasks: Partial<Task>[] = [
    // ═══════════════════════════════════════════════════════════════════════════
    // Epic 1: E-Commerce Platform Redesign (e1)
    // Status: In Progress | Members: All users
    // ═══════════════════════════════════════════════════════════════════════════
    {
      id: "t1",
      epicId: "e1",
      title: "Homepage Hero Section Redesign",
      description:
        "Redesign hero section with featured products carousel, CTAs, and seasonal banner. Must be mobile-responsive and match new brand guidelines.",
      assignee: USERS[4], // Designer (OVERLOADED)
      status: "Done",
      priority: "High",
      dueDate: "2026-02-05",
      estimate: 12,
      subtasks: [
        {
          id: "s1-1",
          taskId: "t1",
          title: "Create wireframes",
          done: true,
          assignee: USERS[4],
        },
        {
          id: "s1-2",
          taskId: "t1",
          title: "Design high-fidelity mockups",
          done: true,
          assignee: USERS[4],
        },
        {
          id: "s1-3",
          taskId: "t1",
          title: "Implement HTML/CSS",
          done: true,
          assignee: USERS[2],
        },
        {
          id: "s1-4",
          taskId: "t1",
          title: "Add carousel logic",
          done: true,
          assignee: USERS[2],
        },
        {
          id: "s1-5",
          taskId: "t1",
          title: "Mobile responsive testing",
          done: true,
          assignee: USERS[2],
        },
      ],
      comments: [
        {
          id: "c1-1",
          taskId: "t1",
          author: USERS[0],
          text: "Looks great! Ship it.",
          createdAt: "2026-02-05 14:30",
        },
      ],
      owner: USERS[2], // Frontend Dev
      watchers: [USERS[0], USERS[1]], // Admin, Manager
      attachments: [
        {
          id: "att1-1",
          filename: "hero-mockup-v3.fig",
          url: "/attachments/hero-mockup-v3.fig",
          size: 2048576, // 2MB
          uploadedBy: USERS[4],
          uploadedAt: "2026-02-01 10:00",
        },
        {
          id: "att1-2",
          filename: "responsive-specs.pdf",
          url: "/attachments/responsive-specs.pdf",
          size: 512000, // 512KB
          uploadedBy: USERS[2],
          uploadedAt: "2026-02-03 14:30",
        },
      ],
      externalLinks: [
        {
          id: "link1-1",
          url: "https://www.figma.com/design/ABC123",
          label: "Figma Design File",
          addedBy: USERS[4],
          addedAt: "2026-02-01 09:00",
        },
      ],
    },
    {
      id: "t2",
      epicId: "e1",
      title: "Product Listing Page Optimization",
      description:
        "Improve product grid with lazy loading, filters, sorting, and quick view modal. Target: < 2s load time.",
      assignee: USERS[2], // Frontend Dev (OVERLOADED)
      status: "In Progress",
      priority: "High",
      dueDate: "2026-02-09", // OVERDUE
      estimate: 16,
      subtasks: [
        {
          id: "s2-1",
          taskId: "t2",
          title: "Implement infinite scroll",
          done: true,
          assignee: USERS[2],
        },
        {
          id: "s2-2",
          taskId: "t2",
          title: "Add filter sidebar",
          done: true,
          assignee: USERS[2],
        },
        {
          id: "s2-3",
          taskId: "t2",
          title: "Implement sort dropdown",
          done: false,
          assignee: USERS[2],
        },
        {
          id: "s2-4",
          taskId: "t2",
          title: "Build quick view modal",
          done: false,
          assignee: USERS[2],
        },
        {
          id: "s2-5",
          taskId: "t2",
          title: "Performance optimization",
          done: false,
        },
      ],
      comments: [
        {
          id: "c2-1",
          taskId: "t2",
          author: USERS[1],
          text: "This is blocking checkout flow. Priority critical.",
          createdAt: "2026-02-10 09:15",
        },
      ],
    },
    {
      id: "t3",
      epicId: "e1",
      title: "Shopping Cart UI Revamp",
      description:
        "Modern cart sidebar with item previews, quantity controls, promo code input, and real-time price updates.",
      assignee: USERS[2], // Frontend Dev
      status: "In Progress",
      priority: "High",
      dueDate: "2026-02-14",
      estimate: 10,
      subtasks: [
        {
          id: "s3-1",
          taskId: "t3",
          title: "Design cart sidebar component",
          done: true,
          assignee: USERS[4],
        },
        {
          id: "s3-2",
          taskId: "t3",
          title: "Implement cart state management",
          done: true,
          assignee: USERS[2],
        },
        {
          id: "s3-3",
          taskId: "t3",
          title: "Add quantity controls",
          done: false,
          assignee: USERS[2],
        },
        {
          id: "s3-4",
          taskId: "t3",
          title: "Integrate promo code API",
          done: false,
          assignee: USERS[3],
        },
      ],
      comments: [],
    },
    {
      id: "t4",
      epicId: "e1",
      title: "Checkout Flow Simplification",
      description:
        "Single-page checkout with guest option, address autocomplete, and order summary sticky panel.",
      assignee: USERS[2], // Frontend Dev
      status: "To Do",
      priority: "High",
      dueDate: "2026-02-18",
      estimate: 14,
      subtasks: [
        {
          id: "s4-1",
          taskId: "t4",
          title: "Design checkout screens",
          done: false,
          assignee: USERS[4],
        },
        {
          id: "s4-2",
          taskId: "t4",
          title: "Implement form validation",
          done: false,
        },
        {
          id: "s4-3",
          taskId: "t4",
          title: "Add address autocomplete",
          done: false,
        },
        {
          id: "s4-4",
          taskId: "t4",
          title: "Integrate payment gateway",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t5",
      epicId: "e1",
      title: "Accessibility Audit & Fixes",
      description:
        "Full WCAG 2.1 AA compliance audit. Fix keyboard navigation, screen reader labels, color contrast issues.",
      assignee: USERS[4], // Designer
      status: "Review",
      priority: "Medium",
      dueDate: "2026-02-12",
      estimate: 8,
      subtasks: [
        {
          id: "s5-1",
          taskId: "t5",
          title: "Run automated accessibility tests",
          done: true,
          assignee: USERS[4],
        },
        {
          id: "s5-2",
          taskId: "t5",
          title: "Fix color contrast issues",
          done: true,
          assignee: USERS[4],
        },
        {
          id: "s5-3",
          taskId: "t5",
          title: "Add ARIA labels",
          done: true,
          assignee: USERS[2],
        },
        {
          id: "s5-4",
          taskId: "t5",
          title: "Test with screen readers",
          done: false,
          assignee: USERS[4],
        },
      ],
      comments: [
        {
          id: "c5-1",
          taskId: "t5",
          author: USERS[1],
          text: "Needs QA sign-off before merging.",
          createdAt: "2026-02-11 16:20",
        },
      ],
    },
    {
      id: "t6",
      epicId: "e1",
      title: "User Profile & Order History Page",
      description:
        "Account dashboard with order history, saved addresses, payment methods, and wishlist management.",
      assignee: null, // UNASSIGNED
      status: "To Do",
      priority: "Medium",
      dueDate: "2026-02-22",
      estimate: 10,
      subtasks: [
        {
          id: "s6-1",
          taskId: "t6",
          title: "Design profile layout",
          done: false,
        },
        {
          id: "s6-2",
          taskId: "t6",
          title: "Implement order history table",
          done: false,
        },
        {
          id: "s6-3",
          taskId: "t6",
          title: "Add saved addresses CRUD",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t7",
      epicId: "e1",
      title: "Search Functionality Enhancement",
      description:
        "Autocomplete search with product suggestions, recent searches, and category filters.",
      assignee: USERS[3], // Backend Dev
      status: "To Do",
      priority: "Low",
      dueDate: "2026-02-25",
      estimate: 12,
      subtasks: [
        {
          id: "s7-1",
          taskId: "t7",
          title: "Implement search indexing",
          done: false,
          assignee: USERS[3],
        },
        {
          id: "s7-2",
          taskId: "t7",
          title: "Build autocomplete API",
          done: false,
          assignee: USERS[3],
        },
        {
          id: "s7-3",
          taskId: "t7",
          title: "Design search UI component",
          done: false,
          assignee: USERS[4],
        },
      ],
      comments: [],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // Epic 2: Payment Gateway Integration (e2)
    // Status: In Progress | Members: u1, u2, u3, u4, u5
    // ═══════════════════════════════════════════════════════════════════════════
    {
      id: "t8",
      epicId: "e2",
      title: "Stripe Payment Integration",
      description:
        "Integrate Stripe Elements for credit card payments with 3D Secure support and webhook handling.",
      assignee: USERS[3], // Backend Dev (OVERLOADED)
      status: "In Progress",
      priority: "High",
      dueDate: "2026-02-15",
      estimate: 20,
      subtasks: [
        {
          id: "s8-1",
          taskId: "t8",
          title: "Setup Stripe account",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s8-2",
          taskId: "t8",
          title: "Implement payment intent API",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s8-3",
          taskId: "t8",
          title: "Add Stripe Elements to checkout",
          done: false,
          assignee: USERS[2],
        },
        {
          id: "s8-4",
          taskId: "t8",
          title: "Implement webhook handlers",
          done: false,
          assignee: USERS[3],
        },
        { id: "s8-5", taskId: "t8", title: "Test 3D Secure flow", done: false },
      ],
      comments: [
        {
          id: "c8-1",
          taskId: "t8",
          author: USERS[3],
          text: "Webhook signature verification is critical. Don't skip this.",
          createdAt: "2026-02-13 11:45",
        },
      ],
    },
    {
      id: "t9",
      epicId: "e2",
      title: "PayPal Integration",
      description:
        "Add PayPal as alternative payment method with express checkout button.",
      assignee: USERS[3], // Backend Dev
      status: "To Do",
      priority: "High",
      dueDate: "2026-02-20",
      estimate: 12,
      subtasks: [
        {
          id: "s9-1",
          taskId: "t9",
          title: "Setup PayPal business account",
          done: false,
          assignee: USERS[3],
        },
        {
          id: "s9-2",
          taskId: "t9",
          title: "Integrate PayPal SDK",
          done: false,
          assignee: USERS[3],
        },
        {
          id: "s9-3",
          taskId: "t9",
          title: "Add express checkout button",
          done: false,
          assignee: USERS[2],
        },
      ],
      comments: [],
    },
    {
      id: "t10",
      epicId: "e2",
      title: "Fraud Detection System",
      description:
        "Implement basic fraud detection: IP geolocation check, velocity limits, blacklist checking.",
      assignee: USERS[3], // Backend Dev
      status: "To Do",
      priority: "Medium",
      dueDate: "2026-02-22",
      estimate: 16,
      subtasks: [
        {
          id: "s10-1",
          taskId: "t10",
          title: "Research fraud detection APIs",
          done: false,
        },
        {
          id: "s10-2",
          taskId: "t10",
          title: "Implement IP geolocation check",
          done: false,
          assignee: USERS[3],
        },
        {
          id: "s10-3",
          taskId: "t10",
          title: "Add velocity limiting",
          done: false,
          assignee: USERS[3],
        },
        {
          id: "s10-4",
          taskId: "t10",
          title: "Create admin review queue",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t11",
      epicId: "e2",
      title: "Recurring Billing Support",
      description:
        "Enable subscription-based products with automatic billing, cancellation, and payment retry logic.",
      assignee: null, // UNASSIGNED
      status: "To Do",
      priority: "Low",
      dueDate: "2026-02-28",
      estimate: 18,
      subtasks: [
        {
          id: "s11-1",
          taskId: "t11",
          title: "Design subscription data model",
          done: false,
        },
        {
          id: "s11-2",
          taskId: "t11",
          title: "Implement billing scheduler",
          done: false,
        },
        {
          id: "s11-3",
          taskId: "t11",
          title: "Add cancellation flow",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t12",
      epicId: "e2",
      title: "Multi-Currency Support",
      description:
        "Support USD, EUR, GBP with real-time exchange rates and automatic currency detection by geo-IP.",
      assignee: USERS[3], // Backend Dev
      status: "To Do",
      priority: "Medium",
      dueDate: "2026-02-25",
      estimate: 10,
      subtasks: [
        {
          id: "s12-1",
          taskId: "t12",
          title: "Integrate exchange rate API",
          done: false,
          assignee: USERS[3],
        },
        {
          id: "s12-2",
          taskId: "t12",
          title: "Add currency selector to UI",
          done: false,
          assignee: USERS[2],
        },
        {
          id: "s12-3",
          taskId: "t12",
          title: "Update pricing display logic",
          done: false,
        },
      ],
      comments: [],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // Epic 3: Mobile App MVP (e3)
    // Status: Not Started | Members: u1, u2, u3, u5
    // ═══════════════════════════════════════════════════════════════════════════
    {
      id: "t13",
      epicId: "e3",
      title: "React Native Project Setup",
      description:
        "Initialize React Native project with navigation, auth scaffolding, and API client setup.",
      assignee: USERS[2], // Frontend Dev
      status: "To Do",
      priority: "High",
      dueDate: "2026-03-05",
      estimate: 8,
      subtasks: [
        {
          id: "s13-1",
          taskId: "t13",
          title: "Initialize RN project",
          done: false,
        },
        {
          id: "s13-2",
          taskId: "t13",
          title: "Setup React Navigation",
          done: false,
        },
        {
          id: "s13-3",
          taskId: "t13",
          title: "Configure environment variables",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t14",
      epicId: "e3",
      title: "Product Browsing Screens",
      description:
        "Implement home, category, product listing, and product detail screens for mobile.",
      assignee: null, // UNASSIGNED
      status: "To Do",
      priority: "High",
      dueDate: "2026-03-12",
      estimate: 16,
      subtasks: [
        {
          id: "s14-1",
          taskId: "t14",
          title: "Design mobile screens",
          done: false,
          assignee: USERS[4],
        },
        {
          id: "s14-2",
          taskId: "t14",
          title: "Implement home screen",
          done: false,
        },
        {
          id: "s14-3",
          taskId: "t14",
          title: "Implement product list",
          done: false,
        },
        {
          id: "s14-4",
          taskId: "t14",
          title: "Implement product detail",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t15",
      epicId: "e3",
      title: "Wishlist Feature",
      description:
        "Allow users to save products to wishlist with sync across web and mobile.",
      assignee: USERS[2], // Frontend Dev
      status: "To Do",
      priority: "Medium",
      dueDate: "2026-03-18",
      estimate: 6,
      subtasks: [
        {
          id: "s15-1",
          taskId: "t15",
          title: "Design wishlist UI",
          done: false,
        },
        {
          id: "s15-2",
          taskId: "t15",
          title: "Implement wishlist API",
          done: false,
        },
        { id: "s15-3", taskId: "t15", title: "Add sync logic", done: false },
      ],
      comments: [],
    },
    {
      id: "t16",
      epicId: "e3",
      title: "Push Notifications Setup",
      description:
        "Configure Firebase Cloud Messaging for order updates, promotions, and abandoned cart reminders.",
      assignee: USERS[2], // Frontend Dev
      status: "To Do",
      priority: "Medium",
      dueDate: "2026-03-22",
      estimate: 10,
      subtasks: [
        {
          id: "s16-1",
          taskId: "t16",
          title: "Setup Firebase project",
          done: false,
        },
        { id: "s16-2", taskId: "t16", title: "Integrate FCM SDK", done: false },
        {
          id: "s16-3",
          taskId: "t16",
          title: "Build notification handler",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t17",
      epicId: "e3",
      title: "Quick Checkout Flow",
      description:
        "Streamlined mobile checkout with saved payment methods and one-tap confirmation.",
      assignee: null, // UNASSIGNED
      status: "To Do",
      priority: "High",
      dueDate: "2026-03-25",
      estimate: 12,
      subtasks: [
        {
          id: "s17-1",
          taskId: "t17",
          title: "Design mobile checkout flow",
          done: false,
        },
        {
          id: "s17-2",
          taskId: "t17",
          title: "Implement checkout screens",
          done: false,
        },
        {
          id: "s17-3",
          taskId: "t17",
          title: "Integrate mobile payment SDKs",
          done: false,
        },
      ],
      comments: [],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // Epic 4: Analytics & Reporting System (e4)
    // Status: In Progress | Members: u1, u2, u4
    // ═══════════════════════════════════════════════════════════════════════════
    {
      id: "t18",
      epicId: "e4",
      title: "Real-Time Sales Dashboard",
      description:
        "Live dashboard showing revenue, orders, conversion rate, and top products with hourly granularity.",
      assignee: USERS[3], // Backend Dev
      status: "In Progress",
      priority: "High",
      dueDate: "2026-02-07", // OVERDUE
      estimate: 14,
      subtasks: [
        {
          id: "s18-1",
          taskId: "t18",
          title: "Design dashboard layout",
          done: true,
          assignee: USERS[0],
        },
        {
          id: "s18-2",
          taskId: "t18",
          title: "Implement metrics aggregation",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s18-3",
          taskId: "t18",
          title: "Build real-time data pipeline",
          done: false,
          assignee: USERS[3],
        },
        {
          id: "s18-4",
          taskId: "t18",
          title: "Add chart visualizations",
          done: false,
        },
      ],
      comments: [
        {
          id: "c18-1",
          taskId: "t18",
          author: USERS[1],
          text: "Sales team needs this yesterday. Escalating.",
          createdAt: "2026-02-08 08:00",
        },
      ],
    },
    {
      id: "t19",
      epicId: "e4",
      title: "User Behavior Tracking",
      description:
        "Track page views, clicks, add-to-cart events, and checkout funnel drop-offs.",
      assignee: USERS[3], // Backend Dev
      status: "Done",
      priority: "High",
      dueDate: "2026-02-10",
      estimate: 10,
      subtasks: [
        {
          id: "s19-1",
          taskId: "t19",
          title: "Integrate analytics SDK",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s19-2",
          taskId: "t19",
          title: "Define tracking events",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s19-3",
          taskId: "t19",
          title: "Implement event logging",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s19-4",
          taskId: "t19",
          title: "Build funnel visualization",
          done: true,
          assignee: USERS[0],
        },
      ],
      comments: [],
    },
    {
      id: "t20",
      epicId: "e4",
      title: "Conversion Rate Optimization Report",
      description:
        "Weekly automated report showing conversion trends, A/B test results, and recommendations.",
      assignee: USERS[3], // Backend Dev
      status: "To Do",
      priority: "Medium",
      dueDate: "2026-02-18",
      estimate: 8,
      subtasks: [
        {
          id: "s20-1",
          taskId: "t20",
          title: "Design report template",
          done: false,
        },
        {
          id: "s20-2",
          taskId: "t20",
          title: "Implement report generator",
          done: false,
          assignee: USERS[3],
        },
        {
          id: "s20-3",
          taskId: "t20",
          title: "Setup email delivery",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t21",
      epicId: "e4",
      title: "Automated Data Export to BI Tool",
      description:
        "Daily export of sales and analytics data to Tableau/Power BI for executive dashboards.",
      assignee: USERS[3], // Backend Dev
      status: "To Do",
      priority: "Low",
      dueDate: "2026-02-25",
      estimate: 6,
      subtasks: [
        {
          id: "s21-1",
          taskId: "t21",
          title: "Setup ETL pipeline",
          done: false,
        },
        {
          id: "s21-2",
          taskId: "t21",
          title: "Configure BI tool connection",
          done: false,
        },
        {
          id: "s21-3",
          taskId: "t21",
          title: "Schedule daily exports",
          done: false,
        },
      ],
      comments: [],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // Epic 5: Customer Support Portal (e5)
    // Status: On Hold | Members: u1, u2, u3, u4, u5
    // ═══════════════════════════════════════════════════════════════════════════
    {
      id: "t22",
      epicId: "e5",
      title: "Ticket System Implementation",
      description:
        "Build support ticket system with categories, priority levels, and assignment workflow.",
      assignee: null, // UNASSIGNED
      status: "To Do",
      priority: "Medium",
      dueDate: "2026-03-05",
      estimate: 16,
      subtasks: [
        {
          id: "s22-1",
          taskId: "t22",
          title: "Design ticket data model",
          done: false,
        },
        {
          id: "s22-2",
          taskId: "t22",
          title: "Build ticket submission form",
          done: false,
        },
        {
          id: "s22-3",
          taskId: "t22",
          title: "Implement admin ticket queue",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t23",
      epicId: "e5",
      title: "Live Chat Integration",
      description:
        "Integrate Intercom or Zendesk Chat for real-time customer support during business hours.",
      assignee: USERS[4], // Designer
      status: "To Do",
      priority: "Low",
      dueDate: "2026-03-12",
      estimate: 8,
      subtasks: [
        {
          id: "s23-1",
          taskId: "t23",
          title: "Choose chat provider",
          done: false,
        },
        {
          id: "s23-2",
          taskId: "t23",
          title: "Integrate chat widget",
          done: false,
        },
        {
          id: "s23-3",
          taskId: "t23",
          title: "Configure business hours",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t24",
      epicId: "e5",
      title: "Knowledge Base CMS",
      description:
        "Self-service knowledge base with FAQs, how-to articles, and searchable content.",
      assignee: USERS[4], // Designer
      status: "To Do",
      priority: "Medium",
      dueDate: "2026-03-15",
      estimate: 12,
      subtasks: [
        {
          id: "s24-1",
          taskId: "t24",
          title: "Design KB layout",
          done: false,
          assignee: USERS[4],
        },
        { id: "s24-2", taskId: "t24", title: "Build article CMS", done: false },
        {
          id: "s24-3",
          taskId: "t24",
          title: "Implement search functionality",
          done: false,
        },
      ],
      comments: [],
    },
    {
      id: "t25",
      epicId: "e5",
      title: "Order Tracking Portal",
      description:
        "Customer-facing order tracking with shipping updates and delivery estimates.",
      assignee: null, // UNASSIGNED
      status: "To Do",
      priority: "Medium",
      dueDate: "2026-03-18",
      estimate: 10,
      subtasks: [
        {
          id: "s25-1",
          taskId: "t25",
          title: "Design tracking page",
          done: false,
        },
        {
          id: "s25-2",
          taskId: "t25",
          title: "Integrate shipping APIs",
          done: false,
        },
        { id: "s25-3", taskId: "t25", title: "Build tracking UI", done: false },
      ],
      comments: [],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // Epic 6: Infrastructure Migration (e6) - COMPLETED
    // Status: Done | Members: u1, u2, u6
    // ═══════════════════════════════════════════════════════════════════════════
    {
      id: "t26",
      epicId: "e6",
      title: "Kubernetes Cluster Setup",
      description:
        "Setup production-ready K8s cluster with auto-scaling, load balancing, and monitoring.",
      assignee: USERS[3], // Backend Dev
      status: "Done",
      priority: "High",
      dueDate: "2026-01-10",
      estimate: 20,
      subtasks: [
        {
          id: "s26-1",
          taskId: "t26",
          title: "Provision K8s cluster",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s26-2",
          taskId: "t26",
          title: "Configure auto-scaling",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s26-3",
          taskId: "t26",
          title: "Setup load balancers",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s26-4",
          taskId: "t26",
          title: "Install monitoring stack",
          done: true,
          assignee: USERS[3],
        },
      ],
      comments: [],
    },
    {
      id: "t27",
      epicId: "e6",
      title: "Application Migration",
      description:
        "Containerize application, create deployment manifests, and migrate databases.",
      assignee: USERS[3], // Backend Dev
      status: "Done",
      priority: "High",
      dueDate: "2026-01-20",
      estimate: 16,
      subtasks: [
        {
          id: "s27-1",
          taskId: "t27",
          title: "Dockerize application",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s27-2",
          taskId: "t27",
          title: "Create K8s manifests",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s27-3",
          taskId: "t27",
          title: "Migrate database",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s27-4",
          taskId: "t27",
          title: "Run smoke tests",
          done: true,
          assignee: USERS[0],
        },
      ],
      comments: [],
    },
    {
      id: "t28",
      epicId: "e6",
      title: "Disaster Recovery Setup",
      description:
        "Implement automated backups, failover procedures, and recovery testing.",
      assignee: USERS[3], // Backend Dev
      status: "Done",
      priority: "Medium",
      dueDate: "2026-01-28",
      estimate: 12,
      subtasks: [
        {
          id: "s28-1",
          taskId: "t28",
          title: "Setup automated backups",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s28-2",
          taskId: "t28",
          title: "Document recovery procedures",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s28-3",
          taskId: "t28",
          title: "Test failover scenario",
          done: true,
          assignee: USERS[3],
        },
      ],
      comments: [],
    },
    {
      id: "t29",
      epicId: "e6",
      title: "Monitoring & Alerting",
      description:
        "Setup Prometheus, Grafana dashboards, and PagerDuty integration for alerts.",
      assignee: USERS[3], // Backend Dev
      status: "Done",
      priority: "High",
      dueDate: "2026-01-25",
      estimate: 10,
      subtasks: [
        {
          id: "s29-1",
          taskId: "t29",
          title: "Install Prometheus",
          done: true,
          assignee: USERS[3],
        },
        {
          id: "s29-2",
          taskId: "t29",
          title: "Create Grafana dashboards",
          done: true,
          assignee: USERS[0],
        },
        {
          id: "s29-3",
          taskId: "t29",
          title: "Configure PagerDuty",
          done: true,
          assignee: USERS[3],
        },
      ],
      comments: [],
    },
  ];

  // Enrich all tasks with default fields
  return rawTasks.map((task) => enrichTask(task, USERS));
}
