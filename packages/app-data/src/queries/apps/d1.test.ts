import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { createDatabase } from "../../client";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import {
  addWhatsAppConnection,
  createApp,
  deleteApp,
  getAppByAppId,
  getAppBySlackTeamId,
  getAppByWhatsAppNumber,
  getApps,
  removeWhatsAppConnection,
  updateAppSettings,
  updateAppSettingsBulk,
  updateAppTokens,
  WhatsAppAlreadyConnectedToAnotherTeamError,
} from "../apps";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0008_installed_apps.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("installed apps D1", () => {
  test("serves installed app CRUD, config, and settings from D1", async () => {
    const { d1, close } = createD1();
    const db = createDatabase({
      cloudflare: { d1 },
    });

    try {
      const created = await createApp(db, {
        teamId: "team-1",
        createdByUserId: "user-1",
        appId: "slack",
        config: { team_id: "slack-team-1", channel_id: "channel-1" },
        settings: [{ id: "notify", value: true }],
      });

      expect(created).toMatchObject({
        teamId: "team-1",
        createdBy: "user-1",
        appId: "slack",
      });

      await expect(getApps(db, "team-1")).resolves.toEqual([
        {
          app_id: "slack",
          settings: [{ id: "notify", value: true }],
          config: { team_id: "slack-team-1", channel_id: "channel-1" },
          createdAt: created.createdAt,
        },
      ]);
      await expect(
        getAppBySlackTeamId(db, {
          slackTeamId: "slack-team-1",
          channelId: "channel-1",
        }),
      ).resolves.toMatchObject({ id: created.id });

      await expect(
        updateAppTokens(db, {
          teamId: "team-1",
          appId: "slack",
          accessToken: "access",
          refreshToken: "refresh",
          expiresAt: "2026-05-15T12:00:00.000Z",
        }),
      ).resolves.toMatchObject({
        config: {
          team_id: "slack-team-1",
          channel_id: "channel-1",
          accessToken: "access",
          refreshToken: "refresh",
          expiresAt: "2026-05-15T12:00:00.000Z",
        },
      });

      await expect(
        updateAppSettings(db, {
          teamId: "team-1",
          appId: "slack",
          option: { id: "notify", value: false },
        }),
      ).resolves.toMatchObject({
        settings: [{ id: "notify", value: false }],
      });

      await expect(
        updateAppSettingsBulk(db, {
          teamId: "team-1",
          appId: "slack",
          settings: [{ id: "digest", value: "daily" }],
        }),
      ).resolves.toMatchObject({
        settings: [{ id: "digest", value: "daily" }],
      });

      await expect(deleteApp(db, { teamId: "team-1", appId: "slack" })).resolves.toMatchObject({
        id: created.id,
      });
      await expect(getAppByAppId(db, { teamId: "team-1", appId: "slack" })).resolves.toBeNull();
    } finally {
      close();
    }
  });

  test("manages WhatsApp connections from D1", async () => {
    const { d1, close } = createD1();
    const db = createDatabase({
      cloudflare: { d1 },
    });

    try {
      const first = await addWhatsAppConnection(db, {
        teamId: "team-1",
        phoneNumber: "+441234",
        displayName: "Main",
      });

      expect(first).toMatchObject({
        teamId: "team-1",
        appId: "whatsapp",
        config: {
          connections: [
            expect.objectContaining({
              phoneNumber: "+441234",
              displayName: "Main",
            }),
          ],
        },
      });
      await expect(getAppByWhatsAppNumber(db, "+441234")).resolves.toMatchObject({
        id: first.id,
      });

      await addWhatsAppConnection(db, {
        teamId: "team-1",
        phoneNumber: "+445678",
      });
      await expect(
        addWhatsAppConnection(db, {
          teamId: "team-2",
          phoneNumber: "+441234",
        }),
      ).rejects.toBeInstanceOf(WhatsAppAlreadyConnectedToAnotherTeamError);

      await expect(
        removeWhatsAppConnection(db, {
          teamId: "team-1",
          phoneNumber: "+441234",
        }),
      ).resolves.toMatchObject({
        config: {
          connections: [expect.objectContaining({ phoneNumber: "+445678" })],
        },
      });

      await expect(
        removeWhatsAppConnection(db, {
          teamId: "team-1",
          phoneNumber: "+445678",
        }),
      ).resolves.toBeNull();
      await expect(getAppByAppId(db, { teamId: "team-1", appId: "whatsapp" })).resolves.toBeNull();
    } finally {
      close();
    }
  });
});
