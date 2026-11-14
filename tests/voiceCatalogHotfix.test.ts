/**
 * Hotfix catálogo de voces: respuestas simuladas del gateway (que a su vez consulta GET /v2/voices).
 * Sin red, sin ElevenLabs real, sin audio, sin créditos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGatewayVoicesPage, setGatewayAuthToken, clearGatewayAuthToken } from "../src/services/gateway";
import { describeVoicesError, sanitizeDiagnostic } from "../src/services/voicesDiagnostics";

const SECRET = "sk_live_SUPERSECRET123456";

function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k] ?? null },
    json: async () => {
      if (body === "__broken__") throw new Error("bad json");
      return body;
    },
  };
}

beforeEach(() => {
  setGatewayAuthToken("gai_test_operator_token");
});
afterEach(() => {
  clearGatewayAuthToken();
  vi.unstubAllGlobals();
});

describe("fetchGatewayVoicesPage", () => {
  it("envía acceso GhostAI + cookie de sesión y nunca una API key de ElevenLabs", async () => {
    const f = vi.fn().mockResolvedValue(res(200, { voices: [], hasMore: false, nextPageToken: null }));
    vi.stubGlobal("fetch", f);
    await fetchGatewayVoicesPage({ pageSize: 100 });
    const [url, opts] = f.mock.calls[0];
    expect(url).toContain("/api/tts/voices?page_size=100");
    expect(opts.credentials).toBe("include");
    expect(opts.headers.Authorization).toBe("Bearer gai_test_operator_token");
    expect(JSON.stringify(opts)).not.toContain("xi-api-key");
  });

  it("adapta voces con nombre, voice_id, idioma y previsualización; hasMore + nextPageToken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        res(200, {
          voices: [
            {
              voiceId: "v1", name: "Lucia", category: "professional", labels: { language: "es" },
              previewUrl: "https://p/x.mp3",
              verifiedLanguages: [{ language: "es", locale: "es-MX", accent: "mexican", previewUrl: "https://p/es.mp3" }],
            },
          ],
          hasMore: true,
          nextPageToken: "NEXT",
        })
      )
    );
    const page = await fetchGatewayVoicesPage();
    expect(page.voices).toHaveLength(1);
    expect(page.voices[0]).toMatchObject({ voiceId: "v1", name: "Lucia", previewUrl: "https://p/x.mp3" });
    expect(page.hasMore).toBe(true);
    expect(page.nextPageToken).toBe("NEXT");
  });

  it("solo solicita la página pedida (token), no todas las páginas", async () => {
    const f = vi.fn().mockResolvedValue(res(200, { voices: [], hasMore: false, nextPageToken: null }));
    vi.stubGlobal("fetch", f);
    await fetchGatewayVoicesPage({ pageToken: "TOK", pageSize: 100 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toContain("page_token=TOK");
  });

  it("hasMore sin token no ofrece otra página", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, { voices: [], hasMore: true, nextPageToken: null })));
    expect((await fetchGatewayVoicesPage()).hasMore).toBe(false);
  });

  it("sin acceso GhostAI falla antes de llamar a la red", async () => {
    clearGatewayAuthToken();
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(fetchGatewayVoicesPage()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    [401, "ELEVENLABS_UNAUTHORIZED", "key_invalid"],
    [403, "ELEVENLABS_KEY_MISSING_PERMISSIONS", "permissions"],
    [403, "ELEVENLABS_FORBIDDEN", "forbidden"],
    [429, "ELEVENLABS_RATE_LIMIT", "rate_limit"],
    [502, "ELEVENLABS_SERVER_ERROR", "server"],
    [504, "ELEVENLABS_TIMEOUT", "timeout"],
    [428, "ELEVENLABS_NOT_CONNECTED", "not_connected"],
  ])("HTTP %i %s → %s", async (status, code, kind) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(status, { error: { code, message: "x" }, requestId: "rid-1" })));
    const err = await fetchGatewayVoicesPage().catch((e) => e);
    expect(err.requestId).toBe("rid-1");
    const info = describeVoicesError(err);
    expect(info.kind).toBe(kind);
    expect(info.diagnostic).toContain(code);
    expect(info.diagnostic).toContain("rid-1");
  });

  it("respuesta inválida (JSON roto o sin voices) → invalid_response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, "__broken__")));
    expect(describeVoicesError(await fetchGatewayVoicesPage().catch((e) => e)).kind).toBe("invalid_response");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, { nada: 1 })));
    expect(describeVoicesError(await fetchGatewayVoicesPage().catch((e) => e)).kind).toBe("invalid_response");
  });

  it("bloqueo de red/CORS (fetch lanza TypeError) → network", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const info = describeVoicesError(await fetchGatewayVoicesPage().catch((e) => e));
    expect(info.kind).toBe("network");
    expect(info.message).toMatch(/CORS/);
  });
});

describe("mensajes y diagnóstico", () => {
  it("permisos: indica habilitar voices_read en la API key", () => {
    const info = describeVoicesError({ code: "ELEVENLABS_KEY_MISSING_PERMISSIONS", statusCode: 403 });
    expect(info.message).toMatch(/voices_read/);
    expect(info.message).toMatch(/API key/);
  });

  it("el diagnóstico nunca contiene la API key ni tokens", () => {
    const info = describeVoicesError({ code: `X ${SECRET} Bearer abc123`, statusCode: 500, requestId: "r1" });
    expect(info.diagnostic).not.toContain(SECRET);
    expect(info.diagnostic).not.toContain("abc123");
    expect(sanitizeDiagnostic(`xi-api-key: ${SECRET}`)).not.toContain(SECRET);
  });

  it("el error de catálogo no desconecta ElevenLabs: el mensaje declara la cuenta conectada", () => {
    expect(describeVoicesError({ code: "ELEVENLABS_SERVER_ERROR", statusCode: 502 }).message).not.toMatch(/desconect/i);
  });
});
