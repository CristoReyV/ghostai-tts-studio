import {afterEach,expect,it,vi} from "vitest";
import {parseCsv,normalizePlan,validateMemberRows} from "../src/services/memberImportParser";
import {accessPlanLabel} from "../src/services/accessPlans";
import {createAdminMember} from "../src/services/adminService";
afterEach(()=>vi.unstubAllGlobals());
it("imports De por vida as a distinct plan and reports its own count",()=>{
  for(const plan of ["De por vida","LIFETIME","  de   por vida ","Vitalicio"])expect(normalizePlan(plan)).toBe("lifetime");
  const result=validateMemberRows(parseCsv("Nombre,Correo,Tipo de Acceso\nQA,qa@qa.invalid,De por vida"),[]);
  expect(result).toMatchObject({validCount:1,monthlyCount:0,annualCount:0,lifetimeCount:1});expect(result.rows[0]).toMatchObject({accessPlan:"lifetime",planLabel:"De por vida"});expect(accessPlanLabel("lifetime")).toBe("De por vida");
});
it("creates an individual lifetime member through the existing authenticated endpoint",async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({member:{access_plan:"lifetime"}})});vi.stubGlobal("fetch",fetcher);
  await createAdminMember("QA","qa@qa.invalid","lifetime");expect(fetcher.mock.calls[0][1].credentials).toBe("include");expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({name:"QA",email:"qa@qa.invalid",accessPlan:"lifetime"});
});
