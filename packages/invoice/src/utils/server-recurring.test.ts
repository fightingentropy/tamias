import { describe, expect, test } from "bun:test";
import {
  advanceToFutureDate,
  calculateFirstScheduledDate,
  calculateNextScheduledDate,
  calculateUpcomingDates,
  type RecurringInvoiceParams,
  shouldMarkCompleted,
} from "./server-recurring";

describe("calculateNextScheduledDate", () => {
  describe("weekly frequency", () => {
    test("returns next occurrence of target weekday", () => {
      const currentDate = new Date("2025-01-07T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "weekly",
        frequencyDay: 5,
        frequencyWeek: null,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getDay()).toBe(5);
      expect(result > currentDate).toBe(true);
    });

    test("skips to next week if target day is today or passed", () => {
      const currentDate = new Date("2025-01-10T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "weekly",
        frequencyDay: 5,
        frequencyWeek: null,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getDay()).toBe(5);
      expect(result > currentDate).toBe(true);
    });

    test("handles Sunday correctly", () => {
      const currentDate = new Date("2025-01-08T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "weekly",
        frequencyDay: 0,
        frequencyWeek: null,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getDay()).toBe(0);
      expect(result > currentDate).toBe(true);
    });
  });

  describe("monthly_date frequency", () => {
    test("returns same date next month", () => {
      const currentDate = new Date("2025-01-15T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "monthly_date",
        frequencyDay: 15,
        frequencyWeek: null,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getMonth()).toBe(1);
      expect(result.getDate()).toBe(15);
    });

    test("handles 31st in month with 30 days", () => {
      const currentDate = new Date("2025-03-31T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "monthly_date",
        frequencyDay: 31,
        frequencyWeek: null,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getMonth()).toBe(3);
      expect(result.getDate()).toBe(30);
    });

    test("handles 31st in February (non-leap year)", () => {
      const currentDate = new Date("2025-01-31T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "monthly_date",
        frequencyDay: 31,
        frequencyWeek: null,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getMonth()).toBe(1);
      expect(result.getDate()).toBe(28);
    });

    test("handles 29th in February (leap year)", () => {
      const currentDate = new Date("2024-01-29T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "monthly_date",
        frequencyDay: 29,
        frequencyWeek: null,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getMonth()).toBe(1);
      expect(result.getDate()).toBe(29);
    });
  });

  describe("monthly_weekday frequency", () => {
    test("returns nth occurrence of weekday", () => {
      const currentDate = new Date("2025-01-01T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "monthly_weekday",
        frequencyDay: 5,
        frequencyWeek: 1,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getMonth()).toBe(1);
      expect(result.getDay()).toBe(5);
      expect(result.getDate()).toBe(7);
    });

    test("handles 2nd Tuesday correctly", () => {
      const currentDate = new Date("2025-01-01T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "monthly_weekday",
        frequencyDay: 2,
        frequencyWeek: 2,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getMonth()).toBe(1);
      expect(result.getDay()).toBe(2);
      expect(result.getDate()).toBe(11);
    });
  });

  describe("custom frequency", () => {
    test("returns current date plus interval days", () => {
      const currentDate = new Date("2025-01-01T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "custom",
        frequencyDay: null,
        frequencyWeek: null,
        frequencyInterval: 14,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    test("defaults to 1 day if interval not specified", () => {
      const currentDate = new Date("2025-01-01T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "custom",
        frequencyDay: null,
        frequencyWeek: null,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getDate()).toBe(2);
    });
  });

  describe("quarterly frequency", () => {
    test("returns same date 3 months later", () => {
      const currentDate = new Date("2025-01-15T12:00:00.000Z");
      const params: RecurringInvoiceParams = {
        frequency: "quarterly",
        frequencyDay: 15,
        frequencyWeek: null,
        frequencyInterval: null,
        timezone: "UTC",
      };

      const result = calculateNextScheduledDate(params, currentDate);

      expect(result.getMonth()).toBe(3);
      expect(result.getDate()).toBe(15);
    });
  });
});

describe("shouldMarkCompleted", () => {
  test("never-ending series never completes", () => {
    expect(shouldMarkCompleted("never", null, null, 100, new Date())).toBe(false);
  });

  test("on_date completes when next date exceeds end date", () => {
    const endDate = new Date("2025-02-01T00:00:00.000Z");
    const nextScheduledAt = new Date("2025-02-02T00:00:00.000Z");
    expect(shouldMarkCompleted("on_date", endDate, null, 5, nextScheduledAt)).toBe(true);
  });

  test("after_count completes when count reached", () => {
    expect(shouldMarkCompleted("after_count", null, 12, 12, new Date())).toBe(true);
  });
});

describe("calculateUpcomingDates", () => {
  const baseParams: RecurringInvoiceParams = {
    frequency: "monthly_date",
    frequencyDay: 15,
    frequencyWeek: null,
    frequencyInterval: null,
    timezone: "UTC",
  };

  test("returns limited upcoming invoices", () => {
    const result = calculateUpcomingDates(
      baseParams,
      new Date("2025-01-15T00:00:00.000Z"),
      100,
      "GBP",
      "never",
      null,
      null,
      0,
      3,
    );

    expect(result.invoices).toHaveLength(3);
    expect(result.summary.totalCount).toBeNull();
    expect(result.summary.currency).toBe("GBP");
  });
});

describe("calculateFirstScheduledDate", () => {
  const baseParams: RecurringInvoiceParams = {
    frequency: "monthly_date",
    frequencyDay: 15,
    frequencyWeek: null,
    frequencyInterval: null,
    timezone: "UTC",
  };

  test("schedules future issue dates in the future", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const issueDate = new Date("2026-01-31T00:00:00.000Z");
    const result = calculateFirstScheduledDate(baseParams, issueDate, now);

    expect(result.toISOString()).toBe(issueDate.toISOString());
  });

  test("uses now for current or past issue dates", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const issueDate = new Date("2026-01-15T00:00:00.000Z");
    const result = calculateFirstScheduledDate(baseParams, issueDate, now);

    expect(result.toISOString()).toBe(now.toISOString());
  });
});

describe("advanceToFutureDate", () => {
  test("advances late schedules until they are in the future", () => {
    const params: RecurringInvoiceParams = {
      frequency: "biweekly",
      frequencyDay: null,
      frequencyWeek: null,
      frequencyInterval: null,
      timezone: "UTC",
    };

    const scheduledDate = new Date("2025-01-15T00:00:00.000Z");
    const now = new Date("2025-01-21T00:00:00.000Z");
    const result = advanceToFutureDate(params, scheduledDate, now);

    expect(result.date > now).toBe(true);
    expect(result.intervalsSkipped).toBeGreaterThan(0);
    expect(result.hitSafetyLimit).toBe(false);
  });
});
