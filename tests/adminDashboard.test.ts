/**
 * @file tests/adminDashboard.test.ts
 * Tests for Admin Mode detection, Admin API Service, and Session Security.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAdminMode } from "../src/utils/environment";
import {
  loginAdmin,
  logoutAdmin,
  checkAdminStatus,
  fetchAdminClients,
  createAdminClient,
  createAdminToken,
  revokeAdminToken,
} from "../src/services/adminService";

describe("Admin Dashboard & Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("isAdminMode detects mode=admin query param accurately", () => {
    const originalWindow = (globalThis as any).window;
    
    (globalThis as any).window = { location: { search: "?mode=admin" } };
    expect(isAdminMode()).toBe(true);

    (globalThis as any).window = { location: { search: "?mode=receiver" } };
    expect(isAdminMode()).toBe(false);

    (globalThis as any).window = { location: { search: "" } };
    expect(isAdminMode()).toBe(false);

    (globalThis as any).window = originalWindow;
  });

  it("loginAdmin sends credentials with include and handles success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, authenticated: true }),
    });

    const success = await loginAdmin("secret_admin_credential");
    expect(success).toBe(true);

    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toContain("/api/admin/auth/login");
    expect(call[1].credentials).toBe("include");
    expect(JSON.parse(call[1].body)).toEqual({ adminToken: "secret_admin_credential" });
  });

  it("createAdminToken receives full token only once", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          token: "gai_live_ab12cd34.secret_full_key_here",
          tokenId: "token-uuid-1",
          clientId: "client-uuid-1",
          label: "Test Key",
          createdAt: new Date().toISOString(),
          expiresAt: null,
        }),
    });

    const res = await createAdminToken("client-uuid-1", "Test Key");
    expect(res.token).toBe("gai_live_ab12cd34.secret_full_key_here");
    expect(res.tokenId).toBe("token-uuid-1");
  });
});
