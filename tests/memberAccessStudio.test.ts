/**
 * @file tests/memberAccessStudio.test.ts
 * Comprehensive Test Suite for GHOSTAI MEMBER ACCESS 01 (Studio side).
 * Validates:
 *  - CSV and XLSX parsing
 *  - 12-member official list parsing & plan categorization (10 Monthly, 2 Annual)
 *  - Validation: invalid emails, duplicate rows in file, existing system members
 *  - Admin member management service methods
 *  - Member activation service methods
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";
import {
  parseCsv,
  parseXlsx,
  validateMemberRows,
  get12MembersCsvText,
  type ParsedMemberRow,
} from "../src/services/memberImportParser";
import {
  fetchAdminMembers,
  createAdminMember,
  bulkCreateAdminMembers,
  renewAdminMember,
  revokeAdminMember,
  inviteAdminMember,
  regenerateAdminMemberKey,
  activateMember,
  type AdminMember,
} from "../src/services/adminService";

describe("Studio — Member Access 01 Import Parser", () => {
  it("get12MembersCsvText produces the exact 12 official members", () => {
    const csv = get12MembersCsvText();
    expect(csv).toContain("NOMBRE,CORREO,Tipo de Acceso");
    expect(csv).toContain("Jose Varela,jjvarela0321@gmail.com,Mensual");
    expect(csv).toContain("Ricardo Daniel Tovar Barrera,r.tovar.barrera@gmail.com,Anual");
    expect(csv).toContain("Sandy Leon,Sandy22karina22@gmail.com,Anual");
    expect(csv).toContain("Jorge MV,jorgr.mv@gmail.com,Mensual");
  });

  it("parseCsv accurately parses CSV text into structured MemberRows", () => {
    const csv = `NOMBRE,CORREO,Tipo de Acceso\r\nJose Varela,jjvarela0321@gmail.com,Mensual\r\nArturo Fuentes,arturo.fuentesg@gmail.com,Mensual\r\n`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      name: "Jose Varela",
      email: "jjvarela0321@gmail.com",
      accessPlan: "monthly",
      rawPlan: "Mensual",
    });
    expect(rows[1]).toEqual({
      name: "Arturo Fuentes",
      email: "arturo.fuentesg@gmail.com",
      accessPlan: "monthly",
      rawPlan: "Mensual",
    });
  });

  it("parseXlsx reads worksheet xml and shared strings from an xlsx zip buffer", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`);

    const sharedStrings = [
      "NOMBRE", "CORREO", "Tipo de Acceso",
      "Jose Varela", "jjvarela0321@gmail.com", "Mensual",
      "Sandy Leon", "sandy22karina22@gmail.com", "Anual"
    ];
    let ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}">`;
    for (const s of sharedStrings) {
      ssXml += `<si><t>${s}</t></si>`;
    }
    ssXml += `</sst>`;
    zip.file("xl/sharedStrings.xml", ssXml);

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>3</v></c>
      <c r="B2" t="s"><v>4</v></c>
      <c r="C2" t="s"><v>5</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>6</v></c>
      <c r="B3" t="s"><v>7</v></c>
      <c r="C3" t="s"><v>8</v></c>
    </row>
  </sheetData>
</worksheet>`;
    zip.file("xl/worksheets/sheet1.xml", sheetXml);

    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const rows = await parseXlsx(buffer);

    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Jose Varela");
    expect(rows[0].email).toBe("jjvarela0321@gmail.com");
    expect(rows[0].accessPlan).toBe("monthly");
    expect(rows[1].name).toBe("Sandy Leon");
    expect(rows[1].email).toBe("sandy22karina22@gmail.com");
    expect(rows[1].accessPlan).toBe("annual");
  });

  it("validates the official 12-member list into 10 Monthly and 2 Annual", () => {
    const csv = get12MembersCsvText();
    const parsed = parseCsv(csv);
    const summary = validateMemberRows(parsed, []);

    expect(summary.total).toBe(12);
    expect(summary.validCount).toBe(12);
    expect(summary.errorCount).toBe(0);
    expect(summary.existingCount).toBe(0);
    expect(summary.monthlyCount).toBe(10);
    expect(summary.annualCount).toBe(2);

    const annualMembers = summary.rows.filter((r) => r.accessPlan === "annual");
    expect(annualMembers.map((m) => m.name)).toEqual([
      "Ricardo Daniel Tovar Barrera",
      "Sandy Leon",
    ]);
  });

  it("flags invalid email addresses correctly", () => {
    const rawRows: ParsedMemberRow[] = [
      { name: "Persona Uno", email: "correo-invalido", accessPlan: "monthly", rawPlan: "Mensual" },
      { name: "Persona Dos", email: "valido@correo.com", accessPlan: "monthly", rawPlan: "Mensual" },
    ];
    const summary = validateMemberRows(rawRows, []);
    expect(summary.validCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    expect(summary.rows[0].isValid).toBe(false);
    expect(summary.rows[0].errorMessage).toContain("inválido");
    expect(summary.rows[0].validationStatus).toBe("Correo inválido");
    expect(summary.rows[1].isValid).toBe(true);
  });

  it("detects duplicate email addresses within the file", () => {
    const rawRows: ParsedMemberRow[] = [
      { name: "Usuario A", email: "test@dominio.com", accessPlan: "monthly", rawPlan: "Mensual" },
      { name: "Usuario B", email: "TEST@DOMINIO.COM", accessPlan: "annual", rawPlan: "Anual" },
    ];
    const summary = validateMemberRows(rawRows, []);
    expect(summary.rows[0].isValid).toBe(true);
    expect(summary.rows[1].isValid).toBe(false);
    expect(summary.rows[1].errorMessage).toContain("repite");
    expect(summary.rows[1].validationStatus).toBe("Duplicado en archivo");
  });

  it("detects members that already exist in the system", () => {
    const existingSystemMembers: AdminMember[] = [
      {
        id: "mem-existing-1",
        name: "Jose Varela",
        email: "jjvarela0321@gmail.com",
        accessPlan: "monthly",
        status: "active",
        createdAt: new Date().toISOString(),
        invitedAt: null,
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        revokedAt: null,
        keyId: "key-1",
        maskedKey: "gai_live_1234••••••••",
        lastInviteAt: null,
      },
    ];

    const rawRows: ParsedMemberRow[] = [
      { name: "Jose Varela", email: "jjvarela0321@gmail.com", accessPlan: "monthly", rawPlan: "Mensual" },
      { name: "Arturo Fuentes", email: "arturo.fuentesg@gmail.com", accessPlan: "monthly", rawPlan: "Mensual" },
    ];

    const summary = validateMemberRows(rawRows, existingSystemMembers);
    expect(summary.existingCount).toBe(1);
    expect(summary.validCount).toBe(1);
    expect(summary.rows[0].isExisting).toBe(true);
    expect(summary.rows[0].isValid).toBe(false);
    expect(summary.rows[0].errorMessage).toContain("ya existe");
    expect(summary.rows[0].validationStatus).toBe("YA EXISTE");
    expect(summary.rows[1].isValid).toBe(true);
  });
});

describe("Studio — Admin Member Service Methods", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchAdminMembers requests /api/admin/members with credentials", async () => {
    const mockMembers = [
      { id: "mem-1", name: "Jose", email: "jose@test.com", accessPlan: "monthly", status: "pending" },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ members: mockMembers }),
    });

    const res = await fetchAdminMembers();
    expect(res).toEqual(mockMembers);
    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toContain("/api/admin/members");
    expect(call[1].credentials).toBe("include");
  });

  it("createAdminMember posts single member payload and returns invite", async () => {
    const mockRes = {
      member: { id: "mem-new-1", name: "Nuevo", email: "nuevo@test.com" },
      activationToken: "gai_act_mock123",
      activationLink: "https://studio.ghostai.com/activate/gai_act_mock123",
      emailPayload: {
        memberId: "mem-new-1",
        name: "Nuevo",
        email: "nuevo@test.com",
        plan: "Mensual",
        activationLink: "https://studio.ghostai.com/activate/gai_act_mock123",
        subject: "Tu acceso a GhostAI ya está listo",
        body: "Hola, Nuevo.\n\nTu acceso a GhostAI ya está listo.",
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRes),
    });

    const res = await createAdminMember("Nuevo", "nuevo@test.com", "monthly");
    expect(res.activationToken).toBe("gai_act_mock123");
    expect(res.emailPayload.subject).toContain("GhostAI");
    const call = (global.fetch as any).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({
      name: "Nuevo",
      email: "nuevo@test.com",
      accessPlan: "monthly",
    });
  });

  it("bulkCreateAdminMembers posts multiple members and receives summary", async () => {
    const mockBulkRes = {
      summary: {
        processed: 12,
        newCount: 12,
        existingCount: 0,
        errorCount: 0,
        monthlyCount: 10,
        annualCount: 2,
      },
      results: [],
      createdMembers: [],
      emailPayloads: [],
      zeroRealEmailsSent: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockBulkRes),
    });

    const res = await bulkCreateAdminMembers([
      { name: "Jose", email: "jose@test.com", accessPlan: "monthly" },
    ]);
    expect(res.summary.newCount).toBe(12);
    expect(res.summary.monthlyCount).toBe(10);
    expect(res.zeroRealEmailsSent).toBe(true);
  });

  it("renewAdminMember calls /api/admin/members/renew with extension", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, memberId: "mem-1", accessPlan: "annual", status: "active", expiresAt: "2027-10-16" }),
    });

    const res = await renewAdminMember("mem-1", "annual");
    expect(res.ok).toBe(true);
    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toContain("/api/admin/members/renew");
    expect(JSON.parse(call[1].body)).toEqual({ memberId: "mem-1", extension: "annual" });
  });

  it("revokeAdminMember calls /api/admin/members/revoke", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, memberId: "mem-1", status: "revoked" }),
    });

    const success = await revokeAdminMember("mem-1");
    expect(success).toBe(true);
    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toContain("/api/admin/members/revoke");
    expect(JSON.parse(call[1].body)).toEqual({ memberId: "mem-1" });
  });

  it("inviteAdminMember supports both single memberId and array of memberIds", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        sentCount: 2,
        invitations: [
          { memberId: "mem-1", activationToken: "t1", activationLink: "https://studio/activate/1", emailPayload: { name: "A" } },
          { memberId: "mem-2", activationToken: "t2", activationLink: "https://studio/activate/2", emailPayload: { name: "B" } },
        ],
      }),
    });

    const res = await inviteAdminMember(["mem-1", "mem-2"]);
    expect(res.sentCount).toBe(2);
    expect(res.invitations.length).toBe(2);
  });

  it("regenerateAdminMemberKey calls /api/admin/members/regenerate-key", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        member: { id: "mem-1", maskedKey: "gai_live_new••••••••" },
        activationToken: "gai_act_new",
        activationLink: "https://studio/activate/gai_act_new",
        emailPayload: { subject: "Tu nueva clave GhostAI", body: "Enlace nuevo" },
      }),
    });

    const res = await regenerateAdminMemberKey("mem-1");
    expect(res.activationToken).toBe("gai_act_new");
  });

  it("activateMember calls public /api/members/activate endpoint", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        authenticated: true,
        accessKey: "gai_live_act123.secret",
        clientName: "Jose Varela",
        accessPlan: "monthly",
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        memberId: "mem-1",
      }),
    });

    const res = await activateMember("gai_act_mock_token_123");
    expect(res.ok).toBe(true);
    expect(res.authenticated).toBe(true);
    expect(res.accessKey).toBe("gai_live_act123.secret");
    expect(res.clientName).toBe("Jose Varela");
    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toContain("/api/members/activate");
    expect(JSON.parse(call[1].body)).toEqual({ token: "gai_act_mock_token_123" });
  });
});
