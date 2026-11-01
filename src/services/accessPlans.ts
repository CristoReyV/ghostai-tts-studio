export type AccessPlan = "monthly" | "annual" | "lifetime" | "skool";
export const ACCESS_PLAN_LABELS:Record<AccessPlan,string> = {monthly:"Mensual",annual:"Anual",lifetime:"De por vida",skool:"SKOOL"};
export function accessPlanLabel(value:string):string {return ACCESS_PLAN_LABELS[value as AccessPlan]||"Plan desconocido";}
