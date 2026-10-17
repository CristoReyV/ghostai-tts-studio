import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ManualInvitationActions, invitationMailto } from "../src/components/Admin/ManualInvitationActions";
import { loginAdmin, prepareManualInvitation, auditBulkPreview } from "../src/services/adminService";
const draft = { to: "member+qa@example.test", name: "QA", plan: "annual", subject: "Tu acceso & GhostAI", preheader: "Listo", html: "<p>Invitación</p>", text: "Hola\nActiva: https://example.test/?activate=sample&x=1", activationLink: "https://example.test/?activate=sample", invitationExpiresAt: "2026-10-24" };
afterEach(() => vi.unstubAllGlobals());
describe("manual invitation handoff", () => {
  it("encodes recipient, subject and body without mail header injection", () => {
    const url = new URL(invitationMailto(draft));
    expect(decodeURIComponent(url.pathname)).toBe(draft.to);
    expect(url.searchParams.get("subject")).toBe(draft.subject);
    expect(url.searchParams.get("body")).toBe(draft.text);
    const html = renderToStaticMarkup(<ManualInvitationActions email={draft} />);
    expect(html).toContain("Abrir mi correo");
    expect(html).toContain("Copiar con formato");
    expect(html).toContain("no confirma ni registra el envío externo");
  });
  it("exchanges scoped key once and prepares without calling send", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ authenticated: true, preview: draft }) });
    vi.stubGlobal("fetch", fetcher);
    await loginAdmin({ adminKey: "unit-key" });
    await prepareManualInvitation("member-id");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ adminKey: "unit-key" });
    expect(fetcher.mock.calls[1][0]).toContain("/prepare-email");
    expect(fetcher.mock.calls[1][1].credentials).toBe("include");
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ memberId: "member-id" });
    await auditBulkPreview(["member-id"]);
    expect(JSON.parse(fetcher.mock.calls[2][1].body).previewOnly).toBe(true);
  });
});
