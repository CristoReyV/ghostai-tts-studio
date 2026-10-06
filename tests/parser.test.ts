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

  // ── P5E Compatibility & Regression Tests: Flow Shape Adapter ──────

  it("A. shape legacy/current Studio: project.name + items → PASS", () => {
    const legacyStudioDoc = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Studio Project", exportedAt: "2026-10-06T12:00:00Z" },
      items: [
        {
          id: "item_001",
          sceneId: "scene_001",
          sceneIndex: 1,
          text: "Texto tradicional.",
        },
      ],
    };
    const result = parseGhostAiTtsJson(legacyStudioDoc);
    expect(result.success).toBe(true);
    expect(result.data?.project.name).toBe("Studio Project");
    expect(result.studioItems).toHaveLength(1);
    expect(result.studioItems?.[0].id).toBe("item_001");
  });

  it("B. shape real Flow: project.title + narrations → PASS", () => {
    const flowDoc = {
      format: "ghostai-tts",
      version: "1.0",
      project: {
        id: "flow-proj-uuid",
        title: "Flow Project Title",
        format: "16:9",
        exportedAt: "2026-10-06T14:00:00Z",
      },
      narrations: [
        {
          id: "flow_narr_01",
          narrationId: "flow_narr_01",
          sceneId: "flow_scene_01",
          sceneIndex: 1,
          text: "Texto exportado de Flow.",
        },
      ],
    };
    const result = parseGhostAiTtsJson(flowDoc);
    expect(result.success).toBe(true);
    expect(result.data?.project.name).toBe("Flow Project Title");
    expect(result.data?.project.title).toBe("Flow Project Title");
    expect(result.data?.items).toHaveLength(1);
    expect(result.studioItems).toHaveLength(1);
    expect(result.studioItems?.[0].id).toBe("flow_narr_01");
    expect(result.studioItems?.[0].sceneId).toBe("flow_scene_01");
  });

  it("C. format incorrecto → FAIL", () => {
    const badFormat = {
      format: "other-tts",
      version: "1.0",
      project: { title: "Test" },
      narrations: [
        { id: "1", sceneId: "s1", sceneIndex: 1, text: "t" },
      ],
    };
    const result = parseGhostAiTtsJson(badFormat);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Formato inválido"))).toBe(true);
  });

  it("D. version incorrecta → FAIL", () => {
    const badVersion = {
      format: "ghostai-tts",
      version: "2.0",
      project: { title: "Test" },
      narrations: [
        { id: "1", sceneId: "s1", sceneIndex: 1, text: "t" },
      ],
    };
    const result = parseGhostAiTtsJson(badVersion);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("version"))).toBe(true);
  });

  it("E. sin name/title → FAIL", () => {
    const missingNameTitle = {
      format: "ghostai-tts",
      version: "1.0",
      project: { id: "p1" },
      narrations: [
        { id: "1", sceneId: "s1", sceneIndex: 1, text: "t" },
      ],
    };
    const result = parseGhostAiTtsJson(missingNameTitle);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("project.name") || e.includes("project.title"))).toBe(true);
  });

  it("F. sin items/narrations → FAIL", () => {
    const missingCollection = {
      format: "ghostai-tts",
      version: "1.0",
      project: { title: "Test" },
    };
    const result = parseGhostAiTtsJson(missingCollection);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("items") || e.includes("narrations"))).toBe(true);
  });

  it("G. name/title conflictivos → FAIL", () => {
    const conflictingNameTitle = {
      format: "ghostai-tts",
      version: "1.0",
      project: {
        name: "Proyecto Alpha",
        title: "Proyecto Beta Diferente",
      },
      items: [
        { id: "1", sceneId: "s1", sceneIndex: 1, text: "t" },
      ],
    };
    const result = parseGhostAiTtsJson(conflictingNameTitle);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Conflicto"))).toBe(true);
  });

  it("H. items/narrations conflictivos → FAIL", () => {
    const conflictingCollections = {
      format: "ghostai-tts",
      version: "1.0",
      project: { title: "Test Project" },
      items: [
        { id: "id_1", sceneId: "s1", sceneIndex: 1, text: "Texto A" },
      ],
      narrations: [
        { id: "id_2_different", sceneId: "s2", sceneIndex: 1, text: "Texto B" },
      ],
    };
    const result = parseGhostAiTtsJson(conflictingCollections);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Contrato ambiguo"))).toBe(true);
  });

  it("I. IDs Flow preservados byte-for-byte/string-for-string", () => {
    const flowItem = {
      id: "nar_3c0dde6e-d141-4f12-a3d5-ee0c74dddda2",
      narrationId: "nar_3c0dde6e-d141-4f12-a3d5-ee0c74dddda2",
      sceneId: "3c0dde6e-d141-4f12-a3d5-ee0c74dddda2",
      sceneIndex: 1,
      text: "Nueva toma",
    };
    const doc = {
      format: "ghostai-tts",
      version: "1.0",
      project: { title: "Prueba 3" },
      narrations: [flowItem],
    };
    const result = parseGhostAiTtsJson(doc);
    expect(result.success).toBe(true);
    expect(result.studioItems?.[0].id).toBe("nar_3c0dde6e-d141-4f12-a3d5-ee0c74dddda2");
    expect(result.studioItems?.[0].narrationId).toBe("nar_3c0dde6e-d141-4f12-a3d5-ee0c74dddda2");
    expect(result.studioItems?.[0].sceneId).toBe("3c0dde6e-d141-4f12-a3d5-ee0c74dddda2");
    expect(result.studioItems?.[0].text).toBe("Nueva toma");
  });

  it("J. voiceConfig 'oasis' preservado", () => {
    const docWithVoiceConfig = {
      format: "ghostai-tts",
      version: "1.0",
      project: { title: "Voice Config Test" },
      narrations: [
        {
          id: "nar_voice_test_01",
          sceneId: "scene_voice_test",
          sceneIndex: 1,
          text: "Prueba de voz oasis",
          voiceConfig: {
            voiceId: "oasis",
            modelId: "eleven_multilingual_v2",
            stability: 0.6,
            clarity: 0.8,
            speed: 1.1,
          },
        },
      ],
    };
    const result = parseGhostAiTtsJson(docWithVoiceConfig);
    expect(result.success).toBe(true);
    const item = result.studioItems?.[0];
    expect(item?.voiceId).toBe("oasis");
    expect(item?.modelId).toBe("eleven_multilingual_v2");
    expect(item?.speed).toBe(1.1);
    expect(item?.voiceSettings?.stability).toBe(0.6);
    expect(item?.voiceSettings?.similarityBoost).toBe(0.8);
    expect((item as Record<string, unknown>).voiceConfig).toBeDefined();
  });

  it("Regression Fixture: Prueba_3_narraciones.json real structure", () => {
    const realFlowFixture = {
      format: "ghostai-tts",
      version: "1.0",
      project: {
        id: "e6df7627-c2b4-40f1-9277-a475bfdba443",
        title: "Prueba 3",
        format: "16:9",
        exportedAt: "2026-10-06T14:16:33.232Z",
      },
      narrations: [
        {
          id: "nar_3c0dde6e-d141-4f12-a3d5-ee0c74dddda2",
          narrationId: "nar_3c0dde6e-d141-4f12-a3d5-ee0c74dddda2",
          sceneId: "3c0dde6e-d141-4f12-a3d5-ee0c74dddda2",
          sceneIndex: 1,
          text: "Nueva toma",
          metadata: {
            durationEstimated: 1.488,
            wordCount: 2,
            transition: "fade",
          },
          voiceConfig: {
            voiceId: "oasis",
            modelId: "eleven_multilingual_v2",
            stability: 0.5,
            clarity: 0.75,
            speed: 1,
          },
        },
        {
          id: "nar_0e00cfa1-15e5-4588-b12c-8d68d80c3799",
          narrationId: "nar_0e00cfa1-15e5-4588-b12c-8d68d80c3799",
          sceneId: "0e00cfa1-15e5-4588-b12c-8d68d80c3799",
          sceneIndex: 2,
          text: "Nueva toma",
          metadata: {
            durationEstimated: 1.456,
            wordCount: 2,
            transition: "fade",
          },
          voiceConfig: {
            voiceId: "oasis",
            modelId: "eleven_multilingual_v2",
            stability: 0.5,
            clarity: 0.75,
            speed: 1,
          },
        },
        {
          id: "nar_64fdda09-d621-4fa9-b2ec-596ebfc62031",
          narrationId: "nar_64fdda09-d621-4fa9-b2ec-596ebfc62031",
          sceneId: "64fdda09-d621-4fa9-b2ec-596ebfc62031",
          sceneIndex: 3,
          text: "Nueva toma",
          metadata: {
            durationEstimated: 5,
            wordCount: 2,
            transition: "fade",
          },
          voiceConfig: {
            voiceId: "oasis",
            modelId: "eleven_multilingual_v2",
            stability: 0.5,
            clarity: 0.75,
            speed: 1,
          },
        },
        {
          id: "nar_854f72db-f9cc-482d-a467-8e13bb19510c",
          narrationId: "nar_854f72db-f9cc-482d-a467-8e13bb19510c",
          sceneId: "854f72db-f9cc-482d-a467-8e13bb19510c",
          sceneIndex: 4,
          text: "Nueva toma",
          metadata: {
            durationEstimated: 5,
            wordCount: 2,
            transition: "fade",
          },
          voiceConfig: {
            voiceId: "oasis",
            modelId: "eleven_multilingual_v2",
            stability: 0.5,
            clarity: 0.75,
            speed: 1,
          },
        },
      ],
    };

    const result = parseGhostAiTtsJson(realFlowFixture);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data?.project.name).toBe("Prueba 3");
    expect(result.data?.items).toHaveLength(4);
    expect(result.studioItems).toHaveLength(4);

    // Verify 4 items exact IDs, sceneIds, text, and voiceId
    expect(result.studioItems?.[0].id).toBe("nar_3c0dde6e-d141-4f12-a3d5-ee0c74dddda2");
    expect(result.studioItems?.[0].sceneId).toBe("3c0dde6e-d141-4f12-a3d5-ee0c74dddda2");
    expect(result.studioItems?.[0].text).toBe("Nueva toma");
    expect(result.studioItems?.[0].voiceId).toBe("oasis");

    expect(result.studioItems?.[1].id).toBe("nar_0e00cfa1-15e5-4588-b12c-8d68d80c3799");
    expect(result.studioItems?.[1].sceneId).toBe("0e00cfa1-15e5-4588-b12c-8d68d80c3799");
    expect(result.studioItems?.[1].text).toBe("Nueva toma");
    expect(result.studioItems?.[1].voiceId).toBe("oasis");

    expect(result.studioItems?.[2].id).toBe("nar_64fdda09-d621-4fa9-b2ec-596ebfc62031");
    expect(result.studioItems?.[2].sceneId).toBe("64fdda09-d621-4fa9-b2ec-596ebfc62031");
    expect(result.studioItems?.[2].text).toBe("Nueva toma");
    expect(result.studioItems?.[2].voiceId).toBe("oasis");

    expect(result.studioItems?.[3].id).toBe("nar_854f72db-f9cc-482d-a467-8e13bb19510c");
    expect(result.studioItems?.[3].sceneId).toBe("854f72db-f9cc-482d-a467-8e13bb19510c");
    expect(result.studioItems?.[3].text).toBe("Nueva toma");
    expect(result.studioItems?.[3].voiceId).toBe("oasis");
  });

  it("Live File Validation: parses real C:\\Users\\Admin\\Downloads\\Prueba_3_narraciones.json directly from disk", () => {
    const fs = require("fs");
    const filePath = "C:\\Users\\Admin\\Downloads\\Prueba_3_narraciones.json";
    if (!fs.existsSync(filePath)) {
      console.warn("File not found on disk, skipping live disk test:", filePath);
      return;
    }
    const rawContent = fs.readFileSync(filePath, "utf8");
    const result = parseGhostAiTtsJson(rawContent);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data?.project.name).toBe("Prueba 3");
    expect(result.data?.items).toHaveLength(4);
    expect(result.studioItems).toHaveLength(4);

    // 4 narrationIds intact
    expect(result.studioItems?.[0].id).toBe("nar_3c0dde6e-d141-4f12-a3d5-ee0c74dddda2");
    expect(result.studioItems?.[1].id).toBe("nar_0e00cfa1-15e5-4588-b12c-8d68d80c3799");
    expect(result.studioItems?.[2].id).toBe("nar_64fdda09-d621-4fa9-b2ec-596ebfc62031");
    expect(result.studioItems?.[3].id).toBe("nar_854f72db-f9cc-482d-a467-8e13bb19510c");

    // 4 sceneIds intact
    expect(result.studioItems?.[0].sceneId).toBe("3c0dde6e-d141-4f12-a3d5-ee0c74dddda2");
    expect(result.studioItems?.[1].sceneId).toBe("0e00cfa1-15e5-4588-b12c-8d68d80c3799");
    expect(result.studioItems?.[2].sceneId).toBe("64fdda09-d621-4fa9-b2ec-596ebfc62031");
    expect(result.studioItems?.[3].sceneId).toBe("854f72db-f9cc-482d-a467-8e13bb19510c");

    // 4 texts = 'Nueva toma'
    expect(result.studioItems?.[0].text).toBe("Nueva toma");
    expect(result.studioItems?.[1].text).toBe("Nueva toma");
    expect(result.studioItems?.[2].text).toBe("Nueva toma");
    expect(result.studioItems?.[3].text).toBe("Nueva toma");

    // voiceId = 'oasis' preserved
    expect(result.studioItems?.[0].voiceId).toBe("oasis");
    expect(result.studioItems?.[1].voiceId).toBe("oasis");
    expect(result.studioItems?.[2].voiceId).toBe("oasis");
    expect(result.studioItems?.[3].voiceId).toBe("oasis");
  });
});
