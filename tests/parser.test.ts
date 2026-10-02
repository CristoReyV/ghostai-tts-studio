/**
 * @file tests/parser.test.ts
 * Unit tests for .ghostai-tts.json parser and schema validator.
 */

import { describe, it, expect } from "vitest";
import { parseGhostAiTtsJson } from "../src/services/parser";
import { SAMPLE_GHOSTAI_PROJECT } from "../src/sampleData";

describe("parseGhostAiTtsJson", () => {
  it("successfully parses valid sample project", () => {
    const result = parseGhostAiTtsJson(SAMPLE_GHOSTAI_PROJECT);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data?.format).toBe("ghostai-tts");
    expect(result.data?.project.name).toBe("Lia y el Faro Encantado");
    expect(result.studioItems).toHaveLength(3);
    expect(result.studioItems?.[0].status).toBe("PENDING");
    expect(result.studioItems?.[0].sceneId).toBe("scene_cliff_arrival");
  });

  it("successfully parses valid JSON string", () => {
    const jsonStr = JSON.stringify(SAMPLE_GHOSTAI_PROJECT);
    const result = parseGhostAiTtsJson(jsonStr);
    expect(result.success).toBe(true);
    expect(result.data?.items).toHaveLength(3);
  });

  it("fails on invalid JSON syntax", () => {
    const result = parseGhostAiTtsJson("{ invalid json");
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("JSON inválido");
  });

  it("fails if format is not ghostai-tts", () => {
    const bad = { ...SAMPLE_GHOSTAI_PROJECT, format: "other-format" };
    const result = parseGhostAiTtsJson(bad);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Formato inválido"))).toBe(true);
  });

  it("fails if items array is empty", () => {
    const bad = { ...SAMPLE_GHOSTAI_PROJECT, items: [] };
    const result = parseGhostAiTtsJson(bad);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("vacío"))).toBe(true);
  });

  it("fails if item is missing id or sceneId", () => {
    const bad = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Test", exportedAt: new Date().toISOString() },
      items: [
        {
          sceneIndex: 1,
          text: "Hola mundo",
        },
      ],
    };
    const result = parseGhostAiTtsJson(bad);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("'id' o 'narrationId'"))).toBe(true);
    expect(result.errors.some((e) => e.includes("Falta el 'sceneId'"))).toBe(true);
  });

  it("flags duplicate narration IDs", () => {
    const bad = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Test", exportedAt: new Date().toISOString() },
      items: [
        { id: "dup_1", sceneId: "s1", sceneIndex: 1, text: "Texto 1" },
        { id: "dup_1", sceneId: "s2", sceneIndex: 2, text: "Texto 2" },
      ],
    };
    const result = parseGhostAiTtsJson(bad);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("duplicado"))).toBe(true);
  });

  it("preserves custom extra metadata without mutating original IDs", () => {
    const customProject = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Metadata Test", exportedAt: "2026-10-02T12:00:00Z", customTag: "alpha" },
      items: [
        {
          id: "custom_id_999",
          sceneId: "scene_special_x",
          sceneIndex: 5,
          text: "Texto de prueba",
          customField: 42,
          notes: "no tocar",
        },
      ],
    };
    const result = parseGhostAiTtsJson(customProject);
    expect(result.success).toBe(true);
    expect(result.studioItems?.[0].id).toBe("custom_id_999");
    expect(result.studioItems?.[0].sceneId).toBe("scene_special_x");
    expect((result.studioItems?.[0] as Record<string, unknown>).customField).toBe(42);
    expect((result.studioItems?.[0] as Record<string, unknown>).notes).toBe("no tocar");
  });

  // ── Backward Compatibility Tests: id vs narrationId ────────────

  it("JSON con id → PASS", () => {
    const projectWithId = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Test ID", exportedAt: new Date().toISOString() },
      items: [
        {
          id: "canonical_narr_01",
          sceneId: "scene_castle_main",
          sceneIndex: 1,
          text: "Las puertas del castillo se abrieron.",
        },
      ],
    };
    const result = parseGhostAiTtsJson(projectWithId);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.studioItems?.[0].id).toBe("canonical_narr_01");
    expect(result.data?.items[0].id).toBe("canonical_narr_01");
  });

  it("JSON con narrationId → PASS (fallback normalizado a id)", () => {
    const projectWithNarrationId = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Test NarrationId", exportedAt: new Date().toISOString() },
      items: [
        {
          narrationId: "flow_narr_from_ghostai_02",
          sceneId: "scene_forest_dusk",
          sceneIndex: 1,
          text: "El viento soplaba entre las copas de los árboles.",
        },
      ],
    };
    const result = parseGhostAiTtsJson(projectWithNarrationId);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    // Internally normalized to 'id'
    expect(result.studioItems?.[0].id).toBe("flow_narr_from_ghostai_02");
    expect(result.data?.items[0].id).toBe("flow_narr_from_ghostai_02");
  });

  it("JSON con ambos → id tiene prioridad sobre narrationId", () => {
    const projectWithBoth = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Test Both IDs", exportedAt: new Date().toISOString() },
      items: [
        {
          id: "primary_canonical_id",
          narrationId: "ignored_fallback_id",
          sceneId: "scene_sea_cave",
          sceneIndex: 3,
          text: "Las olas rompían dentro de la cueva.",
        },
      ],
    };
    const result = parseGhostAiTtsJson(projectWithBoth);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    // 'id' has strict precedence
    expect(result.studioItems?.[0].id).toBe("primary_canonical_id");
    expect(result.data?.items[0].id).toBe("primary_canonical_id");
  });

  it("ningún ID → ERROR claro", () => {
    const projectWithNoId = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Test Missing ID", exportedAt: new Date().toISOString() },
      items: [
        {
          sceneId: "scene_lost_ruins",
          sceneIndex: 1,
          text: "Un texto sin identificador.",
        },
      ],
    };
    const result = parseGhostAiTtsJson(projectWithNoId);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("'id' o 'narrationId'"))).toBe(true);
  });

  it("sceneId conservado sin modificación", () => {
    const exactSceneId = "GhostAI-Scene-UUID-9874-Custom_Index_Alpha";
    const projectWithExactScene = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Test SceneId Preservation", exportedAt: new Date().toISOString() },
      items: [
        {
          narrationId: "narr_flow_123",
          sceneId: exactSceneId,
          sceneIndex: 4,
          text: "Verificación de sceneId intacto.",
        },
      ],
    };
    const result = parseGhostAiTtsJson(projectWithExactScene);
    expect(result.success).toBe(true);
    // Exact sceneId preserved without transformation
    expect(result.studioItems?.[0].sceneId).toBe(exactSceneId);
    expect(result.data?.items[0].sceneId).toBe(exactSceneId);
  });
});
