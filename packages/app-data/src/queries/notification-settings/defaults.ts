import type { UserSettingsNotificationType } from "./types";

export const USER_SETTINGS_NOTIFICATION_TYPES: UserSettingsNotificationType[] = [
  {
    type: "transactions_created",
    channels: ["in_app", "email"],
    category: "transactions",
    order: 2,
  },
  {
    type: "invoice_paid",
    channels: ["in_app", "email"],
    category: "invoices",
    order: 1,
  },
  {
    type: "invoice_overdue",
    channels: ["in_app", "email"],
    category: "invoices",
    order: 1,
  },
  {
    type: "inbox_new",
    channels: ["in_app"],
    category: "inbox",
    order: 3,
  },
  {
    type: "inbox_auto_matched",
    channels: ["in_app"],
    category: "inbox",
    order: 1,
  },
  {
    type: "inbox_needs_review",
    channels: ["in_app"],
    category: "inbox",
    order: 2,
  },
  {
    type: "inbox_cross_currency_matched",
    channels: ["in_app"],
    category: "inbox",
    order: 3,
  },
  {
    type: "invoice_scheduled",
    channels: ["in_app"],
    category: "invoices",
    order: 1,
  },
  {
    type: "invoice_sent",
    channels: ["in_app"],
    category: "invoices",
    order: 1,
  },
  {
    type: "invoice_reminder_sent",
    channels: ["in_app"],
    category: "invoices",
    order: 1,
  },
  {
    type: "invoice_cancelled",
    channels: ["in_app"],
    category: "invoices",
    order: 1,
  },
  {
    type: "invoice_created",
    channels: ["in_app"],
    category: "invoices",
    order: 1,
  },
  {
    type: "invoice_refunded",
    channels: ["in_app"],
    category: "invoices",
    order: 1,
  },
  {
    type: "recurring_series_completed",
    channels: ["in_app"],
    category: "invoices",
    order: 1,
  },
  {
    type: "recurring_series_started",
    channels: ["in_app"],
    category: "invoices",
    order: 1,
  },
  {
    type: "recurring_series_paused",
    channels: ["in_app"],
    category: "invoices",
    order: 1,
  },
  {
    type: "recurring_invoice_upcoming",
    channels: ["in_app", "email"],
    category: "invoices",
    order: 1,
  },
  {
    type: "insight_ready",
    channels: ["in_app", "email"],
    category: "insights",
    order: 1,
  },
];
