import type { DashboardModule } from "@/modules/dashboard/types";

export const dashboardModules: DashboardModule[] = [
  {
    id: "sales-checkout",
    name: "Sales / Checkout",
    description:
      "Main cashier flow for fast product selection, cart handling, and payment completion.",
    features: [
      "Product selection",
      "Cart management",
      "Discounts and tax",
      "Receipts, refunds, voids",
    ],
  },
  {
    id: "product-menu",
    name: "Product / Menu Management",
    description:
      "Maintain cookie SKUs, variants, flavors, images, and product availability.",
    features: [
      "Product CRUD",
      "Flavor management",
      "Variants and categories",
      "Availability toggles",
    ],
  },
  {
    id: "inventory-management",
    name: "Inventory Management",
    description:
      "Track ingredient and packaging stock, with low-stock and expiry monitoring.",
    features: [
      "Ingredient stock",
      "Low-stock alerts",
      "Stock adjustments",
      "Supplier receiving",
    ],
  },
  {
    id: "recipe-inventory",
    name: "Recipe-Based Inventory",
    description:
      "Map recipes to products and auto-deduct ingredients after completed sales.",
    features: [
      "Recipe assignment",
      "Ingredient quantity rules",
      "Automatic deduction",
      "Usage forecasting",
    ],
  },
  {
    id: "order-management",
    name: "Order Management",
    description:
      "Manage advance and bulk orders, pickup/delivery schedules, and status lifecycles.",
    features: [
      "Order creation",
      "Pickup scheduling",
      "Delivery scheduling",
      "Status tracking",
    ],
  },
  {
    id: "production-baking",
    name: "Production / Baking",
    description:
      "Plan daily batches, monitor kitchen queues, and track production waste.",
    features: [
      "Baking schedule",
      "Batch tracking",
      "Production planning",
      "Waste logging",
    ],
  },
  {
    id: "customer-loyalty",
    name: "Customer & Loyalty",
    description:
      "Build repeat purchases through customer history, points, and membership rules.",
    features: [
      "Customer profiles",
      "Purchase history",
      "Loyalty points",
      "Membership discounts",
    ],
  },
  {
    id: "reporting-analytics",
    name: "Reporting & Analytics",
    description:
      "Give owners and managers visibility into sales, inventory usage, and profitability.",
    features: [
      "Daily sales report",
      "Best sellers",
      "Waste analysis",
      "Profit margin metrics",
    ],
  },
  {
    id: "employee-user",
    name: "Employee / User Management",
    description:
      "Control authentication, roles, shifts, and audit logs for staff operations.",
    features: ["Staff login", "Role permissions", "Cashier shifts", "Activity logs"],
  },
  {
    id: "payment",
    name: "Payment",
    description:
      "Handle cash and digital channels with confirmation, split tenders, and refunds.",
    features: ["Cash and card", "GCash and Maya", "Split payments", "Refund support"],
  },
];
