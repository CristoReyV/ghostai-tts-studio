/**
 * @file src/services/memberImportParser.ts
 * Client-side parser and validator for Member bulk imports (.xlsx and .csv).
 * Supports drag-and-drop file inspection, header normalization,
 * duplicate detection, and instant validation before creation.
 */

import JSZip from "jszip";

export interface ParsedMemberRow {
  name: string;
  email: string;
  accessPlan: "monthly" | "annual" | null;
  rawPlan: string;
}

export interface ValidatedMemberRow {
  rowNumber: number;
  name: string;
  email: string;
  accessPlan: "monthly" | "annual" | null;
  planLabel: string;
  validationStatus: "Válido" | "YA EXISTE" | "Correo inválido" | "Fila incompleta" | "Tipo de acceso desconocido" | "Duplicado en archivo";
  isValid: boolean;
  isExisting: boolean;
  errorMessage: string | null;
  existingMemberStatus: string | null;
}

export interface ValidationSummary {
  total: number;
  validCount: number;
  existingCount: number;
  errorCount: number;
  monthlyCount: number;
  annualCount: number;
  rows: ValidatedMemberRow[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeader(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function normalizePlan(val: string): "monthly" | "annual" | null {
  if (!val) return null;
  const clean = val.toLowerCase().trim();
  if (clean === "mensual" || clean === "monthly" || clean === "mes" || clean === "1 mes") {
    return "monthly";
  }
  if (clean === "anual" || clean === "annual" || clean === "ano" || clean === "año" || clean === "1 ano" || clean === "1 año") {
    return "annual";
  }
  return null;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  let delimiter = ",";
  const firstLine = text.split(/\r\n|\n|\r/)[0] || "";
  if (!firstLine.includes(",") && firstLine.includes(";")) {
    delimiter = ";";
  } else if (!firstLine.includes(",") && firstLine.includes("\t")) {
    delimiter = "\t";
  }

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = "";
        i++;
        continue;
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
        i++;
        continue;
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function mapGridToMembers(rawGrid: string[][]): ParsedMemberRow[] {
  if (!rawGrid || rawGrid.length < 2) return [];

  const headers = rawGrid[0];
  let nameIdx = -1;
  let emailIdx = -1;
  let planIdx = -1;

  for (let idx = 0; idx < headers.length; idx++) {
    const h = normalizeHeader(headers[idx]);
    if (nameIdx === -1 && (h === "nombre" || h === "name" || h === "fullname" || h === "usuario")) {
      nameIdx = idx;
    } else if (emailIdx === -1 && (h === "correo" || h === "email" || h === "mail" || h === "correoelectronico")) {
      emailIdx = idx;
    } else if (planIdx === -1 && (h === "tipodeacceso" || h === "acceso" || h === "plan" || h === "accessplan" || h === "tipo")) {
      planIdx = idx;
    }
  }

  if (nameIdx === -1) nameIdx = 0;
  if (emailIdx === -1) emailIdx = 1;
  if (planIdx === -1) planIdx = 2;

  const dataRows = rawGrid.slice(1);
  const results: ParsedMemberRow[] = [];

  for (const row of dataRows) {
    if (!row || !row.some((val) => val && val.trim().length > 0)) {
      continue;
    }

    const name = row[nameIdx] !== undefined ? row[nameIdx].trim() : "";
    const email = row[emailIdx] !== undefined ? row[emailIdx].trim() : "";
    const rawPlan = row[planIdx] !== undefined ? row[planIdx].trim() : "";
    const plan = normalizePlan(rawPlan);

    results.push({
      name,
      email,
      accessPlan: plan,
      rawPlan,
    });
  }

  return results;
}

export function parseCsv(text: string): ParsedMemberRow[] {
  const grid = parseCsvRows(text || "");
  return mapGridToMembers(grid);
}

export async function parseXlsx(buffer: ArrayBuffer | Uint8Array | Blob): Promise<ParsedMemberRow[]> {
  const zip = await JSZip.loadAsync(buffer);

  const sharedStrings: string[] = [];
  const sstFile = zip.file("xl/sharedStrings.xml") || zip.file("xl/SharedStrings.xml");
  if (sstFile) {
    const sstXml = await sstFile.async("string");
    const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
    let match;
    while ((match = siRegex.exec(sstXml)) !== null) {
      const siContent = match[1];
      const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
      const textPieces: string[] = [];
      let tMatch;
      while ((tMatch = tRegex.exec(siContent)) !== null) {
        textPieces.push(tMatch[1]);
      }
      sharedStrings.push(
        textPieces
          .join("")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
      );
    }
  }

  const sheetFile =
    zip.file("xl/worksheets/sheet1.xml") ||
    zip.file("xl/worksheets/Sheet1.xml") ||
    Object.values(zip.files).find((f) => f.name.startsWith("xl/worksheets/sheet") && f.name.endsWith(".xml"));

  if (!sheetFile) {
    throw new Error("No se encontró ninguna hoja de cálculo válida en el archivo .xlsx.");
  }

  const sheetXml = await sheetFile.async("string");

  function colRefToIdx(ref: string): number {
    const colLetters = ref.replace(/[0-9]/g, "").toUpperCase();
    let col = 0;
    for (let c = 0; c < colLetters.length; c++) {
      col = col * 26 + (colLetters.charCodeAt(c) - 64);
    }
    return col - 1;
  }

  const grid: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowXml = rowMatch[1];
    const rowCells: string[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
      const cellAttrs = cellMatch[1];
      const cellContent = cellMatch[2];

      const rMatch = cellAttrs.match(/\br="([A-Z0-9]+)"/i);
      const cellRef = rMatch ? rMatch[1] : null;
      const colIdx = cellRef ? colRefToIdx(cellRef) : rowCells.length;

      const tMatch = cellAttrs.match(/\bt="([a-z]+)"/i);
      const cellType = tMatch ? tMatch[1] : null;

      let val = "";
      if (cellType === "s") {
        const vMatch = cellContent.match(/<v>([0-9]+)<\/v>/i);
        if (vMatch) {
          const sIdx = parseInt(vMatch[1], 10);
          val = sharedStrings[sIdx] || "";
        }
      } else if (cellType === "inlineStr" || cellContent.includes("<is>")) {
        const tTagMatch = cellContent.match(/<t\b[^>]*>([\s\S]*?)<\/t>/i);
        if (tTagMatch) val = tTagMatch[1];
      } else {
        const vMatch = cellContent.match(/<v>([\s\S]*?)<\/v>/i);
        if (vMatch) {
          val = vMatch[1];
        }
      }

      val = val
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();

      rowCells[colIdx] = val;
    }

    for (let idx = 0; idx < rowCells.length; idx++) {
      if (rowCells[idx] === undefined) rowCells[idx] = "";
    }

    if (rowCells.some((c) => c && c.length > 0)) {
      grid.push(rowCells);
    }
  }

  return mapGridToMembers(grid);
}

export function validateMemberRows(
  rows: ParsedMemberRow[],
  existingMembers: Array<{ email: string; status?: string }> = []
): ValidationSummary {
  const existingMap = new Map<string, string>();
  for (const em of existingMembers) {
    if (em && em.email) {
      existingMap.set(em.email.toLowerCase().trim(), em.status || "active");
    }
  }

  const seenEmailsInFile = new Set<string>();
  const validatedRows: ValidatedMemberRow[] = [];

  let validCount = 0;
  let existingCount = 0;
  let errorCount = 0;
  let monthlyCount = 0;
  let annualCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;
    const name = (r.name || "").trim();
    const email = (r.email || "").trim();
    const plan = r.accessPlan;
    const planLabel = plan === "annual" ? "Anual" : plan === "monthly" ? "Mensual" : r.rawPlan || "Desconocido";

    let validationStatus: ValidatedMemberRow["validationStatus"] = "Válido";
    let isValid = false;
    let isExisting = false;
    let errorMessage: string | null = null;
    let existingMemberStatus: string | null = null;

    if (!name || !email || !r.rawPlan) {
      validationStatus = "Fila incompleta";
      errorMessage = "Faltan campos obligatorios (nombre, correo o plan).";
      errorCount++;
    } else if (!EMAIL_REGEX.test(email)) {
      validationStatus = "Correo inválido";
      errorMessage = "El formato del correo electrónico es inválido.";
      errorCount++;
    } else if (!plan) {
      validationStatus = "Tipo de acceso desconocido";
      errorMessage = `Tipo de acceso '${r.rawPlan}' no reconocido. Debe ser Mensual o Anual.`;
      errorCount++;
    } else if (seenEmailsInFile.has(email.toLowerCase())) {
      validationStatus = "Duplicado en archivo";
      errorMessage = "Este correo se repite más de una vez dentro del mismo archivo.";
      errorCount++;
    } else if (existingMap.has(email.toLowerCase())) {
      validationStatus = "YA EXISTE";
      isExisting = true;
      existingMemberStatus = existingMap.get(email.toLowerCase()) || "active";
      errorMessage = `El usuario ya existe en el sistema con estado '${existingMemberStatus}'. No se duplicará.`;
      existingCount++;
      seenEmailsInFile.add(email.toLowerCase());
    } else {
      validationStatus = "Válido";
      isValid = true;
      validCount++;
      if (plan === "monthly") monthlyCount++;
      if (plan === "annual") annualCount++;
      seenEmailsInFile.add(email.toLowerCase());
    }

    validatedRows.push({
      rowNumber: rowNum,
      name,
      email,
      accessPlan: plan,
      planLabel,
      validationStatus,
      isValid,
      isExisting,
      errorMessage,
      existingMemberStatus,
    });
  }

  return {
    total: rows.length,
    validCount,
    existingCount,
    errorCount,
    monthlyCount,
    annualCount,
    rows: validatedRows,
  };
}

export function get12MembersCsvText(): string {
  return [
    "NOMBRE,CORREO,Tipo de Acceso",
    "Jose Varela,jjvarela0321@gmail.com,Mensual",
    "Arturo Fuentes,arturo.fuentesg@gmail.com,Mensual",
    "Diana Sandra Cordero Hernandez,sandycordero339@gmail.com,Mensual",
    "Felix Torres,felotorquin@gmail.com,Mensual",
    "Octavio Soperanes,soperanestavo93@gmail.com,Mensual",
    "Freddy Perez,marketingcpa2025@gmail.com,Mensual",
    "Joshua Marquez,joshua.marquez@gmail.com,Mensual",
    "Daniel Avila,danielfelipeparra07@gmail.com,Mensual",
    "Cesar Castro,ingenierocesarcastro@gmail.com,Mensual",
    "Ricardo Daniel Tovar Barrera,r.tovar.barrera@gmail.com,Anual",
    "Sandy Leon,Sandy22karina22@gmail.com,Anual",
    "Jorge MV,jorgr.mv@gmail.com,Mensual",
  ].join("\r\n");
}
