import { describe, expect, test } from "bun:test";
import {
  createServiceIdentityToken,
  verifyServiceIdentityToken,
  type ServiceVerificationCredential,
} from "./service-identity";

const current = {
  keyId: "worker-v2",
  secret: "current-worker-secret-with-at-least-32-characters",
} satisfies ServiceVerificationCredential;
const previous = {
  keyId: "worker-v1",
  secret: "previous-worker-secret-with-at-least-32-characters",
};

describe("scoped service identities", () => {
  test("verifies current keys and returns fixed service scopes", async () => {
    const token = await createServiceIdentityToken({
      serviceId: "worker",
      audience: "api",
      credential: current,
      now: 1_800_000_000,
    });
    const identity = await verifyServiceIdentityToken({
      token,
      audience: "api",
      credentials: { worker: { ...current, previous } },
      now: 1_800_000_010,
    });

    expect(identity?.id).toBe("worker");
    expect(identity?.keyId).toBe("worker-v2");
    expect(identity?.scopes).toEqual(["banking.read", "banking.write", "jobs.dispatch"]);
  });

  test("accepts the explicitly configured previous key during rotation", async () => {
    const token = await createServiceIdentityToken({
      serviceId: "worker",
      audience: "api",
      credential: previous,
      now: 1_800_000_000,
    });

    await expect(
      verifyServiceIdentityToken({
        token,
        audience: "api",
        credentials: { worker: { ...current, previous } },
        now: 1_800_000_010,
      }),
    ).resolves.toMatchObject({ keyId: "worker-v1" });
  });

  test("rejects wrong audience, unknown keys, and expired tokens", async () => {
    const token = await createServiceIdentityToken({
      serviceId: "worker",
      audience: "api",
      credential: current,
      now: 1_800_000_000,
    });

    await expect(
      verifyServiceIdentityToken({
        token,
        audience: "documents",
        credentials: { worker: current },
        now: 1_800_000_010,
      }),
    ).resolves.toBeNull();
    await expect(
      verifyServiceIdentityToken({
        token,
        audience: "api",
        credentials: {
          worker: {
            keyId: "worker-v3",
            secret: "another-worker-secret-with-at-least-32-characters",
          },
        },
        now: 1_800_000_010,
      }),
    ).resolves.toBeNull();
    await expect(
      verifyServiceIdentityToken({
        token,
        audience: "api",
        credentials: { worker: current },
        now: 1_800_000_120,
      }),
    ).resolves.toBeNull();
  });
});
