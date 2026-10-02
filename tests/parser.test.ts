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
    expect(result.errors.some((e) => e.includes("Falta el 'id'"))).toBe(true);
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
});
