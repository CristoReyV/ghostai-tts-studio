import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonalKeysView } from "../src/components/Admin/PersonalKeys";
import { fetchPersonalKeys, revealPersonalKey, type PersonalKey } from "../src/services/adminService";
const personal: PersonalKey = { id: "personal", label: "GHOSTAI 1", clientName: "GHOSTAI", status: "active", expiresAt: null, canReveal: true };
afterEach(() => vi.unstubAllGlobals());
it("shows lifetime personal keys masked, with read/copy controls and no management controls", () => {
  const html = renderToStaticMarkup(<PersonalKeysView keys={[personal]} revealed={{}} busy={null} notice="" onReveal={() => {}} onCopy={() => {}} />);
  expect(html).toContain("GHOSTAI 1"); expect(html).toContain("Sin vencimiento"); expect(html).toContain("Mostrar key"); expect(html).toContain("Copiar key");
  expect(html).not.toContain("gai_live_"); expect(html).not.toMatch(/Generar|Regenerar|Revocar/);
});
it("prevents using a revoked key and supports an explicit empty state", () => {
  const html = renderToStaticMarkup(<PersonalKeysView keys={[{ ...personal, status: "revoked", canReveal: false }]} revealed={{}} busy={null} notice="" onReveal={() => {}} onCopy={() => {}} />);
  expect(html.match(/disabled=""/g)).toHaveLength(2); expect(html).toContain("NO DISPONIBLE");
  expect(renderToStaticMarkup(<PersonalKeysView keys={[]} revealed={{}} busy={null} notice="" onReveal={() => {}} onCopy={() => {}} />)).toContain("No tienes keys personales asignadas");
});
it("uses the current session without client-selected identity or persistent caching", async () => {
  const accessKey = "gai_live_test_public.test_secret";
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ keys: [personal] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ accessKey }) });
  vi.stubGlobal("fetch", fetcher);
  expect(await fetchPersonalKeys()).toEqual([personal]); expect(await revealPersonalKey(personal.id)).toBe(accessKey);
  for (const [, options] of fetcher.mock.calls) { expect(options.credentials).toBe("include"); expect(options.cache).toBe("no-store"); }
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ keyId: "personal" });
});
it("surfaces denied reveal instead of returning an unusable value", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  await expect(revealPersonalKey("other-user-key")).rejects.toThrow("No se pudo acceder");
});
