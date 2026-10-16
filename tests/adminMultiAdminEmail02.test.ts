/**
 * @file tests/adminMultiAdminEmail02.test.ts
 * Unit tests for GHOSTAI ADMIN USERS + EMAIL EXPERIENCE 02 frontend services and flows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAdminSession,
  loginAdmin,
  fetchAdminUsers,
  inviteAdminUser,
  updateAdminUserStatus,
  fetchAdminAuditLogs,
  previewMemberEmail,
  sendMemberInvitations,
  activateAdminAccount,
} from "../src/services/adminService";

describe("Admin Users + Email Experience 02 Frontend Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchAdminSession parses owner and admin identities correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          authenticated: true,
          admin: {
            id: "owner-1",
            email: "owner@ghostai.app",
            name: "Arturo Owner",
            role: "owner",
          },
        }),
    });

    const session = await fetchAdminSession();
    expect(session.authenticated).toBe(true);
    expect(session.admin?.role).toBe("owner");
    expect(session.admin?.name).toBe("Arturo Owner");
  });

  it("loginAdmin supports email and password credentials object", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, authenticated: true }),
    });

    const success = await loginAdmin({
      email: "partner@example.com",
      password: "SecurePassword123!",
    });
    expect(success).toBe(true);

    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toContain("/api/admin/auth/login");
    expect(call[1].credentials).toBe("include");
    const body = JSON.parse(call[1].body);
    expect(body.email).toBe("partner@example.com");
    expect(body.password).toBe("SecurePassword123!");
  });

  it("fetchAdminUsers fetches users list for OWNER", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          users: [
            {
              id: "adm-1",
              name: "Socio Admin",
              email: "socio@example.com",
              role: "admin",
              status: "active",
              created_at: "2026-10-16T12:00:00Z",
              last_login_at: null,
            },
          ],
        }),
    });

    const users = await fetchAdminUsers();
    expect(users.length).toBe(1);
    expect(users[0].name).toBe("Socio Admin");
    expect(users[0].role).toBe("admin");
  });

  it("inviteAdminUser sends name, email, role and returns activation link", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          adminUser: {
            id: "new-admin-1",
            name: "QA Admin",
            email: "qa@smartbrain.lat",
            role: "admin",
            status: "pending",
          },
          activationToken: "tok_test_12345",
          activationLink: "https://ghostai-tts-studio.smartbrain.lat/admin/activate/tok_test_12345",
        }),
    });

    const res = await inviteAdminUser("QA Admin", "qa@smartbrain.lat", "admin");
    expect(res.adminUser.status).toBe("pending");
    expect(res.activationLink).toContain("/admin/activate/tok_test_12345");
  });

  it("updateAdminUserStatus toggles admin status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          adminUser: {
            id: "adm-1",
            status: "disabled",
          },
        }),
    });

    const updated = await updateAdminUserStatus("adm-1", "disabled");
    expect(updated.status).toBe("disabled");
  });

  it("fetchAdminAuditLogs retrieves immutable action logs", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          logs: [
            {
              id: "log-1",
              admin_id: "owner-1",
              admin_email: "owner@ghostai.app",
              admin_role: "owner",
              action: "invite_sent",
              target_id: "member-123",
              metadata: { sentCount: 1 },
              created_at: "2026-10-16T15:00:00Z",
            },
          ],
        }),
    });

    const logs = await fetchAdminAuditLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe("invite_sent");
  });

  it("previewMemberEmail returns HTML, plain text, and NEVER contains permanent gai_live_ key", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          preview: {
            to: "carlos@empresa.com",
            subject: "Tu acceso a GhostAI ya está listo",
            preheader: "Activa tu acceso a GhostAI TTS Studio.",
            html: "<html><body><table><tr><td>ACTIVAR MI ACCESO</td></tr></table></body></html>",
            text: "Hola Carlos,\n\nTu acceso a GhostAI ya está listo.\n\nActiva tu acceso:\nhttps://ghostai-tts-studio.smartbrain.lat/activate/one_time_token",
          },
        }),
    });

    const preview = await previewMemberEmail("member-1");
    expect(preview.subject).toBe("Tu acceso a GhostAI ya está listo");
    expect(preview.html).toContain("ACTIVAR MI ACCESO");
    expect(preview.text).toContain("https://ghostai-tts-studio.smartbrain.lat/activate/");
    // Critical safety check: Permanent key MUST NEVER be in email
    expect(preview.html).not.toContain("gai_live_");
    expect(preview.text).not.toContain("gai_live_");
  });

  it("sendMemberInvitations handles single and bulk sends without rolling back valid items", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          processed: 2,
          succeededCount: 2,
          failedCount: 0,
          succeeded: [
            { memberId: "m1", email: "m1@test.com", simulated: true },
            { memberId: "m2", email: "m2@test.com", simulated: true },
          ],
          failed: [],
        }),
    });

    const res = await sendMemberInvitations(["m1", "m2"]);
    expect(res.succeededCount).toBe(2);
    expect(res.succeeded.length).toBe(2);
  });

  it("activateAdminAccount completes activation flow and returns session", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          authenticated: true,
          admin: {
            id: "adm-activated",
            name: "Nuevo Admin",
            email: "nuevo@smartbrain.lat",
            role: "admin",
          },
        }),
    });

    const res = await activateAdminAccount("valid_token_xyz", "MySecurePass123!");
    expect(res.ok).toBe(true);
    expect(res.authenticated).toBe(true);
    expect(res.admin.role).toBe("admin");
  });
});
