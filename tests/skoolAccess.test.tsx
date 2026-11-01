import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SkoolSyncPreview } from "../src/components/Admin/SkoolSyncControl";
import { applySkoolSync, fetchSkoolSync, previewSkoolSync, type SkoolPreview } from "../src/services/skoolService";
import { accessPlanLabel } from "../src/services/accessPlans";
import { MemberOperationalBadge } from "../src/components/Admin/MemberOperationDetails";
import type { AdminMember } from "../src/services/adminService";
const preview: SkoolPreview = { rows: 82, sourceFingerprint: "qa-source", previewToken: "qa-preview", canApply: true, counts: { newMembers: 58, existing: 24, removed: 0, rejoined: 0, expiryChanges: 0, invalid: 0, inactiveRows: 0 }, details: [{ row: 30, name: "Eric Mena - 2", classification: "NEW", reason: "Cuenta separada con otro correo; se conserva la anterior" }] };
afterEach(() => vi.unstubAllGlobals());
describe("SKOOL access", () => {
  it("explains separate accounts, scoped removals and no email sending in preview", () => {
    const html = renderToStaticMarkup(<SkoolSyncPreview preview={preview} busy={false} progress="" onApply={() => {}} onCancel={() => {}} />);
    expect(html).toContain("58 nuevos"); expect(html).toContain("Eric Mena - 2"); expect(html).toContain("incluidos los planes anteriores"); expect(html).toContain("No se envían correos");
    expect(html).not.toContain("gai_live_"); expect(html).toContain("Aplicar sincronización SKOOL");
  });
  it("blocks apply on malformed source and disables cancel during a running batch", () => {
    const invalid = renderToStaticMarkup(<SkoolSyncPreview preview={{ ...preview, canApply: false }} busy={false} progress="" onApply={() => {}} onCancel={() => {}} />);
    expect(invalid).toContain("hoja vacía o con errores"); expect(invalid.match(/disabled=""/g)).toHaveLength(1);
    const busy = renderToStaticMarkup(<SkoolSyncPreview preview={preview} busy={true} progress="8 accesos nuevos cargados" onApply={() => {}} onCancel={() => {}} />);
    expect(busy.match(/disabled=""/g)).toHaveLength(2); expect(busy).toContain("8 accesos nuevos cargados");
  });
  it("uses authenticated preview tokens and never sends source rows or actor identity from the browser", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ preview, configured: true, sync: null, created: 8, needsContinuation: true }) }); vi.stubGlobal("fetch", fetcher);
    await fetchSkoolSync(); expect((await previewSkoolSync()).rows).toBe(82); await applySkoolSync(preview.previewToken);
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ action: "apply", previewToken: "qa-preview" });
    for (const [, options] of fetcher.mock.calls) { expect(options.credentials).toBe("include"); expect(options.cache).toBe("no-store"); }
  });
  it("shows SKOOL as its own plan and consumes a server-computed removed state", () => {
    expect(accessPlanLabel("skool")).toBe("SKOOL");
    const member = { access_plan: "skool", operational: { status: "REVOKED", label: "BAJA SKOOL", recommendedAction: "Revisar membresía SKOOL", severity: "muted", needsAction: false, emailType: "RESEND" } } as AdminMember;
    expect(renderToStaticMarkup(<MemberOperationalBadge member={member} />)).toContain("BAJA SKOOL");
  });
});
