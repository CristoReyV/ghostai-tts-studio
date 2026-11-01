import { getGatewayBaseUrl } from "./gateway";
export interface SkoolSyncInfo { configured: boolean; sourceId?: string; sync: { synced_at: string; metadata: { rows: number } } | null }
export interface SkoolPreview {
  rows: number; sourceFingerprint: string; previewToken: string; canApply: boolean;
  counts: { newMembers: number; existing: number; removed: number; rejoined: number; expiryChanges: number; invalid: number; inactiveRows: number };
  details: { row: number | null; name: string; classification: string; reason?: string | null }[];
}
export interface SkoolApplyResult { created: number; removed: number; updated: number; needsContinuation: boolean; remaining?: number; sourceFingerprint: string }
async function request(body?: Record<string, string>) {
  const response = await fetch(`${getGatewayBaseUrl()}/api/admin/skool-sync`, { method: body ? "POST" : "GET", credentials: "include", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "No se pudo completar SKOOL. Actualiza antes de reintentar.");
  return data;
}
export async function fetchSkoolSync(): Promise<SkoolSyncInfo> { return request(); }
export async function previewSkoolSync(): Promise<SkoolPreview> { return (await request({ action: "preview" })).preview; }
export async function applySkoolSync(previewToken: string): Promise<SkoolApplyResult> { return request({ action: "apply", previewToken }); }
