import { getGatewayBaseUrl } from "./gateway";
export type PaymentStatus = "paid" | "pending" | "unknown";
export interface BillingTransaction { id: string; member_id: string; entry_key: string; revision: number; type: string; access_plan: "monthly" | "annual"; amount_minor: number | null; currency: string | null; status: PaymentStatus; paid_at: string | null; billing_period: string | null; source: string; created_at: string; reason: string; name?: string }
export interface BillingMember { memberId: string; name: string; email: string; plan: "monthly" | "annual"; memberStatus: string; expiresAt: string | null; amountMinor: number | null; currency: string | null; revision: number; paymentStatus: PaymentStatus; paidAt: string | null; period: string | null; entry: BillingTransaction | null; source: string | null; days?: number }
export interface BillingSyncPreview {
  previewToken: string; sourceFingerprint: string; rows: number; validRows: number; existingMembers: number; monthly: number; annual: number; safePlanChanges: number;
  counts: {newMembers: number; amountsUpdated: number; plansChanged: number; unchanged: number; invalid: number; missingAmounts: number; needsReview: number};
  applicableRows: number; canApply: boolean; existingNotInSheet: number;
  totals: {currency: string; beforeMinor: number; afterMinor: number; sheetMinor: number}[];
  unknownAmounts: {before: number; after: number};
  lastSync: BillingSyncInfo|null;
  details: {row:number|null;name:string;classification:string;reason:string|null;oldPlan:string|null;newPlan:string|null;oldAmountMinor:number|null;newAmountMinor:number|null;currency:string|null;willApply:boolean}[];
}
export interface BillingSyncInfo {
  synced_at: string;
  metadata: {matched:number;rows:number;unknownAmounts:number;detectedColumns:Record<string,string|null>;issues:{row:number;reason:string}[];lastSheetSyncBy?:{adminId:string|null;role:string};notInSheetMemberIds?:string[];sourceFingerprint?:string;rowsProcessed?:number};
}
export interface BillingDashboardData {
  month: string; previousMonth: string; currency: string; currencies: string[]; members: BillingMember[]; transactions: BillingTransaction[];
  sync: BillingSyncInfo|null;
  commercial: {total:number;members:number;needsReview:number};
  summary: { collected: number; registered: number; previousCollected: number; differencePercent: number | null; pending: number; averageTicket: number | null; annualCollected: number; monthlyCollected: number; mrr: number | null; activePayingMembers: number; newPayingMembers: number; undated: number; undatedCount: number; needsReview: number };
  goal: { target: number | null; revision: number; progress: number | null; remaining: number | null };
  trend: {month: string; collected: number; registered: number}[];
  breakdown: {plan: string; members: number; collected: number; registered: number; undated: number}[];
  renewals: BillingMember[]; recent: BillingTransaction[];
}
async function request(query = "", body?: Record<string, unknown>) {
  const response = await fetch(`${getGatewayBaseUrl()}/api/admin/billing${query}`, { method: body ? "POST" : "GET", credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "No se pudo cargar facturación.");
  return data;
}
export async function fetchBilling(month: string, currency: string): Promise<BillingDashboardData> { return (await request(`?${new URLSearchParams({month,currency})}`)).dashboard; }
export async function writeBilling(body: Record<string, unknown>): Promise<void> { await request("",body); }
export async function previewBillingSync(): Promise<BillingSyncPreview> { return (await request("",{action:"sync-preview"})).preview; }
export async function applyBillingSync(previewToken:string):Promise<void> { await request("",{action:"sync",previewToken}); }
export async function fetchSheetSyncStatus():Promise<BillingSyncInfo|null> { return (await request("?sync=status")).sync; }
export function sheetSyncDate(sync:BillingSyncInfo|null):string { return sync?new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"America/Mexico_City"}).format(new Date(sync.synced_at))+" CDMX":"Sin sincronización"; }
export function billingMoney(minor: number | null, currency: string): string { return minor === null ? "Sin datos" : new Intl.NumberFormat("es-MX", {style:"currency",currency,currencyDisplay:"narrowSymbol",minimumFractionDigits:2,maximumFractionDigits:2}).format(minor / 100) + ` ${currency}`; }
export function billingAmountInput(text: string): number | null { if (!/^\d+([.,]\d{1,2})?$/.test(text.trim())) return null; const [units,decimals=""] = text.trim().replace(",", ".").split("."); const value = Number(units)*100+Number(decimals.padEnd(2,"0")); return Number.isSafeInteger(value)&&value<=100000000000?value:null; }
export function localBillingMonth(date=new Date()): string { return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit"}).format(date); }
