import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../client";
import {
  deleteTrackerEntryFromD1,
  getCurrentTrackerTimerFromD1,
  getTrackerEntriesByProjectIdsFromD1,
  getTrackerEntriesByRangeFromD1,
  startTrackerTimerInD1,
  stopTrackerTimerInD1,
  upsertTrackerEntriesInD1,
} from "./tracker-entries/d1";
import {
  deleteTrackerProjectFromD1,
  getTrackerProjectAssignmentsForProjectIdsFromD1,
  getTrackerProjectByIdFromD1,
  getTrackerProjectsByCustomerIdsFromD1,
  getTrackerProjectsFromD1,
  replaceTrackerProjectTagsInD1,
  searchTrackerProjectsFromD1,
  upsertTrackerProjectInD1,
} from "./tracker-projects/d1";

class SqliteD1Statement implements CloudflareD1PreparedStatementBinding {
  constructor(
    private readonly statement: ReturnType<SqliteDatabase["prepare"]>,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new SqliteD1Statement(this.statement, values);
  }

  async first<T = unknown>(columnName?: string) {
    const row = (this.statement as any).get(...this.values) as Record<string, unknown> | null;

    if (columnName) {
      return (row?.[columnName] ?? null) as T | null;
    }

    return row as T | null;
  }

  async all<T = unknown>() {
    return {
      results: (this.statement as any).all(...this.values) as T[],
      success: true,
    };
  }

  async run<T = unknown>() {
    (this.statement as any).run(...this.values);

    return {
      results: [] as T[],
      success: true,
    };
  }

  async raw<T = unknown[]>() {
    return (this.statement as any).values(...this.values) as T[];
  }
}

class SqliteD1Database implements CloudflareD1DatabaseBinding {
  constructor(private readonly db: SqliteDatabase) {}

  prepare(query: string) {
    return new SqliteD1Statement(this.db.prepare(query));
  }

  async batch<T = unknown>(statements: CloudflareD1PreparedStatementBinding[]) {
    const results = [];

    for (const statement of statements) {
      results.push(await statement.run<T>());
    }

    return results;
  }

  async exec(query: string) {
    this.db.exec(query);

    return {
      count: 0,
      duration: 0,
    };
  }
}

function createD1() {
  const sqlite = new SqliteDatabase(":memory:");
  const d1 = new SqliteD1Database(sqlite);
  const migration = readFileSync(
    resolve(import.meta.dir, "../../../../api/migrations/d1/0042_tracker.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("tracker D1", () => {
  test("manages projects and tag assignments", async () => {
    const { d1, close } = createD1();

    try {
      await upsertTrackerProjectInD1(d1, {
        id: "project-1",
        teamId: "team-1",
        name: "Website build",
        description: "Client portal",
        customerId: "customer-1",
        billable: true,
        currency: "GBP",
        rate: 125,
      });
      await upsertTrackerProjectInD1(d1, {
        id: "project-2",
        teamId: "team-1",
        name: "Internal ops",
        status: "completed",
        customerId: "customer-2",
      });

      await replaceTrackerProjectTagsInD1(d1, {
        teamId: "team-1",
        trackerProjectId: "project-1",
        tagIds: ["tag-1", "tag-2"],
      });

      const tagged = await getTrackerProjectsFromD1(d1, {
        teamId: "team-1",
        tagIds: ["tag-2"],
      });
      expect(tagged.map((project) => project.id)).toEqual(["project-1"]);

      const assignments = await getTrackerProjectAssignmentsForProjectIdsFromD1(d1, {
        teamId: "team-1",
        trackerProjectIds: ["project-1"],
      });
      expect(assignments.map((assignment) => assignment.tagId).sort()).toEqual(["tag-1", "tag-2"]);

      const search = await searchTrackerProjectsFromD1(d1, {
        teamId: "team-1",
        query: "portal",
      });
      expect(search.map((project) => project.id)).toEqual(["project-1"]);

      const customerProjects = await getTrackerProjectsByCustomerIdsFromD1(d1, {
        teamId: "team-1",
        customerIds: ["customer-1"],
      });
      expect(customerProjects.map((project) => project.id)).toEqual(["project-1"]);

      await deleteTrackerProjectFromD1(d1, {
        teamId: "team-1",
        id: "project-1",
      });

      expect(
        await getTrackerProjectByIdFromD1(d1, { teamId: "team-1", id: "project-1" }),
      ).toBeNull();
      expect(
        await getTrackerProjectAssignmentsForProjectIdsFromD1(d1, {
          teamId: "team-1",
          trackerProjectIds: ["project-1"],
        }),
      ).toEqual([]);
    } finally {
      close();
    }
  });

  test("manages entries and timers", async () => {
    const { d1, close } = createD1();

    try {
      await upsertTrackerEntriesInD1(d1, {
        teamId: "team-1",
        entries: [
          {
            id: "entry-1",
            teamId: "team-1",
            projectId: "project-1",
            assignedId: "user-1",
            date: "2026-05-15",
            start: "2026-05-15T09:00:00.000Z",
            stop: "2026-05-15T10:00:00.000Z",
            duration: 3600,
            billed: false,
          },
        ],
      });

      const range = await getTrackerEntriesByRangeFromD1(d1, {
        teamId: "team-1",
        from: "2026-05-01",
        to: "2026-05-31",
        assignedId: "user-1",
      });
      expect(range.map((entry) => entry.id)).toEqual(["entry-1"]);

      const byProject = await getTrackerEntriesByProjectIdsFromD1(d1, {
        teamId: "team-1",
        projectIds: ["project-1"],
      });
      expect(byProject).toHaveLength(1);

      await startTrackerTimerInD1(d1, {
        teamId: "team-1",
        id: "timer-1",
        projectId: "project-1",
        assignedId: "user-1",
        start: "2026-05-15T11:00:00.000Z",
      });
      expect((await getCurrentTrackerTimerFromD1(d1, { teamId: "team-1" }))?.id).toBe("timer-1");

      const stopped = await stopTrackerTimerInD1(d1, {
        teamId: "team-1",
        assignedId: "user-1",
        stop: "2026-05-15T11:02:00.000Z",
      });
      expect(stopped.discarded).toBe(false);
      expect(stopped.duration).toBe(120);

      await startTrackerTimerInD1(d1, {
        teamId: "team-1",
        id: "timer-short",
        projectId: "project-1",
        start: "2026-05-15T12:00:00.000Z",
      });
      const discarded = await stopTrackerTimerInD1(d1, {
        teamId: "team-1",
        id: "timer-short",
        stop: "2026-05-15T12:00:20.000Z",
      });
      expect(discarded.discarded).toBe(true);

      await deleteTrackerEntryFromD1(d1, { teamId: "team-1", id: "entry-1" });
      expect(
        await getTrackerEntriesByProjectIdsFromD1(d1, {
          teamId: "team-1",
          projectIds: ["project-1"],
        }),
      ).toHaveLength(1);
    } finally {
      close();
    }
  });
});
