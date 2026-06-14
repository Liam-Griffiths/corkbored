import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthError } from "../authz";

// Mock auth and prisma before importing authz functions
vi.mock("../auth", () => ({
  auth: vi.fn(),
}));
vi.mock("../db", () => ({
  prisma: {
    membership: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { auth } from "../auth";
import { prisma } from "../db";
import {
  requireUser,
  requireProjectOwner,
  requireProjectMember,
  requireAdmin,
} from "../authz";

const mockAuth = vi.mocked(auth);
const mockFindMembership = vi.mocked(prisma.membership.findUnique);
const mockFindUser = vi.mocked(prisma.user.findUnique);

const AUTHED_SESSION = { user: { id: "u1", name: "Test" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("returns user when session exists", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION as never);
    const user = await requireUser();
    expect(user.id).toBe("u1");
  });

  it("throws 401 when no session", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(requireUser()).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("requireProjectOwner", () => {
  it("passes for active owner", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION as never);
    mockFindMembership.mockResolvedValue({
      role: "owner",
      leftAt: null,
    } as never);
    await expect(requireProjectOwner("p1")).resolves.toBeDefined();
  });

  it("throws 403 for non-owner member", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION as never);
    mockFindMembership.mockResolvedValue({
      role: "member",
      leftAt: null,
    } as never);
    await expect(requireProjectOwner("p1")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("throws 403 when no membership", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION as never);
    mockFindMembership.mockResolvedValue(null);
    await expect(requireProjectOwner("p1")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("throws 403 for owner who left", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION as never);
    mockFindMembership.mockResolvedValue({
      role: "owner",
      leftAt: new Date(),
    } as never);
    await expect(requireProjectOwner("p1")).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("requireProjectMember", () => {
  it("passes for active member", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION as never);
    mockFindMembership.mockResolvedValue({
      role: "member",
      leftAt: null,
    } as never);
    await expect(requireProjectMember("p1")).resolves.toBeDefined();
  });

  it("throws 403 when membership has leftAt set", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION as never);
    mockFindMembership.mockResolvedValue({
      role: "member",
      leftAt: new Date(),
    } as never);
    await expect(requireProjectMember("p1")).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("requireAdmin", () => {
  it("passes for admin user", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION as never);
    mockFindUser.mockResolvedValue({ isAdmin: true } as never);
    await expect(requireAdmin()).resolves.toBeDefined();
  });

  it("throws 403 for non-admin user", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION as never);
    mockFindUser.mockResolvedValue({ isAdmin: false } as never);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("throws 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });
});

describe("AuthError", () => {
  it("carries correct status code", () => {
    const e = new AuthError(403, "Forbidden");
    expect(e.status).toBe(403);
    expect(e).toBeInstanceOf(Error);
  });
});
