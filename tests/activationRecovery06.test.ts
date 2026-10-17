import {describe,it,expect,vi,afterEach} from "vitest";
import {activateOnce,persistActivationCredential} from "../src/services/activationRecovery";
import {getGatewayAuthToken,clearGatewayAuthToken,OPERATOR_TOKEN_STORAGE_KEY} from "../src/services/gateway";
const result={ok:true,accessKey:"unit-access-key",clientName:"QA",accessPlan:"monthly",activatedAt:"2026-10-17",expiresAt:"2026-11-16",memberId:"qa"};
afterEach(()=>{clearGatewayAuthToken();vi.unstubAllGlobals();});
describe("activation persistence and StrictMode recovery",()=>{
 it("shares one consume while concurrent effects wait",async()=>{
  let resolve!: (value: unknown)=>void;
  const fetcher=vi.fn(()=>new Promise(r=>{resolve=r;}));vi.stubGlobal("fetch",fetcher);
  const first=activateOnce("unit-activation");const second=activateOnce("unit-activation");
  expect(first===second).toBe(true);expect(fetcher).toHaveBeenCalledTimes(1);
  resolve({ok:true,json:async()=>result});await first;
 });
 it("confirms storage before success and survives a refreshed credential read",()=>{
  const values=new Map<string,string>();
  vi.stubGlobal("window",{sessionStorage:{setItem:(k:string,v:string)=>values.set(k,v),getItem:(k:string)=>values.get(k)||null,removeItem:(k:string)=>values.delete(k)}});
  expect(persistActivationCredential(result)).toBe(true);
  expect(values.get(OPERATOR_TOKEN_STORAGE_KEY)).toBe(result.accessKey);
  expect(getGatewayAuthToken()).toBe(result.accessKey);
 });
 it("reports failure when storage throws or silently drops writes",()=>{
  vi.stubGlobal("window",{sessionStorage:{setItem:()=>{throw Error("denied")},getItem:()=>null,removeItem:()=>{}}});
  expect(persistActivationCredential(result)).toBe(false);
  vi.stubGlobal("window",{sessionStorage:{setItem:()=>{},getItem:()=>null,removeItem:()=>{}}});
  expect(persistActivationCredential(result)).toBe(false);
 });
});
