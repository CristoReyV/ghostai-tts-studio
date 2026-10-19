import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdminMember } from "../src/services/adminService";
import { markMemberEmail } from "../src/services/adminService";
import { getMemberOperationalState, matchesMemberFilters } from "../src/services/memberOperations";
import { MemberOperationDetails, MemberOperationalBadge } from "../src/components/Admin/MemberOperationDetails";
const member = (overrides: Partial<AdminMember> = {}): AdminMember => ({
  id: "qa", client_id: "client", key_id: "key", name: "QA Elena", email: "elena@example.test", access_plan: "monthly", status: "pending",
  created_at: "2026-10-19", invited_at: null, activated_at: null, expires_at: null, revoked_at: null,
  operational: { status: "READY_TO_SEND", label: "LISTO PARA ENVIAR", recommendedAction: "ENVIAR ACCESO NUEVO", severity: "attention", needsAction: true, emailType: "NEW_ACCESS" }, ...overrides,
});
afterEach(() => vi.unstubAllGlobals());
describe("admin operations 08", () => {
  it("composes needs action with search, plan and technical status", () => {
    const filters = { search: "ELENA", plan: "monthly", status: "pending", needsAction: true };
    expect(matchesMemberFilters(member(), filters)).toBe(true);
    expect(matchesMemberFilters(member({ access_plan: "annual" }), filters)).toBe(false);
    expect(matchesMemberFilters(member(), { ...filters, search: "absent" })).toBe(false);
    expect(matchesMemberFilters(member(), { ...filters, status: "active" })).toBe(false);
    const normal = member({ operational: { ...member().operational!, status: "ACTIVE", needsAction: false } });
    expect(matchesMemberFilters(normal, filters)).toBe(false);
    expect(matchesMemberFilters(normal, { ...filters, needsAction: false })).toBe(true);
    expect([member(), normal].filter(m => getMemberOperationalState(m).needsAction)).toHaveLength(1);
  });
  it("renders operation, actor, role, date, type and explicit undo without secrets", () => {
    const sent = member({ last_email_status: "sent", last_email_sent_at: "2026-10-19T16:32:00Z", last_email_sent_by_name: "Socio QA", last_email_sent_by_role: "operator", last_email_type: "ACCESS_REPLACEMENT" });
    const html = renderToStaticMarkup(<MemberOperationDetails member={sent} busy={false} onUndo={() => {}} />);
    expect(html).toContain("OPERACIÓN"); expect(html).toContain("Socio QA"); expect(html).toContain("OPERATOR");
    expect(html).toContain("Reemplazo de acceso"); expect(html).toContain("10:32"); expect(html).toContain("DESMARCAR ENVÍO");
    expect(html).not.toContain("gai_live_");
    expect(renderToStaticMarkup(<MemberOperationalBadge member={member()} />)).toContain("LISTO PARA ENVIAR");
  });
  it("sends only tracking context and uses the authenticated session", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ member: member() }) });
    vi.stubGlobal("fetch", fetcher);
    await markMemberEmail("qa", "key", "sent", null);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toContain("/members/mark-email"); expect(options.credentials).toBe("include");
    expect(JSON.parse(options.body)).toEqual({ memberId: "qa", keyId: "key", status: "sent", expectedSentAt: null });
    expect(options.body).not.toMatch(/adminId|gai_live_|html/i);
  });
  it("surfaces stale-context conflicts without reporting success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "El acceso cambió" } }) }));
    await expect(markMemberEmail("qa", "old-key", "sent", null)).rejects.toThrow("El acceso cambió");
  });
});
